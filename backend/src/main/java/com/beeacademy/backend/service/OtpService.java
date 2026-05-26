package com.beeacademy.backend.service;

import com.beeacademy.backend.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Quản lý vòng đời OTP cho luồng đăng ký (UC01).
 *
 * <p>OTP được lưu in-memory (ConcurrentHashMap) với TTL 5 phút.
 * Phù hợp cho single-instance MVP; sau này có thể đổi sang Redis.
 *
 * <p>Mỗi email chỉ tồn tại 1 entry — request mới ghi đè entry cũ
 * (tự reset khi user click "Gửi lại").
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OtpService {

    private static final int OTP_TTL_SECONDS = 300; // 5 phút
    private static final int OTP_LENGTH = 6;

    private final JavaMailSender mailSender;

    @Value("${app.dev-mode:false}")
    private boolean devMode;

    private final SecureRandom random = new SecureRandom();

    /** Key = email lowercase, value = pending entry chờ xác minh. */
    private final ConcurrentHashMap<String, OtpEntry> store = new ConcurrentHashMap<>();

    /** Key = email lowercase, value = pending reset password entry chờ xác minh. */
    private final ConcurrentHashMap<String, ResetOtpEntry> resetPasswordStore = new ConcurrentHashMap<>();

    // ========================================================================
    // Public API
    // ========================================================================

    /**
     * Tạo OTP mới và gửi qua email.
     * Ghi đè entry cũ nếu đã tồn tại (cho phép gửi lại).
     */
    public void send(String email, String fullName, String role) {
        String code = generateCode();
        String key  = email.toLowerCase();

        store.put(key, new OtpEntry(fullName, role, code,
                Instant.now().plusSeconds(OTP_TTL_SECONDS)));

        sendEmail(email, fullName, code);
    }

    /**
     * Xác minh OTP — validate nhưng KHÔNG xóa khỏi store.
     * Gọi {@link #consume(String)} sau khi tài khoản tạo thành công.
     *
     * @return OtpEntry chứa fullName + role để tạo tài khoản
     * @throws BusinessException nếu OTP sai hoặc hết hạn
     */
    public OtpEntry verify(String email, String otpCode) {
        String key   = email.toLowerCase();
        OtpEntry entry = store.get(key);

        if (entry == null) {
            throw new BusinessException("OTP_NOT_FOUND",
                    "Không tìm thấy yêu cầu đăng ký. Vui lòng gửi lại mã OTP.",
                    HttpStatus.BAD_REQUEST);
        }
        if (Instant.now().isAfter(entry.expiresAt())) {
            store.remove(key);
            throw new BusinessException("OTP_EXPIRED",
                    "Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.",
                    HttpStatus.BAD_REQUEST);
        }
        if (!entry.otpCode().equals(otpCode)) {
            throw new BusinessException("OTP_INVALID",
                    "Mã OTP không đúng. Vui lòng kiểm tra lại.",
                    HttpStatus.BAD_REQUEST);
        }

        return entry; // KHÔNG xóa ở đây — caller gọi consume() sau khi tạo user xong
    }

    /**
     * Xóa OTP khỏi store sau khi tài khoản đã tạo thành công (single-use).
     */
    public void consume(String email) {
        store.remove(email.toLowerCase());
    }

    // ========================================================================
    // Reset Password OTP APIs
    // ========================================================================

    /**
     * Tạo OTP mới cho reset password và gửi qua email.
     */
    public void sendResetPasswordOtp(String email) {
        String code = generateCode();
        String key  = email.toLowerCase();

        resetPasswordStore.put(key, new ResetOtpEntry(code,
                Instant.now().plusSeconds(OTP_TTL_SECONDS)));

        sendResetEmail(email, code);
    }

    /**
     * Xác minh OTP cho reset password - validate nhưng KHÔNG xóa khỏi store.
     */
    public ResetOtpEntry verifyResetPasswordOtp(String email, String otpCode) {
        String key = email.toLowerCase();
        ResetOtpEntry entry = resetPasswordStore.get(key);

        if (entry == null) {
            throw new BusinessException("OTP_NOT_FOUND",
                    "Không tìm thấy yêu cầu đặt lại mật khẩu. Vui lòng gửi lại mã OTP.",
                    HttpStatus.BAD_REQUEST);
        }
        if (Instant.now().isAfter(entry.expiresAt())) {
            resetPasswordStore.remove(key);
            throw new BusinessException("OTP_EXPIRED",
                    "Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.",
                    HttpStatus.BAD_REQUEST);
        }
        if (!entry.otpCode().equals(otpCode)) {
            throw new BusinessException("OTP_INVALID",
                    "Mã OTP không đúng. Vui lòng kiểm tra lại.",
                    HttpStatus.BAD_REQUEST);
        }

        return entry;
    }

    /**
     * Xóa OTP reset password khỏi store (single-use).
     */
    public void consumeResetPasswordOtp(String email) {
        resetPasswordStore.remove(email.toLowerCase());
    }

    // ========================================================================
    // Internal
    // ========================================================================

    private String generateCode() {
        int n = random.nextInt(900_000) + 100_000; // 100000–999999
        return String.valueOf(n);
    }

    private void sendEmail(String to, String fullName, String code) {
        try {
            var msg = mailSender.createMimeMessage();
            var helper = new MimeMessageHelper(msg, false, "UTF-8");
            helper.setTo(to);
            helper.setSubject("🐝 Mã xác thực Bee Academy: " + code);
            helper.setText(buildHtml(fullName, code), true);
            mailSender.send(msg);
            log.info("📧 OTP đã gửi đến {}", to);
        } catch (Exception ex) {
            if (devMode) {
                log.warn("⚠️  [DEV] Gửi email thất bại ({}). OTP fallback → console.", ex.getMessage());
                log.warn("⚠️  [DEV] OTP cho {}: {}", to, code);
            } else {
                log.error("Gửi email OTP thất bại đến {}: {}", to, ex.getMessage());
                throw new BusinessException("MAIL_SEND_FAILED",
                        "Không thể gửi email xác thực. Vui lòng thử lại sau.",
                        HttpStatus.SERVICE_UNAVAILABLE);
            }
        }
    }

    private String buildHtml(String fullName, String code) {
        return """
            <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;
                        background:#f9f7ff;border-radius:16px">
              <div style="text-align:center;margin-bottom:24px">
                <span style="font-size:40px">🐝</span>
                <h2 style="color:#4c1d95;margin:8px 0">Bee Academy</h2>
              </div>
              <p style="color:#374151">Xin chào <strong>%s</strong>,</p>
              <p style="color:#374151">Mã xác thực đăng ký của bạn là:</p>
              <div style="text-align:center;margin:24px 0">
                <span style="font-size:40px;font-weight:bold;letter-spacing:12px;
                             color:#7c3aed;background:#ede9fe;padding:16px 24px;
                             border-radius:12px">%s</span>
              </div>
              <p style="color:#6b7280;font-size:14px">
                Mã có hiệu lực trong <strong>5 phút</strong>.<br>
                Nếu bạn không yêu cầu đăng ký, hãy bỏ qua email này.
              </p>
            </div>
            """.formatted(fullName, code);
    }

    // ========================================================================
    // Entry records
    // ========================================================================

    public record OtpEntry(String fullName, String role, String otpCode, Instant expiresAt) {}

    public record ResetOtpEntry(String otpCode, Instant expiresAt) {}

    private void sendResetEmail(String to, String code) {
        try {
            var msg = mailSender.createMimeMessage();
            var helper = new MimeMessageHelper(msg, false, "UTF-8");
            helper.setTo(to);
            helper.setSubject("🐝 Thiết lập lại mật khẩu Bee Academy: " + code);
            helper.setText(buildResetHtml(code), true);
            mailSender.send(msg);
            log.info("📧 OTP đặt lại mật khẩu đã gửi đến {}", to);
        } catch (Exception ex) {
            if (devMode) {
                log.warn("⚠️  [DEV] Gửi email đặt lại mật khẩu thất bại ({}). OTP phục hồi fallback → console.", ex.getMessage());
                log.warn("⚠️  [DEV] OTP reset password cho {}: {}", to, code);
            } else {
                log.error("Gửi email OTP đặt lại mật khẩu thất bại đến {}: {}", to, ex.getMessage());
                throw new BusinessException("MAIL_SEND_FAILED",
                        "Không thể gửi email xác thực đặt lại mật khẩu. Vui lòng thử lại sau.",
                        HttpStatus.SERVICE_UNAVAILABLE);
            }
        }
    }

    private String buildResetHtml(String code) {
        return """
            <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;
                        background:#fffbf7;border-radius:16px;border:1px solid #fed7aa">
              <div style="text-align:center;margin-bottom:24px">
                <span style="font-size:40px">🐝</span>
                <h2 style="color:#ad2c00;margin:8px 0">Bee Academy</h2>
              </div>
              <p style="color:#374151">Xin chào,</p>
              <p style="color:#374151">Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản Bee Academy. Mã xác thực của bạn là:</p>
              <div style="text-align:center;margin:24px 0">
                <span style="font-size:40px;font-weight:bold;letter-spacing:12px;
                             color:#ad2c00;background:#ffedd5;padding:16px 24px;
                             border-radius:12px">%s</span>
              </div>
              <p style="color:#6b7280;font-size:14px">
                Mã có hiệu lực trong <strong>5 phút</strong>.<br>
                Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này để bảo vệ tài khoản.
              </p>
            </div>
            """.formatted(code);
    }
}


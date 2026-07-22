package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.BankInfoRequest;
import com.beeacademy.backend.dto.response.BankFieldChange;
import com.beeacademy.backend.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Vòng đời mã xác nhận đổi TK ngân hàng của giáo viên.
 *
 * <p><b>Vì sao thay đổi được giữ ở ĐÂY chứ không ghi thẳng vào DB rồi mới chờ
 * xác nhận:</b> nếu ghi trước, ai mượn được session của GV chỉ cần bấm Lưu là
 * số TK đang VERIFIED bị đè và kỳ chi trả bị {@code HOLD_BANK_INFO} treo lại —
 * phá được tiền lương của GV mà không cần chạm tới hộp thư. Giữ ở ngoài DB thì
 * không có mã trong email = TK trên hệ thống không suy suyển một chữ.
 *
 * <p><b>Vì sao in-memory:</b> đi cùng lựa chọn sẵn có của {@link OtpService}
 * (single-instance MVP). Restart server chỉ làm mất một yêu cầu đang chờ tối đa
 * 10 phút — GV bấm lại là xong, không mất dữ liệu đã lưu. Chạy nhiều instance
 * thì cả hai service này đều phải chuyển sang Redis cùng lúc.
 *
 * <p>Không dùng lại {@link OtpService}: store ở đó khoá theo email và chỉ mang
 * theo {@code fullName/role} cho luồng đăng ký; ở đây khoá theo teacherId và
 * phải cõng nguyên payload TK + số lần nhập sai.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TeacherBankOtpService {

    /** 10 phút — dài hơn OTP đăng ký vì GV còn phải mở app ngân hàng đối chiếu số TK. */
    private static final int OTP_TTL_SECONDS = 600;

    /** Chặn bấm "Gửi lại" liên tục để không biến hệ thống thành máy spam mail. */
    private static final int RESEND_COOLDOWN_SECONDS = 60;

    /** Sai quá số lần này thì huỷ yêu cầu — chặn dò mã 6 số bằng vét cạn. */
    private static final int MAX_ATTEMPTS = 5;

    private final JavaMailSender mailSender;

    @Value("${app.dev-mode:false}")
    private boolean devMode;

    private final SecureRandom random = new SecureRandom();

    /** Key = teacherId. Mỗi GV chỉ có tối đa 1 yêu cầu đang chờ; yêu cầu mới đè yêu cầu cũ. */
    private final ConcurrentHashMap<UUID, PendingChange> store = new ConcurrentHashMap<>();

    // ========================================================================
    // Public API
    // ========================================================================

    /**
     * Sinh mã mới, giữ payload lại và gửi mã về email GV.
     *
     * @return entry đang chờ (để controller lấy {@code expiresAt} trả cho FE)
     * @throws BusinessException khi còn trong thời gian chờ gửi lại, hoặc gửi mail hỏng
     */
    public PendingChange start(UUID teacherId, String email, String teacherName,
                               BankInfoRequest payload, List<BankFieldChange> changes) {
        requireResendAllowed(teacherId);

        String code = generateCode();
        Instant now = Instant.now();
        PendingChange entry = new PendingChange(
                payload, changes, code,
                now.plusSeconds(OTP_TTL_SECONDS), now, new AtomicInteger(0));
        store.put(teacherId, entry);

        // Gửi mail hỏng ở production thì phải rút lại entry: để nó nằm đó, GV không
        // bao giờ nhận được mã nhưng lại bị cooldown chặn thử lại suốt 60 giây.
        try {
            sendEmail(email, teacherName, code, payload, changes);
        } catch (BusinessException ex) {
            store.remove(teacherId);
            throw ex;
        }

        return entry;
    }

    /**
     * Đối chiếu mã GV nhập. Trả về payload đang chờ nhưng KHÔNG xoá khỏi store —
     * caller gọi {@link #consume(UUID)} sau khi ghi DB thành công, để lỗi DB
     * không làm GV mất mã và phải xin lại từ đầu.
     */
    public PendingChange verify(UUID teacherId, String otpCode) {
        PendingChange entry = store.get(teacherId);

        if (entry == null) {
            throw new BusinessException("BANK_OTP_NOT_FOUND",
                    "Không tìm thấy yêu cầu đổi TK nào đang chờ. Vui lòng thao tác lại từ đầu.",
                    HttpStatus.BAD_REQUEST);
        }
        if (Instant.now().isAfter(entry.expiresAt())) {
            store.remove(teacherId);
            throw new BusinessException("BANK_OTP_EXPIRED",
                    "Mã xác nhận đã hết hạn. Vui lòng yêu cầu mã mới.",
                    HttpStatus.BAD_REQUEST);
        }
        if (!entry.otpCode().equals(otpCode)) {
            int used = entry.attempts().incrementAndGet();
            if (used >= MAX_ATTEMPTS) {
                store.remove(teacherId);
                throw new BusinessException("BANK_OTP_TOO_MANY_ATTEMPTS",
                        "Bạn đã nhập sai mã quá số lần cho phép. Yêu cầu đổi TK đã bị huỷ.",
                        HttpStatus.TOO_MANY_REQUESTS);
            }
            throw new BusinessException("BANK_OTP_INVALID",
                    "Mã xác nhận không đúng. Bạn còn %d lần thử.".formatted(MAX_ATTEMPTS - used),
                    HttpStatus.BAD_REQUEST);
        }

        return entry;
    }

    /** Xoá yêu cầu sau khi đã ghi DB xong — mã dùng đúng một lần. */
    public void consume(UUID teacherId) {
        store.remove(teacherId);
    }

    /**
     * Che email trước khi trả về client: giữ 2 ký tự đầu và toàn bộ tên miền,
     * đủ để GV nhận ra hộp thư của mình mà không tiết lộ thêm địa chỉ thật.
     */
    public static String maskEmail(String email) {
        int at = email.indexOf('@');
        if (at <= 0) {
            return "***";
        }
        String local = email.substring(0, at);
        String domain = email.substring(at);
        if (local.length() <= 2) {
            return local.charAt(0) + "***" + domain;
        }
        return local.substring(0, 2) + "***" + domain;
    }

    // ========================================================================
    // Internal
    // ========================================================================

    private void requireResendAllowed(UUID teacherId) {
        PendingChange current = store.get(teacherId);
        if (current == null) {
            return;
        }
        long waited = Duration.between(current.sentAt(), Instant.now()).getSeconds();
        if (waited < RESEND_COOLDOWN_SECONDS) {
            throw new BusinessException("BANK_OTP_COOLDOWN",
                    "Vui lòng đợi %d giây trước khi yêu cầu mã mới."
                            .formatted(RESEND_COOLDOWN_SECONDS - waited),
                    HttpStatus.TOO_MANY_REQUESTS);
        }
    }

    private String generateCode() {
        return String.valueOf(random.nextInt(900_000) + 100_000); // 100000–999999
    }

    private void sendEmail(String to, String teacherName, String code,
                           BankInfoRequest payload, List<BankFieldChange> changes) {
        try {
            var msg = mailSender.createMimeMessage();
            var helper = new MimeMessageHelper(msg, false, "UTF-8");
            helper.setTo(to);
            helper.setSubject("🐝 Mã xác nhận đổi TK ngân hàng Bee Academy: " + code);
            helper.setText(buildHtml(teacherName, code, payload, changes), true);
            mailSender.send(msg);
            log.info("📧 Mã đổi TK ngân hàng đã gửi đến {}", maskEmail(to));
        } catch (Exception ex) {
            if (devMode) {
                log.warn("⚠️  [DEV] Gửi mail đổi TK thất bại ({}). Mã fallback → console.", ex.getMessage());
                log.warn("⚠️  [DEV] Mã đổi TK ngân hàng cho {}: {}", to, code);
            } else {
                log.error("Gửi mã đổi TK ngân hàng thất bại đến {}: {}", maskEmail(to), ex.getMessage());
                throw new BusinessException("MAIL_SEND_FAILED",
                        "Không thể gửi email xác nhận. Vui lòng thử lại sau.",
                        HttpStatus.SERVICE_UNAVAILABLE);
            }
        }
    }

    /**
     * Email cố tình in ra TK sắp được lưu (số TK che bớt) chứ không chỉ mỗi mã.
     * Đó mới là phần có giá trị bảo mật: GV không yêu cầu đổi mà thấy mail này
     * thì biết ngay tài khoản mình đang bị người khác đụng vào.
     */
    private String buildHtml(String teacherName, String code,
                             BankInfoRequest payload, List<BankFieldChange> changes) {
        String rows = changes.isEmpty()
                ? "<tr><td style=\"padding:6px 0;color:#374151\">Xác minh lại thông tin TK hiện tại</td></tr>"
                : changes.stream().map(c -> """
                    <tr>
                      <td style="padding:6px 12px 6px 0;color:#6b7280;font-size:13px;white-space:nowrap">%s</td>
                      <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600">%s</td>
                    </tr>
                    """.formatted(escape(c.field()), escape(c.newValue()))).reduce("", String::concat);

        return """
            <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;
                        background:#fffbf7;border-radius:16px;border:1px solid #fed7aa">
              <div style="text-align:center;margin-bottom:24px">
                <span style="font-size:40px">🐝</span>
                <h2 style="color:#ad2c00;margin:8px 0">Bee Academy</h2>
              </div>
              <p style="color:#374151">Xin chào <strong>%s</strong>,</p>
              <p style="color:#374151">
                Bạn đang yêu cầu cập nhật <strong>tài khoản ngân hàng nhận hoa hồng</strong>.
                Mã xác nhận của bạn là:
              </p>
              <div style="text-align:center;margin:24px 0">
                <span style="font-size:40px;font-weight:bold;letter-spacing:12px;
                             color:#ad2c00;background:#ffedd5;padding:16px 24px;
                             border-radius:12px">%s</span>
              </div>
              <div style="background:#fff;border:1px solid #fed7aa;border-radius:12px;padding:16px;margin:20px 0">
                <p style="margin:0 0 8px;color:#6b7280;font-size:12px;font-weight:bold;
                          text-transform:uppercase;letter-spacing:.05em">Thông tin sẽ được lưu</p>
                <table style="width:100%%;border-collapse:collapse">%s</table>
                <p style="margin:12px 0 0;color:#6b7280;font-size:12px">
                  Ngân hàng: <strong>%s</strong> · Số TK: <strong>%s</strong>
                </p>
              </div>
              <p style="color:#6b7280;font-size:14px">
                Mã có hiệu lực trong <strong>10 phút</strong>.<br>
                <strong style="color:#b91c1c">Nếu bạn KHÔNG yêu cầu thay đổi này</strong>, hãy bỏ qua email
                (thay đổi sẽ không được áp dụng) và đổi mật khẩu tài khoản ngay.
              </p>
            </div>
            """.formatted(escape(teacherName), code, rows,
                escape(payload.bankName()), maskAccountNumber(payload.accountNumber()));
    }

    /** Lộ 4 số cuối là đủ để GV nhận ra TK — in đủ số vào email là tự tạo rủi ro. */
    private String maskAccountNumber(String accountNumber) {
        if (accountNumber == null || accountNumber.length() <= 4) {
            return accountNumber != null ? accountNumber : "";
        }
        return "*".repeat(accountNumber.length() - 4) + accountNumber.substring(accountNumber.length() - 4);
    }

    /** Tên ngân hàng / chủ TK do GV tự nhập rồi đi thẳng vào HTML — phải khử thẻ. */
    private String escape(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.replace("&", "&amp;")
                  .replace("<", "&lt;")
                  .replace(">", "&gt;")
                  .replace("\"", "&quot;");
    }

    // ========================================================================
    // Entry record
    // ========================================================================

    /**
     * Một yêu cầu đổi TK đang chờ xác nhận.
     *
     * @param payload   thông tin TK đã chuẩn hoá, sẽ ghi DB khi mã đúng
     * @param changes   diff tính ở thời điểm xin mã — chỉ để hiển thị lại cho GV
     * @param attempts  số lần nhập sai; {@link AtomicInteger} vì record bất biến
     *                  nhưng bộ đếm phải tăng được mà không thay entry
     */
    public record PendingChange(
            BankInfoRequest payload,
            List<BankFieldChange> changes,
            String otpCode,
            Instant expiresAt,
            Instant sentAt,
            AtomicInteger attempts
    ) {
    }
}

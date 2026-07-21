package com.beeacademy.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

/**
 * Gửi email chứa mật khẩu tạm cho giáo viên được Admin cấp tài khoản.
 *
 * <p><b>Khác các email service khác trong dự án</b>: hàm gửi KHÔNG ném
 * exception khi thất bại mà trả về {@code false}. Lý do: tài khoản đã được tạo
 * xong ở Supabase trước khi gọi email - ném lỗi ở đây sẽ rollback profile
 * nhưng không rollback được auth user, tạo ra tài khoản mồ côi. Hơn nữa Admin
 * vẫn cầm mật khẩu tạm trên màn hình và có thể gửi qua Zalo/Facebook, nên
 * SMTP hỏng không phải lý do để huỷ cả thao tác.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TeacherAccountEmailService {

    private final JavaMailSender mailSender;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    /**
     * @return true nếu email đã được gửi đi; false nếu SMTP lỗi (Admin phải
     *         tự gửi mật khẩu qua kênh mạng xã hội)
     */
    public boolean sendTemporaryPassword(String email, String fullName, String temporaryPassword) {
        try {
            var message = mailSender.createMimeMessage();
            var helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setTo(email);
            helper.setSubject("Bee Academy - Tài khoản giáo viên của bạn");
            helper.setText(buildHtml(fullName, email, temporaryPassword), true);
            mailSender.send(message);
            log.info("Đã gửi email mật khẩu tạm cho giáo viên {}", email);
            return true;
        } catch (Exception ex) {
            log.warn("Không gửi được email mật khẩu tạm cho {}: {}", email, ex.getMessage());
            return false;
        }
    }

    private String buildHtml(String fullName, String email, String temporaryPassword) {
        String greetingName = fullName == null || fullName.isBlank() ? "bạn" : fullName;
        String loginUrl = frontendUrl.endsWith("/") ? frontendUrl + "login" : frontendUrl + "/login";

        return """
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#fffaf5;border:1px solid #fde7d9;border-radius:18px;color:#1f2937">
              <div style="text-align:center;margin-bottom:24px">
                <h2 style="margin:0;color:#9a3412">Bee Academy</h2>
                <p style="margin:8px 0 0;color:#6b7280;font-size:14px">Tài khoản giảng dạy</p>
              </div>
              <p>Xin chào <strong>%s</strong>,</p>
              <p>
                Bee Academy đã tạo tài khoản giáo viên cho bạn. Dưới đây là thông tin đăng nhập:
              </p>
              <div style="margin:20px 0;padding:16px;background:#fff;border:1px solid #fde7d9;border-radius:12px">
                <p style="margin:0 0 8px">Email: <strong>%s</strong></p>
                <p style="margin:0">Mật khẩu tạm: <strong style="font-family:monospace;font-size:18px;letter-spacing:1px">%s</strong></p>
              </div>
              <div style="margin:24px 0;text-align:center">
                <a href="%s" style="display:inline-block;padding:12px 18px;background:#c2410c;color:#fff;text-decoration:none;border-radius:10px;font-weight:700">
                  Đăng nhập Bee Academy
                </a>
              </div>
              <p style="font-size:13px;color:#b45309;line-height:1.6;padding:12px;background:#fffbeb;border-radius:10px">
                <strong>Lưu ý bảo mật:</strong> Hệ thống sẽ yêu cầu bạn đổi mật khẩu ngay ở lần đăng nhập
                đầu tiên. Bạn chưa dùng được các chức năng giảng dạy cho tới khi đổi xong.
              </p>
              <p style="font-size:13px;color:#6b7280;line-height:1.6">
                Nếu bạn không yêu cầu tài khoản này, vui lòng bỏ qua email và báo lại cho Bee Academy.
              </p>
            </div>
            """.formatted(greetingName, email, temporaryPassword, loginUrl);
    }
}

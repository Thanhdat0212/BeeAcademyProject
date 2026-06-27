package com.beeacademy.backend.service;

import com.beeacademy.backend.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class ParentLinkInvitationEmailService {

    private final JavaMailSender mailSender;

    @Value("${app.dev-mode:false}")
    private boolean devMode;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    public void sendInvitation(String studentEmail, String studentName, String parentName) {
        try {
            var message = mailSender.createMimeMessage();
            var helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setTo(studentEmail);
            helper.setSubject("Bee Academy - Lời mời liên kết từ phụ huynh");
            helper.setText(buildHtml(studentName, parentName), true);
            mailSender.send(message);
            log.info("Sent parent link invitation email to {}", studentEmail);
        } catch (Exception ex) {
            if (devMode) {
                log.warn("[DEV] Failed to send parent link invitation email to {}: {}", studentEmail, ex.getMessage());
                return;
            }

            throw new BusinessException(
                    "MAIL_SEND_FAILED",
                    "Không thể gửi email lời mời liên kết cho học sinh. Vui lòng thử lại sau.",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    private String buildHtml(String studentName, String parentName) {
        String greetingName = studentName == null || studentName.isBlank() ? "bạn" : studentName;
        String senderName = parentName == null || parentName.isBlank() ? "một phụ huynh" : parentName;
        String notificationUrl = frontendUrl.endsWith("/") ? frontendUrl + "notifications" : frontendUrl + "/notifications";

        return """
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#fffaf5;border:1px solid #fde7d9;border-radius:18px;color:#1f2937">
              <div style="text-align:center;margin-bottom:24px">
                <h2 style="margin:0;color:#9a3412">Bee Academy</h2>
                <p style="margin:8px 0 0;color:#6b7280;font-size:14px">Thông báo liên kết phụ huynh - học sinh</p>
              </div>
              <p>Xin chào <strong>%s</strong>,</p>
              <p>
                Tài khoản phụ huynh <strong>%s</strong> vừa gửi lời mời liên kết với tài khoản học sinh của bạn
                trên Bee Academy.
              </p>
              <p>
                Lời mời đã được ghi nhận trong hệ thống với trạng thái <strong>PENDING</strong>.
                Vui lòng đăng nhập để theo dõi và xử lý khi cần.
              </p>
              <div style="margin:24px 0;text-align:center">
                <a href="%s" style="display:inline-block;padding:12px 18px;background:#c2410c;color:#fff;text-decoration:none;border-radius:10px;font-weight:700">
                  Xem lời mời trên Bee Academy
                </a>
              </div>
              <p style="font-size:13px;color:#6b7280;line-height:1.6">
                Nếu bạn không mong đợi lời mời này, bạn có thể bỏ qua email. Hệ thống sẽ chỉ cho phép liên kết
                hoàn tất sau khi học sinh xác nhận.
              </p>
            </div>
            """.formatted(greetingName, senderName, notificationUrl);
    }
}

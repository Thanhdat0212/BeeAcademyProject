package com.beeacademy.backend.service;

import com.beeacademy.backend.repository.ProfileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ParentTeacherMessageEmailService {

    private final JavaMailSender mailSender;
    private final ProfileRepository profileRepository;

    @Value("${app.dev-mode:false}")
    private boolean devMode;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    public void notifyTeacher(UUID teacherId, String teacherName, String parentName,
                              String studentName, String courseTitle, String excerpt) {
        profileRepository.findEmailByUserId(teacherId)
                .ifPresent(email -> send(email,
                        "Bee Academy - Phụ huynh gửi tin nhắn mới",
                        buildTeacherHtml(teacherName, parentName, studentName, courseTitle, excerpt)));
    }

    public void notifyParent(UUID parentId, String parentName, String teacherName,
                             String studentName, String courseTitle, String excerpt) {
        profileRepository.findEmailByUserId(parentId)
                .ifPresent(email -> send(email,
                        "Bee Academy - Giáo viên đã phản hồi",
                        buildParentHtml(parentName, teacherName, studentName, courseTitle, excerpt)));
    }

    private void send(String to, String subject, String html) {
        try {
            var message = mailSender.createMimeMessage();
            var helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(html, true);
            mailSender.send(message);
            log.info("Sent parent-teacher message email to {}", to);
        } catch (Exception ex) {
            if (devMode) {
                log.warn("[DEV] Failed to send parent-teacher message email to {}: {}", to, ex.getMessage());
                return;
            }
            log.warn("Failed to send parent-teacher message email to {}: {}", to, ex.getMessage());
        }
    }

    private String buildTeacherHtml(String teacherName, String parentName, String studentName,
                                    String courseTitle, String excerpt) {
        return buildHtml(
                teacherName,
                "Phụ huynh " + safe(parentName, "phụ huynh") + " vừa gửi tin nhắn về học sinh "
                        + safe(studentName, "học sinh") + ".",
                courseTitle,
                excerpt,
                frontendUrl.endsWith("/") ? frontendUrl + "teacher/qa" : frontendUrl + "/teacher/qa");
    }

    private String buildParentHtml(String parentName, String teacherName, String studentName,
                                   String courseTitle, String excerpt) {
        return buildHtml(
                parentName,
                "Giáo viên " + safe(teacherName, "giáo viên") + " vừa phản hồi về học sinh "
                        + safe(studentName, "học sinh") + ".",
                courseTitle,
                excerpt,
                frontendUrl.endsWith("/") ? frontendUrl + "parent/messages" : frontendUrl + "/parent/messages");
    }

    private String buildHtml(String recipientName, String lead, String courseTitle,
                             String excerpt, String url) {
        return """
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;background:#fffaf5;border:1px solid #fde7d9;border-radius:18px;color:#1f2937">
              <h2 style="margin:0 0 8px;color:#9a3412">Bee Academy</h2>
              <p>Xin chào <strong>%s</strong>,</p>
              <p>%s</p>
              <p><strong>Khóa học:</strong> %s</p>
              <blockquote style="margin:16px 0;padding:12px 14px;background:#ffffff;border-left:4px solid #f97316;color:#374151">%s</blockquote>
              <div style="margin:22px 0">
                <a href="%s" style="display:inline-block;padding:12px 18px;background:#c2410c;color:#fff;text-decoration:none;border-radius:10px;font-weight:700">Mở Bee Academy</a>
              </div>
            </div>
            """.formatted(
                safe(recipientName, "bạn"),
                escape(lead),
                escape(safe(courseTitle, "Khóa học")),
                escape(safe(excerpt, "Tin nhắn mới")),
                url);
    }

    private String safe(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private String escape(String value) {
        return safe(value, "")
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");
    }
}

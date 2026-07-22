package com.beeacademy.backend.model;

import com.beeacademy.backend.exception.BusinessException;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.text.Normalizer;
import java.util.Locale;
import java.util.UUID;

@Entity
@Table(name = "qa_messages")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class QaMessage {

    public static final int QA_MESSAGE_RETENTION_MONTHS = 12;
    private static final int MAX_QA_MESSAGE_LENGTH = 5000;

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "thread_id", nullable = false)
    private QaThread thread;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id", nullable = false)
    private Profile author;

    @Convert(converter = UserRoleConverter.class)
    @ColumnTransformer(read = "author_role::text", write = "?::user_role")
    @Column(name = "author_role", nullable = false)
    private UserRole authorRole;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "attachment_url")
    private String attachmentUrl;

    @Column(name = "attachment_name")
    private String attachmentName;

    @Column(name = "attachment_type")
    private String attachmentType;

    @Column(name = "attachment_size_bytes")
    private Long attachmentSizeBytes;

    @Column(name = "moderation_status", nullable = false, length = 30)
    private String moderationStatus;

    @Column(name = "moderation_reason")
    private String moderationReason;

    @Column(name = "retention_until", nullable = false)
    private Instant retentionUntil;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "edited_at")
    private Instant editedAt;

    static QaMessage create(QaThread thread, Profile author, String content) {
        return create(thread, author, content, null, null, null, null);
    }

    static QaMessage create(QaThread thread, Profile author, String content,
                            String attachmentUrl, String attachmentName,
                            String attachmentType, Long attachmentSizeBytes) {
        requireAllowedContent(content, MAX_QA_MESSAGE_LENGTH);
        QaMessage message = new QaMessage();
        message.id = UUID.randomUUID();
        message.thread = thread;
        message.author = author;
        message.authorRole = author.getRole();
        message.content = content.trim();
        message.attachmentUrl = blankToNull(attachmentUrl);
        message.attachmentName = blankToNull(attachmentName);
        message.attachmentType = blankToNull(attachmentType);
        message.attachmentSizeBytes = attachmentSizeBytes;
        message.moderationStatus = moderationStatusFor(content);
        message.moderationReason = "pending_review".equals(message.moderationStatus)
                ? "Message matched safety moderation keyword."
                : null;
        message.retentionUntil = defaultRetentionUntil();
        return message;
    }

    public void updateContent(String content) {
        requireAllowedContent(content, MAX_QA_MESSAGE_LENGTH);
        this.content = content.trim();
        this.moderationStatus = moderationStatusFor(content);
        this.moderationReason = "pending_review".equals(this.moderationStatus)
                ? "Message matched safety moderation keyword."
                : null;
        this.editedAt = Instant.now();
    }

    public static void requireAllowedContent(String content, int maxLength) {
        if (content == null || content.isBlank()) {
            throw new BusinessException(
                    "MESSAGE_CONTENT_REQUIRED",
                    "Vui lòng nhập nội dung tin nhắn.",
                    HttpStatus.BAD_REQUEST);
        }
        String trimmed = content.trim();
        if (trimmed.length() > maxLength) {
            throw new BusinessException(
                    "MESSAGE_TOO_LONG",
                    "Tin nhắn vượt quá giới hạn ký tự cho phép.",
                    HttpStatus.BAD_REQUEST);
        }
        if (containsPolicyViolation(trimmed)) {
            throw new BusinessException(
                    "MESSAGE_POLICY_VIOLATION",
                    "Tin nhắn có nội dung vi phạm chính sách an toàn nên không thể gửi.",
                    HttpStatus.BAD_REQUEST);
        }
    }

    private static Instant defaultRetentionUntil() {
        return OffsetDateTime.now(ZoneOffset.UTC)
                .plusMonths(QA_MESSAGE_RETENTION_MONTHS)
                .toInstant();
    }

    private static String moderationStatusFor(String content) {
        return containsPolicyViolation(content)
                ? "pending_review"
                : "approved";
    }

    private static boolean containsPolicyViolation(String content) {
        String normalized = normalizeForPolicy(content);
        return normalized.contains("spam")
                || normalized.contains("lua dao")
                || normalized.contains("chui")
                || normalized.contains("xuc pham")
                || normalized.contains("kich dong")
                || normalized.contains("bao luc")
                || normalized.contains("tinh duc")
                || normalized.contains("ma tuy")
                || normalized.contains("co bac");
    }

    private static String normalizeForPolicy(String content) {
        String lower = content == null ? "" : content.toLowerCase(Locale.ROOT);
        String decomposed = Normalizer.normalize(lower, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return decomposed.replace('đ', 'd');
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}

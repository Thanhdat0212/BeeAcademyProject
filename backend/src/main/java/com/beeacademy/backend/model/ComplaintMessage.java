package com.beeacademy.backend.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * Một tin nhắn trong thread khiếu nại. Tin đầu tiên là nội dung gốc của
 * người gửi; các tin sau là trao đổi giữa người gửi và Admin.
 */
@Entity
@Table(name = "complaint_messages")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ComplaintMessage {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "complaint_id", nullable = false)
    private Complaint complaint;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id", nullable = false)
    private Profile author;

    @Convert(converter = UserRoleConverter.class)
    @ColumnTransformer(read = "author_role::text", write = "?::user_role")
    @Column(name = "author_role", nullable = false)
    private UserRole authorRole;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "message", fetch = FetchType.LAZY,
               cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC")
    private List<ComplaintAttachment> attachments = new ArrayList<>();

    static ComplaintMessage create(Complaint complaint, Profile author, String content) {
        ComplaintMessage message = new ComplaintMessage();
        message.id = UUID.randomUUID();
        message.complaint = complaint;
        message.author = author;
        message.authorRole = author.getRole();
        message.content = content == null ? "" : content.trim();
        return message;
    }

    public List<ComplaintAttachment> getAttachments() {
        return Collections.unmodifiableList(attachments);
    }

    /** Gắn một file đính kèm đã upload vào tin nhắn này (cascade khi save). */
    public void addAttachment(String storagePath, String fileName,
                              String contentType, long sizeBytes) {
        this.attachments.add(ComplaintAttachment.create(
                this, storagePath, fileName, contentType, sizeBytes));
    }
}

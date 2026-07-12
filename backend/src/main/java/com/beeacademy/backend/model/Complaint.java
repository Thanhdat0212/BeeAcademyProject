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
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * Một thread khiếu nại (UC11 gửi / UC38 xử lý).
 *
 * <p>Cấu trúc thread giống Q&A: tin đầu tiên là nội dung khiếu nại gốc của
 * người gửi, các tin sau là trao đổi qua lại với Admin. {@code category} và
 * {@code priority} lưu dưới dạng chuỗi thường (validate ở DTO) để khớp CHECK
 * constraint Postgres và tránh thêm converter cho mỗi enum nhỏ.
 */
@Entity
@Table(name = "complaints")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Complaint {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id", nullable = false)
    private Profile sender;

    @Convert(converter = UserRoleConverter.class)
    @org.hibernate.annotations.ColumnTransformer(read = "sender_role::text", write = "?::user_role")
    @Column(name = "sender_role", nullable = false)
    private UserRole senderRole;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "category", nullable = false)
    private String category;

    @Column(name = "priority", nullable = false)
    private String priority;

    @Convert(converter = ComplaintStatusConverter.class)
    @Column(name = "status", nullable = false)
    private ComplaintStatus status;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "last_activity_at", nullable = false)
    private Instant lastActivityAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "complaint", fetch = FetchType.LAZY,
               cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC")
    private List<ComplaintMessage> messages = new ArrayList<>();

    public static Complaint create(Profile sender, String title, String category,
                                   String priority, String content) {
        Complaint complaint = new Complaint();
        complaint.id = UUID.randomUUID();
        complaint.sender = sender;
        complaint.senderRole = sender.getRole();
        complaint.title = title.trim();
        complaint.category = category;
        complaint.priority = priority;
        complaint.status = ComplaintStatus.PENDING;
        complaint.lastActivityAt = Instant.now();
        complaint.messages.add(ComplaintMessage.create(complaint, sender, content));
        return complaint;
    }

    public List<ComplaintMessage> getMessages() {
        return Collections.unmodifiableList(messages);
    }

    /** Tin nhắn gốc (đầu tiên) của khiếu nại — để gắn file đính kèm khi tạo. */
    public ComplaintMessage firstMessage() {
        return messages.get(0);
    }

    /**
     * Người gửi bổ sung thông tin. Nếu thread đã đóng (resolved/rejected) mà
     * người gửi thấy chưa thỏa đáng → tự mở lại về đang xử lý ("chat tiếp").
     */
    public ComplaintMessage addSenderMessage(Profile sender, String content) {
        ComplaintMessage message = ComplaintMessage.create(this, sender, content);
        this.messages.add(message);
        if (this.status.isClosed()) {
            this.resolvedAt = null;
        }
        this.status = ComplaintStatus.IN_PROGRESS;
        this.lastActivityAt = Instant.now();
        return message;
    }

    /** Admin phản hồi → chuyển sang đang xử lý (nếu thread chưa đóng). */
    public ComplaintMessage addAdminMessage(Profile admin, String content) {
        ComplaintMessage message = ComplaintMessage.create(this, admin, content);
        this.messages.add(message);
        if (!this.status.isClosed()) {
            this.status = ComplaintStatus.IN_PROGRESS;
        }
        this.lastActivityAt = Instant.now();
        return message;
    }

    /** Admin đổi trạng thái xử lý (UC38). */
    public void changeStatus(ComplaintStatus newStatus) {
        this.status = newStatus;
        this.resolvedAt = newStatus.isClosed() ? Instant.now() : null;
        this.lastActivityAt = Instant.now();
    }
}

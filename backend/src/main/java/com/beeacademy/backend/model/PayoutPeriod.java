package com.beeacademy.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "payout_periods")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PayoutPeriod {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "teacher_id", nullable = false, updatable = false)
    private UUID teacherId;

    @Column(name = "month_year", nullable = false, updatable = false)
    private String monthYear;

    @Convert(converter = PayoutStatusConverter.class)
    @ColumnTransformer(read = "status::text", write = "?::payout_status")
    @Column(name = "status", nullable = false)
    private PayoutStatus status;

    @Column(name = "paid_at")
    private Instant paidAt;

    @Column(name = "paid_by_admin")
    private UUID paidByAdmin;

    @Column(name = "transfer_ref")
    private String transferRef;

    @Column(name = "transfer_content")
    private String transferContent;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public static PayoutPeriod create(UUID teacherId, String monthYear) {
        PayoutPeriod p = new PayoutPeriod();
        p.id = UUID.randomUUID();
        p.teacherId = teacherId;
        p.monthYear = monthYear;
        p.status = PayoutStatus.PENDING;
        return p;
    }

    /**
     * Admin xác nhận đã chuyển khoản thủ công cho GV (UC40).
     * Ghi lại biên lai (mã giao dịch + nội dung) và đánh dấu PAID.
     */
    public void markPaid(UUID adminId, String transferRef, String transferContent) {
        this.status = PayoutStatus.PAID;
        this.paidByAdmin = adminId;
        this.transferRef = transferRef;
        this.transferContent = transferContent;
        this.paidAt = Instant.now();
    }

    public boolean isPaid() {
        return this.status == PayoutStatus.PAID;
    }
}

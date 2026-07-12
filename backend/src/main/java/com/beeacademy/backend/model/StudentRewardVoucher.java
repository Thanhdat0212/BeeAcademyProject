package com.beeacademy.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "student_reward_vouchers")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StudentRewardVoucher {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "student_id", nullable = false, updatable = false)
    private UUID studentId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "voucher_id", nullable = false, updatable = false)
    private RewardVoucher voucher;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private StudentRewardVoucherStatus status;

    @Column(name = "order_id")
    private UUID orderId;

    @Column(name = "redeemed_at", nullable = false)
    private Instant redeemedAt;

    @Column(name = "used_at")
    private Instant usedAt;

    public static StudentRewardVoucher redeem(UUID studentId, RewardVoucher voucher) {
        StudentRewardVoucher studentVoucher = new StudentRewardVoucher();
        studentVoucher.id = UUID.randomUUID();
        studentVoucher.studentId = studentId;
        studentVoucher.voucher = voucher;
        studentVoucher.status = StudentRewardVoucherStatus.AVAILABLE;
        studentVoucher.redeemedAt = Instant.now();
        return studentVoucher;
    }

    public void reserveForOrder(UUID orderId) {
        this.status = StudentRewardVoucherStatus.RESERVED;
        this.orderId = orderId;
    }

    public void releaseReservation(UUID orderId) {
        if (this.status == StudentRewardVoucherStatus.RESERVED
                && this.orderId != null
                && this.orderId.equals(orderId)) {
            this.status = StudentRewardVoucherStatus.AVAILABLE;
            this.orderId = null;
        }
    }

    public void markUsed() {
        this.status = StudentRewardVoucherStatus.USED;
        this.usedAt = Instant.now();
    }
}

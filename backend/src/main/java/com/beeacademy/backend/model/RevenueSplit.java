package com.beeacademy.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "revenue_splits")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RevenueSplit {

    public static final int DEFAULT_TEACHER_PERCENT = 70;

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "teacher_id", nullable = false, updatable = false)
    private UUID teacherId;

    @Column(name = "student_id", nullable = false, updatable = false)
    private UUID studentId;

    @Column(name = "course_id", nullable = false, updatable = false)
    private UUID courseId;

    @Column(name = "order_id", nullable = false, updatable = false)
    private UUID orderId;

    @Column(name = "order_item_id", nullable = false, updatable = false)
    private UUID orderItemId;

    @Column(name = "gross_vnd", nullable = false)
    private int grossVnd;

    @Column(name = "platform_fee_vnd", nullable = false)
    private int platformFeeVnd;

    @Column(name = "teacher_amount_vnd", nullable = false)
    private int teacherAmountVnd;

    @Column(name = "platform_fee_pct", nullable = false)
    private BigDecimal platformFeePct;

    @Column(name = "period", nullable = false)
    private String period;

    @Column(name = "payout_period_id")
    private UUID payoutPeriodId;

    @Column(name = "gross_amount", nullable = false)
    private int grossAmount;

    @Column(name = "platform_fee", nullable = false)
    private int platformFee;

    @Column(name = "teacher_amount", nullable = false)
    private int teacherAmount;

    @Column(name = "teacher_percent", nullable = false)
    private int teacherPercent;

    @Column(name = "occurred_at", nullable = false, updatable = false)
    private Instant occurredAt;

    public static RevenueSplit create(UUID teacherId, UUID studentId, UUID courseId,
                                      UUID orderId, UUID orderItemId,
                                      UUID payoutPeriodId, String period, int grossAmount) {
        RevenueSplit s = new RevenueSplit();
        s.id = UUID.randomUUID();
        s.teacherId = teacherId;
        s.studentId = studentId;
        s.courseId = courseId;
        s.orderId = orderId;
        s.orderItemId = orderItemId;
        s.payoutPeriodId = payoutPeriodId;
        s.period = period;
        s.grossAmount = grossAmount;
        s.teacherPercent = DEFAULT_TEACHER_PERCENT;
        s.teacherAmount = (int) Math.round(grossAmount * DEFAULT_TEACHER_PERCENT / 100.0);
        s.platformFee = grossAmount - s.teacherAmount;
        s.grossVnd = s.grossAmount;
        s.platformFeeVnd = s.platformFee;
        s.teacherAmountVnd = s.teacherAmount;
        s.platformFeePct = BigDecimal.valueOf(100 - DEFAULT_TEACHER_PERCENT);
        s.occurredAt = Instant.now();
        return s;
    }
}

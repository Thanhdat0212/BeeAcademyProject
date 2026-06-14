package com.beeacademy.backend.model;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "orders")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Order {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "total_amount", nullable = false)
    private Integer totalAmount;

    @Convert(converter = OrderStatusConverter.class)
    @ColumnTransformer(read = "status::text", write = "?::order_status")
    @Column(name = "status", nullable = false)
    private OrderStatus status;

    // BEE + first 8 hex chars of UUID — hiển thị cho user
    @Column(name = "payment_ref", nullable = false, unique = true)
    private String paymentRef;

    // Số nguyên duy nhất dùng làm orderCode cho PayOS
    @Column(name = "order_code", unique = true)
    private Long orderCode;

    // ID link thanh toán từ PayOS (dùng để tra cứu/cancel)
    @Column(name = "payment_link_id")
    private String paymentLinkId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "paid_at")
    private Instant paidAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<OrderItem> items = new ArrayList<>();

    public static Order create(UUID userId, Integer totalAmount) {
        Order o = new Order();
        o.id = UUID.randomUUID();
        o.userId = userId;
        o.totalAmount = totalAmount;
        o.status = OrderStatus.PENDING;
        o.paymentRef = "BEE" + o.id.toString().replace("-", "").substring(0, 8).toUpperCase();
        // orderCode: epoch giây * 1000 + 3 chữ số cuối UUID → 13 chữ số, gần như không trùng
        long uuidTail = Math.abs(o.id.getLeastSignificantBits() % 1000);
        o.orderCode = Instant.now().getEpochSecond() * 1000 + uuidTail;
        o.expiresAt = Instant.now().plusSeconds(900); // 15 phút
        return o;
    }

    public void setPaymentLinkId(String paymentLinkId) {
        this.paymentLinkId = paymentLinkId;
    }

    public void markPaid() {
        this.status = OrderStatus.PAID;
        this.paidAt = Instant.now();
    }

    public void markCancelled() {
        this.status = OrderStatus.CANCELLED;
    }

    public boolean isExpired() {
        return Instant.now().isAfter(this.expiresAt) && this.status == OrderStatus.PENDING;
    }
}

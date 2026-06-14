package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.Order;
import com.beeacademy.backend.model.OrderStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record OrderResponse(
    UUID id,
    Long orderCode,
    Integer totalAmount,
    OrderStatus status,
    String paymentRef,
    String checkoutUrl,
    Instant createdAt,
    Instant expiresAt,
    Instant paidAt,
    List<OrderItemResponse> items
) {
    public record OrderItemResponse(UUID courseId, Integer priceAtPurchase) {}

    public static OrderResponse from(Order order, String checkoutUrl) {
        List<OrderItemResponse> items = order.getItems().stream()
            .map(i -> new OrderItemResponse(i.getCourseId(), i.getPriceAtPurchase()))
            .toList();
        return new OrderResponse(
            order.getId(),
            order.getOrderCode(),
            order.getTotalAmount(),
            order.isExpired() ? OrderStatus.EXPIRED : order.getStatus(),
            order.getPaymentRef(),
            checkoutUrl,
            order.getCreatedAt(),
            order.getExpiresAt(),
            order.getPaidAt(),
            items
        );
    }
}

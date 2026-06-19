package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.Order;
import com.beeacademy.backend.model.OrderStatus;
import com.beeacademy.backend.model.Course;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
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
    public record OrderItemResponse(
        UUID courseId,
        Integer priceAtPurchase,
        String courseTitle,
        String thumbnailUrl,
        String teacherName,
        String categoryName,
        List<Integer> grades
    ) {}

    public static OrderResponse from(Order order, String checkoutUrl) {
        return from(order, checkoutUrl, Map.of());
    }

    public static OrderResponse from(Order order, String checkoutUrl, Map<UUID, Course> coursesById) {
        List<OrderItemResponse> items = order.getItems().stream()
            .map(i -> {
                Course course = coursesById.get(i.getCourseId());
                return new OrderItemResponse(
                    i.getCourseId(),
                    i.getPriceAtPurchase(),
                    course != null ? course.getTitle() : "Khóa học",
                    course != null ? course.getThumbnailUrl() : null,
                    course != null && course.getTeacher() != null ? course.getTeacher().getFullName() : null,
                    course != null && course.getCategory() != null ? course.getCategory().getName() : null,
                    course != null ? Arrays.stream(course.getGrades()).boxed().toList() : List.of()
                );
            })
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

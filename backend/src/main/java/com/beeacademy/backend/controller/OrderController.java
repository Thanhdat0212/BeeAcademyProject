package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.CreateOrderRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.OrderResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Quản lý đơn hàng của người dùng đã đăng nhập.
 *
 * <p>Mọi endpoint đều lấy userId từ JWT (CurrentUser) — user chỉ thao tác
 * được trên dữ liệu của chính mình. Bất kỳ role nào (student, teacher, admin)
 * đều có thể tạo order vì giáo viên có thể mua khóa học của người khác.
 *
 * <p>@PreAuthorize("isAuthenticated()") đặt ở class level để đảm bảo mọi
 * method trong controller này đều yêu cầu JWT hợp lệ, ngay cả khi sau này
 * thêm method mới mà quên khai báo auth guard.
 */
@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class OrderController {

    private final OrderService orderService;

    @PostMapping
    public ResponseEntity<ApiResponse<OrderResponse>> createOrder(
            @Valid @RequestBody CreateOrderRequest req) {
        UUID userId = CurrentUser.required().userId();
        OrderResponse order = orderService.createOrder(userId, req);
        return ResponseEntity.ok(ApiResponse.ok(order));
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<ApiResponse<OrderResponse>> getOrder(
            @PathVariable UUID orderId) {
        UUID userId = CurrentUser.required().userId();
        OrderResponse order = orderService.getOrder(orderId, userId);
        return ResponseEntity.ok(ApiResponse.ok(order));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<OrderResponse>>> listOrders() {
        UUID userId = CurrentUser.required().userId();
        return ResponseEntity.ok(ApiResponse.ok(orderService.listOrders(userId)));
    }
}

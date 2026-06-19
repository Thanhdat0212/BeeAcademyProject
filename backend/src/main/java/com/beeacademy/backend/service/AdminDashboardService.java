package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.response.AdminOverviewResponse;
import com.beeacademy.backend.dto.response.AdminOverviewResponse.RecentOrder;
import com.beeacademy.backend.dto.response.AdminOverviewResponse.TopCourse;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseStatus;
import com.beeacademy.backend.model.Order;
import com.beeacademy.backend.model.OrderItem;
import com.beeacademy.backend.model.OrderStatus;
import com.beeacademy.backend.model.PayoutStatus;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.OrderItemRepository;
import com.beeacademy.backend.repository.OrderRepository;
import com.beeacademy.backend.repository.PayoutPeriodRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.RevenueSplitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Tổng hợp số liệu tài chính & vận hành cho Admin Dashboard (UC34).
 *
 * <p>Chỉ đọc — KHÔNG chạy backfill revenue ở đây: backfill là per-teacher
 * và có ghi DB, quét toàn bộ GV trong một request đọc của Admin là quá đắt.
 * Đơn PayOS mới đã được split tự động qua webhook
 * ({@link OrderService#handlePayOSWebhook}), nên thiếu sót chỉ nằm ở
 * enrollment cũ của GV chưa từng mở dashboard — chấp nhận undercount nhẹ.
 */
@Service
@RequiredArgsConstructor
public class AdminDashboardService {

    private static final DateTimeFormatter MONTH_FMT = DateTimeFormatter.ofPattern("yyyy-MM");
    private static final int RECENT_ORDERS_LIMIT = 5;
    private static final int TOP_COURSES_LIMIT = 5;

    private final RevenueSplitRepository splitRepository;
    private final PayoutPeriodRepository periodRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final ProfileRepository profileRepository;
    private final CourseRepository courseRepository;

    @Transactional(readOnly = true)
    public AdminOverviewResponse getOverview() {
        long gmv           = splitRepository.sumAllGrossAmount();
        long platformFee   = splitRepository.sumAllPlatformFee();
        long pendingPayout = splitRepository.sumUnpaidTeacherAmount(PayoutStatus.PAID);

        // Cùng công thức với UC34: tiền công ty đang giữ = quỹ vận hành
        // (platform fee tích lũy) + phần GV chưa kịp chuyển khoản.
        long fundsHeld = platformFee + pendingPayout;

        // Kỳ "trễ hạn" = kỳ chưa PAID của một tháng đã qua. monthYear dùng
        // UTC cho khớp với TeacherRevenueService (cùng MONTH_FMT pattern).
        String currentMonth = ZonedDateTime.now(ZoneOffset.UTC).format(MONTH_FMT);
        long overdueTeachers = periodRepository.countOverdueTeachers(PayoutStatus.PAID, currentMonth);

        return AdminOverviewResponse.builder()
                .totalGmv(gmv)
                .totalPlatformFee(platformFee)
                .totalPendingPayout(pendingPayout)
                .totalFundsHeld(fundsHeld)
                .overdueTeacherCount(overdueTeachers)
                .recentOrders(loadRecentOrders())
                .topCourses(loadTopCourses())
                .build();
    }

    // ========================================================================
    // Private helpers
    // ========================================================================

    /**
     * 5 đơn PAID gần nhất kèm tên học sinh + tên khóa học.
     * Tất cả lookup đều batch (4 query cố định) — không N+1.
     */
    private List<RecentOrder> loadRecentOrders() {
        List<Order> orders = orderRepository.findRecentByStatus(
                OrderStatus.PAID, PageRequest.of(0, RECENT_ORDERS_LIMIT));
        if (orders.isEmpty()) {
            return Collections.emptyList();
        }

        List<UUID> orderIds = orders.stream().map(Order::getId).toList();
        List<OrderItem> items = orderItemRepository.findByOrder_IdIn(orderIds);

        // Map orderId → danh sách courseId trong đơn
        Map<UUID, List<UUID>> courseIdsByOrder = items.stream()
                .collect(Collectors.groupingBy(
                        i -> i.getOrder().getId(),
                        Collectors.mapping(OrderItem::getCourseId, Collectors.toList())));

        // Batch-load tên học sinh + tên khóa học (pattern từ TeacherRevenueService)
        Map<UUID, String> studentNames = profileRepository.findAllById(
                        orders.stream().map(Order::getUserId).distinct().toList())
                .stream()
                .collect(Collectors.toMap(Profile::getId,
                        p -> p.getFullName() != null ? p.getFullName() : "Học viên"));

        Map<UUID, String> courseTitles = courseRepository.findAllById(
                        items.stream().map(OrderItem::getCourseId).distinct().toList())
                .stream()
                .collect(Collectors.toMap(Course::getId, Course::getTitle));

        return orders.stream().map(o -> {
            String titles = courseIdsByOrder.getOrDefault(o.getId(), List.of()).stream()
                    .map(cid -> courseTitles.getOrDefault(cid, "Khóa học"))
                    .collect(Collectors.joining(", "));
            return new RecentOrder(
                    o.getId(),
                    o.getPaymentRef(),
                    studentNames.getOrDefault(o.getUserId(), "Học viên"),
                    titles.isEmpty() ? "Khóa học" : titles,
                    o.getTotalAmount() != null ? o.getTotalAmount() : 0,
                    // paidAt có thể NULL ở dữ liệu cũ — không bao giờ trả null cho FE
                    o.getPaidAt() != null ? o.getPaidAt() : o.getCreatedAt());
        }).toList();
    }

    /** Top 5 khóa PUBLISHED theo enrollment, đã sort giảm dần từ query. */
    private List<TopCourse> loadTopCourses() {
        return courseRepository.findTopByEnrollments(
                        CourseStatus.PUBLISHED, PageRequest.of(0, TOP_COURSES_LIMIT))
                .stream()
                .map(row -> new TopCourse(
                        (UUID) row[0],
                        (String) row[1],
                        row[2] != null ? (String) row[2] : "Giáo viên",
                        row[3] != null ? (String) row[3] : "",
                        ((Number) row[4]).longValue()))
                .toList();
    }
}

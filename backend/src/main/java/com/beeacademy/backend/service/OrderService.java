package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.CreateOrderRequest;
import com.beeacademy.backend.dto.response.OrderResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.*;
import com.beeacademy.backend.repository.*;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final CourseRepository courseRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final TeacherRevenueService teacherRevenueService;
    private final RewardService rewardService;

    @Value("${payos.client-id}")
    private String payosClientId;

    @Value("${payos.api-key}")
    private String payosApiKey;

    @Value("${payos.checksum-key}")
    private String payosChecksumKey;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    private static final String PAYOS_API_URL = "https://api-merchant.payos.vn/v2/payment-requests";

    // PayOS chậm/treo không được giữ request (và connection DB trong pool) vô hạn
    // — trước đây HttpClient.newHttpClient() không có timeout nào.
    private static final java.time.Duration PAYOS_TIMEOUT = java.time.Duration.ofSeconds(8);

    private static final HttpClient PAYOS_HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(PAYOS_TIMEOUT)
            .build();

    @Transactional
    public OrderResponse createOrder(AuthenticatedUser me, CreateOrderRequest req) {
        if (!UserRole.STUDENT.toDbValue().equalsIgnoreCase(me.role())) {
            throw new BusinessException("STUDENT_ONLY_PURCHASE",
                    "Chỉ tài khoản học sinh mới được mua khóa học.",
                    HttpStatus.FORBIDDEN);
        }

        UUID userId = me.userId();
        List<UUID> courseIds = req.courseIds();

        List<Course> courses = courseRepository.findAllById(courseIds);
        if (courses.size() != courseIds.size()) {
            throw new ResourceNotFoundException("Course", "one or more ids not found");
        }

        for (Course course : courses) {
            if (enrollmentRepository.existsByStudentIdAndCourseId(userId, course.getId())) {
                throw new BusinessException("ALREADY_ENROLLED",
                    "Bạn đã sở hữu khóa học: " + course.getTitle());
            }
        }

        int total = courses.stream()
            .mapToInt(c -> c.getSalePriceVnd() != null ? c.getSalePriceVnd() : c.getPriceVnd())
            .sum();

        Order order = Order.create(userId, total);

        try {
            // Save order trước khi gọi PayOS — nếu DB lỗi (schema thiếu cột, constraint)
            // exception sẽ bị bắt ở đây và trả về BusinessException thay vì 500.
            orderRepository.save(order);

            RewardService.AppliedRewardVoucher appliedVoucher = rewardService.reserveVoucherForOrder(
                    userId, req.rewardVoucherId(), order.getId(), total);
            if (appliedVoucher.studentVoucherId() != null) {
                order.applyRewardVoucher(appliedVoucher.studentVoucherId(), appliedVoucher.discountAmount());
                orderRepository.save(order);
            }

            List<OrderItem> orderItems = new ArrayList<>();
            for (Course course : courses) {
                int price = course.getSalePriceVnd() != null ? course.getSalePriceVnd() : course.getPriceVnd();
                orderItems.add(OrderItem.create(order, course.getId(), price));
            }
            orderItemRepository.saveAll(orderItems);
            order.getItems().addAll(orderItems);

            Map<UUID, Course> coursesById = courses.stream()
                    .collect(Collectors.toMap(Course::getId, Function.identity()));

            if (order.getTotalAmount() <= 0) {
                processPaidOrder(order);
                log.info("Reward covered order completely: {}", order.getId());
                return OrderResponse.from(order, null, coursesById);
            }

            String cancelUrl = frontendUrl + "/payment-result?status=cancelled&orderId=" + order.getId();
            String returnUrl = frontendUrl + "/payment-result?status=success&orderId=" + order.getId();

            // Build items list
            List<Map<String, Object>> items = new ArrayList<>();
            for (Course course : courses) {
                int price = course.getSalePriceVnd() != null ? course.getSalePriceVnd() : course.getPriceVnd();
                String name = course.getTitle().length() > 50
                    ? course.getTitle().substring(0, 47) + "..."
                    : course.getTitle();
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("name", name);
                item.put("quantity", 1);
                item.put("price", price);
                items.add(item);
            }

            // Compute HMAC-SHA256 signature — keys in alphabetical order
            String sigData = String.format("amount=%d&cancelUrl=%s&description=%s&orderCode=%d&returnUrl=%s",
                order.getTotalAmount(), cancelUrl, order.getPaymentRef(), order.getOrderCode(), returnUrl);
            String signature = hmacSHA256(sigData, payosChecksumKey);

            // Build request body
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("orderCode", order.getOrderCode());
            body.put("amount", order.getTotalAmount());
            body.put("description", order.getPaymentRef());
            body.put("items", items);
            body.put("returnUrl", returnUrl);
            body.put("cancelUrl", cancelUrl);
            body.put("signature", signature);

            ObjectMapper mapper = new ObjectMapper();
            String bodyJson = mapper.writeValueAsString(body);

            log.debug("PayOS request: {}", bodyJson);

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(PAYOS_API_URL))
                .timeout(PAYOS_TIMEOUT)
                .header("Content-Type", "application/json")
                .header("x-client-id", payosClientId)
                .header("x-api-key", payosApiKey)
                .POST(HttpRequest.BodyPublishers.ofString(bodyJson))
                .build();

            HttpResponse<String> response = PAYOS_HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

            log.debug("PayOS response ({}): {}", response.statusCode(), response.body());

            JsonNode root = mapper.readTree(response.body());

            if (!"00".equals(root.path("code").asText())) {
                String desc = root.path("desc").asText("unknown error");
                throw new RuntimeException("PayOS API error: " + desc);
            }

            String checkoutUrl = root.path("data").path("checkoutUrl").asText();
            String paymentLinkId = root.path("data").path("paymentLinkId").asText(null);

            order.setPaymentLinkId(paymentLinkId);
            orderRepository.save(order);

            log.info("Order created: {} orderCode={} ref={} checkoutUrl={}",
                order.getId(), order.getOrderCode(), order.getPaymentRef(), checkoutUrl);

            return OrderResponse.from(order, checkoutUrl, coursesById);

        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("PayOS createPaymentLink lỗi: {}", e.getMessage(), e);
            throw new BusinessException("PAYMENT_GATEWAY_ERROR",
                "Không thể tạo link thanh toán. Vui lòng thử lại sau.");
        }
    }

    /**
     * Gọi PayOS API kiểm tra trạng thái thanh toán, nếu đã thanh toán thì
     * trigger handlePayOSWebhook để tạo enrollment + đánh dấu order PAID.
     *
     * Dùng khi webhook không đến được (localhost dev, firewall,...).
     * Idempotent — gọi nhiều lần cùng orderId đều an toàn.
     */
    @Transactional
    public OrderResponse verifyPayment(UUID orderId, UUID userId) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new ResourceNotFoundException("Order", orderId));

        if (!order.getUserId().equals(userId)) {
            throw new BusinessException("FORBIDDEN", "Bạn không có quyền xem đơn hàng này");
        }

        if (order.getStatus() == OrderStatus.PAID) {
            return OrderResponse.from(order, null, loadCourseMap(List.of(order)));
        }

        // Bước 1: Gọi PayOS API — lỗi network/JSON đã được nuốt trong fetchPayOSStatus
        // Bước 2: Xử lý enrollment + revenue — tách khỏi try-catch network
        // để lỗi DB không bị nuốt lẫn với lỗi network
        if ("PAID".equals(fetchPayOSStatus(order.getOrderCode()))) {
            handlePayOSWebhook(order.getOrderCode());
        }

        Order refreshed = orderRepository.findById(orderId).orElse(order);
        return OrderResponse.from(refreshed, null, loadCourseMap(List.of(refreshed)));
    }

    /**
     * Đối soát TẤT CẢ đơn PENDING của user với PayOS (fix bug: thanh toán xong
     * nhưng đóng tab/reload app trước khi về trang payment-result → webhook không
     * đến được localhost và verifyPayment không bao giờ chạy → đơn kẹt PENDING,
     * khóa học không mở dù tiền đã thu).
     *
     * <p>Frontend gọi một lần khi app khởi động (CoursesPage). Idempotent —
     * đơn không còn PENDING sẽ bị bỏ qua ngay, không gọi PayOS.
     *
     * @return danh sách đơn có thay đổi trạng thái sau đối soát
     */
    @Transactional
    public List<OrderResponse> reconcilePendingOrders(UUID userId) {
        List<Order> pendingOrders = orderRepository.findByUserIdAndStatus(userId, OrderStatus.PENDING);
        List<Order> updated = new ArrayList<>();

        for (Order order : pendingOrders) {
            if (order.getOrderCode() == null) continue;
            String payosStatus = fetchPayOSStatus(order.getOrderCode());
            if (payosStatus == null) continue; // network lỗi — thử lại lần sau

            switch (payosStatus) {
                case "PAID" -> {
                    handlePayOSWebhook(order.getOrderCode());
                    updated.add(order);
                }
                case "CANCELLED" -> {
                    order.markCancelled();
                    orderRepository.save(order);
                    rewardService.releaseVoucherReservation(
                            order.getRewardVoucherId(), order.getUserId(), order.getId());
                    updated.add(order);
                }
                case "EXPIRED" -> {
                    order.markExpired();
                    orderRepository.save(order);
                    // Giải phóng voucher đang RESERVED — trước đây đơn hết hạn
                    // giữ voucher vĩnh viễn, học sinh không dùng lại được
                    rewardService.releaseVoucherReservation(
                            order.getRewardVoucherId(), order.getUserId(), order.getId());
                    updated.add(order);
                }
                default -> log.debug("Reconcile: order {} vẫn {} trên PayOS",
                        order.getOrderCode(), payosStatus);
            }
        }

        if (updated.isEmpty()) return List.of();
        List<Order> refreshed = updated.stream()
                .map(order -> orderRepository.findById(order.getId()).orElse(order))
                .toList();
        Map<UUID, Course> coursesById = loadCourseMap(refreshed);
        return refreshed.stream()
                .map(order -> OrderResponse.from(order, null, coursesById))
                .toList();
    }

    /**
     * Hỏi PayOS trạng thái thanh toán của một orderCode.
     * Package-private để test stub được (network call).
     *
     * @return status từ PayOS ("PAID"/"PENDING"/"CANCELLED"/"EXPIRED"/...)
     *         hoặc null nếu lỗi network/parse
     */
    String fetchPayOSStatus(long orderCode) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://api-merchant.payos.vn/v2/payment-requests/" + orderCode))
                .timeout(PAYOS_TIMEOUT)
                .header("x-client-id", payosClientId)
                .header("x-api-key", payosApiKey)
                .GET()
                .build();

            HttpResponse<String> response = PAYOS_HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(response.body());

            String payosStatus = root.path("data").path("status").asText("");
            log.info("PayOS status orderCode={} status={}", orderCode, payosStatus);
            return payosStatus;
        } catch (Exception e) {
            log.warn("PayOS status check thất bại cho orderCode {}: {}", orderCode, e.getMessage());
            return null;
        }
    }

    @Transactional(readOnly = true)
    public OrderResponse getOrder(UUID orderId, UUID userId) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new ResourceNotFoundException("Order", orderId));

        if (!order.getUserId().equals(userId)) {
            throw new BusinessException("FORBIDDEN", "Bạn không có quyền xem đơn hàng này");
        }
        return OrderResponse.from(order, null, loadCourseMap(List.of(order)));
    }

    @Transactional
    public OrderResponse cancelOrder(UUID orderId, UUID userId) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new ResourceNotFoundException("Order", orderId));

        if (!order.getUserId().equals(userId)) {
            throw new BusinessException("FORBIDDEN", "Bạn không có quyền hủy đơn hàng này");
        }
        if (order.getStatus() == OrderStatus.PENDING) {
            // RACE FIX: xác nhận với PayOS trước khi hủy. Nếu tiền đã thu mà mình
            // đánh dấu CANCELLED, webhook PAID đến sau sẽ bị bỏ qua (chỉ xử lý PENDING)
            // → user mất tiền mà không có khóa học.
            if (order.getOrderCode() != null
                    && "PAID".equals(fetchPayOSStatus(order.getOrderCode()))) {
                handlePayOSWebhook(order.getOrderCode());
            } else {
                order.markCancelled();
                orderRepository.save(order);
                rewardService.releaseVoucherReservation(order.getRewardVoucherId(), order.getUserId(), order.getId());
            }
        }
        Order refreshed = orderRepository.findById(orderId).orElse(order);
        return OrderResponse.from(refreshed, null, loadCourseMap(List.of(refreshed)));
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> listOrders(UUID userId) {
        List<Order> orders = orderRepository.findByUserIdWithItems(userId);
        Map<UUID, Course> coursesById = loadCourseMap(orders);
        return orders.stream()
            .map(o -> OrderResponse.from(o, null, coursesById))
            .toList();
    }

    private Map<UUID, Course> loadCourseMap(Collection<Order> orders) {
        Set<UUID> courseIds = orders.stream()
                .flatMap(order -> order.getItems().stream())
                .map(OrderItem::getCourseId)
                .collect(Collectors.toSet());

        if (courseIds.isEmpty()) {
            return Map.of();
        }

        return courseRepository.findByIdIn(courseIds).stream()
                .collect(Collectors.toMap(Course::getId, Function.identity()));
    }

    @Transactional
    public void handlePayOSWebhook(long orderCode) {
        // PESSIMISTIC_WRITE: webhook + verify + reconcile có thể chạy đồng thời —
        // khóa row để chỉ 1 transaction xử lý, các transaction sau thấy status != PENDING
        Order order = orderRepository.findByOrderCodeForUpdate(orderCode).orElse(null);

        if (order == null) {
            log.warn("PayOS webhook: không tìm thấy đơn hàng với orderCode={}", orderCode);
            return;
        }

        if (order.getStatus() != OrderStatus.PENDING) {
            log.info("PayOS webhook: đơn hàng {} đã xử lý trước đó (status={})",
                orderCode, order.getStatus());
            return;
        }

        // Không chặn expired khi PayOS đã xác nhận PAID — tiền đã thu, phải cấp quyền truy cập.
        // Order.expiresAt chỉ dùng để ngăn tạo đơn mới, không dùng để từ chối xử lý thanh toán đã hoàn tất.
        if (order.isExpired()) {
            log.warn("PayOS webhook: đơn hàng {} đã hết hạn nhưng vẫn xử lý vì PayOS xác nhận PAID", orderCode);
        }

        processPaidOrder(order);
    }

    private void processPaidOrder(Order order) {
        long orderCode = order.getOrderCode();
        List<OrderItem> items = orderItemRepository.findByOrderId(order.getId());
        for (OrderItem item : items) {
            // Tạo enrollment trước — đây là phần quan trọng nhất
            if (!enrollmentRepository.existsByStudentIdAndCourseId(order.getUserId(), item.getCourseId())) {
                enrollmentRepository.save(Enrollment.create(order.getUserId(), item.getCourseId()));
                log.info("Enrollment created: user={} course={}", order.getUserId(), item.getCourseId());
            }
            // Ghi revenue split riêng — lỗi ở đây không được rollback enrollment
            try {
                Course course = courseRepository.findById(item.getCourseId()).orElse(null);
                if (course == null) {
                    log.warn("Revenue split bỏ qua: course {} không tồn tại", item.getCourseId());
                } else if (course.getTeacher() == null) {
                    log.warn("Revenue split bỏ qua: course {} chưa có giáo viên", item.getCourseId());
                } else {
                    teacherRevenueService.createRevenueSplit(
                            course.getTeacher().getId(), order.getUserId(), item.getCourseId(),
                            order.getId(), item.getId(), item.getPriceAtPurchase());
                }
            } catch (Exception e) {
                log.error("Revenue split thất bại cho order={} course={}: {}",
                        order.getId(), item.getCourseId(), e.getMessage());
            }
        }

        order.markPaid();
        orderRepository.save(order);
        rewardService.markVoucherUsed(order.getRewardVoucherId(), order.getUserId());
        log.info("PayOS webhook: đơn hàng {} thanh toán thành công", orderCode);
    }

    private String hmacSHA256(String data, String key) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] bytes = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}

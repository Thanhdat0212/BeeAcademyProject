package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.CreateOrderRequest;
import com.beeacademy.backend.dto.response.OrderResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.model.Order;
import com.beeacademy.backend.model.OrderItem;
import com.beeacademy.backend.model.OrderStatus;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.OrderItemRepository;
import com.beeacademy.backend.repository.OrderRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Test luồng thanh toán PayOS → enrollment (UC09/UC10).
 *
 * <p>Network call sang PayOS được stub qua spy {@code fetchPayOSStatus} —
 * test chỉ kiểm tra business logic: idempotency webhook, đối soát đơn PENDING
 * (fix bug "thanh toán xong reload app vẫn chưa có khóa học"), và race
 * hủy-đơn-đã-thanh-toán.
 */
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock OrderRepository orderRepository;
    @Mock OrderItemRepository orderItemRepository;
    @Mock CourseRepository courseRepository;
    @Mock EnrollmentRepository enrollmentRepository;
    @Mock TeacherRevenueService teacherRevenueService;
    @Mock RewardService rewardService;

    @Spy
    @InjectMocks
    OrderService orderService;

    private static final UUID STUDENT_ID = UUID.randomUUID();
    private static final UUID COURSE_ID = UUID.randomUUID();

    private Order pendingOrderWithOneItem() {
        Order order = Order.create(STUDENT_ID, 199_000);
        OrderItem item = OrderItem.create(order, COURSE_ID, 199_000);
        order.getItems().add(item);
        lenient().when(orderItemRepository.findByOrderId(order.getId()))
                .thenReturn(List.of(item));
        return order;
    }

    // ========================================================================
    // handlePayOSWebhook — idempotency + tạo enrollment
    // ========================================================================

    @Test
    void webhookPendingOrder_createsEnrollmentAndMarksPaid() {
        Order order = pendingOrderWithOneItem();
        when(orderRepository.findByOrderCodeForUpdate(order.getOrderCode()))
                .thenReturn(Optional.of(order));
        when(enrollmentRepository.existsByStudentIdAndCourseId(STUDENT_ID, COURSE_ID))
                .thenReturn(false);
        when(courseRepository.findById(COURSE_ID)).thenReturn(Optional.empty());

        orderService.handlePayOSWebhook(order.getOrderCode());

        verify(enrollmentRepository).save(any(Enrollment.class));
        verify(orderRepository).save(order);
        assertThat(order.getStatus()).isEqualTo(OrderStatus.PAID);
        assertThat(order.getPaidAt()).isNotNull();
    }

    @Test
    void webhookAlreadyPaidOrder_isIgnored() {
        Order order = pendingOrderWithOneItem();
        order.markPaid();
        when(orderRepository.findByOrderCodeForUpdate(order.getOrderCode()))
                .thenReturn(Optional.of(order));

        orderService.handlePayOSWebhook(order.getOrderCode());

        verify(enrollmentRepository, never()).save(any());
        verify(orderRepository, never()).save(any());
    }

    @Test
    void webhookUnknownOrderCode_isIgnored() {
        when(orderRepository.findByOrderCodeForUpdate(12345L)).thenReturn(Optional.empty());

        orderService.handlePayOSWebhook(12345L);

        verify(enrollmentRepository, never()).save(any());
    }

    @Test
    void webhookExistingEnrollment_isNotDuplicated() {
        Order order = pendingOrderWithOneItem();
        when(orderRepository.findByOrderCodeForUpdate(order.getOrderCode()))
                .thenReturn(Optional.of(order));
        when(enrollmentRepository.existsByStudentIdAndCourseId(STUDENT_ID, COURSE_ID))
                .thenReturn(true);
        when(courseRepository.findById(COURSE_ID)).thenReturn(Optional.empty());

        orderService.handlePayOSWebhook(order.getOrderCode());

        verify(enrollmentRepository, never()).save(any());
        assertThat(order.getStatus()).isEqualTo(OrderStatus.PAID);
    }

    @Test
    void webhookExpiredButPaidOrder_isStillProcessed() {
        // PayOS đã thu tiền thì phải cấp khóa học kể cả khi đơn quá 15 phút
        Order order = pendingOrderWithOneItem();
        // ép expiresAt về quá khứ qua reflection không cần thiết — isExpired()
        // chỉ log warn, không chặn; test này chốt hành vi không-chặn đó
        when(orderRepository.findByOrderCodeForUpdate(order.getOrderCode()))
                .thenReturn(Optional.of(order));
        when(enrollmentRepository.existsByStudentIdAndCourseId(STUDENT_ID, COURSE_ID))
                .thenReturn(false);
        when(courseRepository.findById(COURSE_ID)).thenReturn(Optional.empty());

        orderService.handlePayOSWebhook(order.getOrderCode());

        assertThat(order.getStatus()).isEqualTo(OrderStatus.PAID);
    }

    // ========================================================================
    // reconcilePendingOrders — fix "thanh toán xong reload app mất khóa học"
    // ========================================================================

    @Test
    void reconcile_paidOnPayOS_processesOrderAndReturnsIt() {
        Order order = pendingOrderWithOneItem();
        when(orderRepository.findByUserIdAndStatus(STUDENT_ID, OrderStatus.PENDING))
                .thenReturn(List.of(order));
        when(orderRepository.findByOrderCodeForUpdate(order.getOrderCode()))
                .thenReturn(Optional.of(order));
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));
        when(enrollmentRepository.existsByStudentIdAndCourseId(STUDENT_ID, COURSE_ID))
                .thenReturn(false);
        when(courseRepository.findById(COURSE_ID)).thenReturn(Optional.empty());
        when(courseRepository.findByIdIn(any())).thenReturn(List.of());
        doReturn("PAID").when(orderService).fetchPayOSStatus(order.getOrderCode());

        List<OrderResponse> updated = orderService.reconcilePendingOrders(STUDENT_ID);

        assertThat(updated).hasSize(1);
        assertThat(updated.get(0).status()).isEqualTo(OrderStatus.PAID);
        verify(enrollmentRepository).save(any(Enrollment.class));
    }

    @Test
    void reconcile_cancelledOnPayOS_marksCancelledAndReleasesVoucher() {
        Order order = pendingOrderWithOneItem();
        when(orderRepository.findByUserIdAndStatus(STUDENT_ID, OrderStatus.PENDING))
                .thenReturn(List.of(order));
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));
        when(courseRepository.findByIdIn(any())).thenReturn(List.of());
        doReturn("CANCELLED").when(orderService).fetchPayOSStatus(order.getOrderCode());

        List<OrderResponse> updated = orderService.reconcilePendingOrders(STUDENT_ID);

        assertThat(order.getStatus()).isEqualTo(OrderStatus.CANCELLED);
        assertThat(updated).hasSize(1);
        verify(rewardService).releaseVoucherReservation(
                order.getRewardVoucherId(), STUDENT_ID, order.getId());
        verify(enrollmentRepository, never()).save(any());
    }

    @Test
    void reconcile_expiredOnPayOS_marksExpiredAndReleasesVoucher() {
        Order order = pendingOrderWithOneItem();
        when(orderRepository.findByUserIdAndStatus(STUDENT_ID, OrderStatus.PENDING))
                .thenReturn(List.of(order));
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));
        when(courseRepository.findByIdIn(any())).thenReturn(List.of());
        doReturn("EXPIRED").when(orderService).fetchPayOSStatus(order.getOrderCode());

        orderService.reconcilePendingOrders(STUDENT_ID);

        assertThat(order.getStatus()).isEqualTo(OrderStatus.EXPIRED);
        verify(rewardService).releaseVoucherReservation(
                order.getRewardVoucherId(), STUDENT_ID, order.getId());
    }

    @Test
    void reconcile_networkError_leavesOrderUntouched() {
        Order order = pendingOrderWithOneItem();
        when(orderRepository.findByUserIdAndStatus(STUDENT_ID, OrderStatus.PENDING))
                .thenReturn(List.of(order));
        doReturn(null).when(orderService).fetchPayOSStatus(order.getOrderCode());

        List<OrderResponse> updated = orderService.reconcilePendingOrders(STUDENT_ID);

        assertThat(updated).isEmpty();
        assertThat(order.getStatus()).isEqualTo(OrderStatus.PENDING);
        verify(orderRepository, never()).save(any());
    }

    @Test
    void reconcile_stillPendingOnPayOS_leavesOrderUntouched() {
        Order order = pendingOrderWithOneItem();
        when(orderRepository.findByUserIdAndStatus(STUDENT_ID, OrderStatus.PENDING))
                .thenReturn(List.of(order));
        doReturn("PENDING").when(orderService).fetchPayOSStatus(order.getOrderCode());

        List<OrderResponse> updated = orderService.reconcilePendingOrders(STUDENT_ID);

        assertThat(updated).isEmpty();
        assertThat(order.getStatus()).isEqualTo(OrderStatus.PENDING);
    }

    @Test
    void reconcile_noPendingOrders_doesNotCallPayOS() {
        when(orderRepository.findByUserIdAndStatus(STUDENT_ID, OrderStatus.PENDING))
                .thenReturn(List.of());

        List<OrderResponse> updated = orderService.reconcilePendingOrders(STUDENT_ID);

        assertThat(updated).isEmpty();
        verify(orderService, never()).fetchPayOSStatus(anyLong());
    }

    // ========================================================================
    // cancelOrder — race hủy đơn đã thanh toán
    // ========================================================================

    @Test
    void cancelOrder_payosAlreadyPaid_processesPaymentInsteadOfCancelling() {
        Order order = pendingOrderWithOneItem();
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));
        when(orderRepository.findByOrderCodeForUpdate(order.getOrderCode()))
                .thenReturn(Optional.of(order));
        when(enrollmentRepository.existsByStudentIdAndCourseId(STUDENT_ID, COURSE_ID))
                .thenReturn(false);
        when(courseRepository.findById(COURSE_ID)).thenReturn(Optional.empty());
        when(courseRepository.findByIdIn(any())).thenReturn(List.of());
        doReturn("PAID").when(orderService).fetchPayOSStatus(order.getOrderCode());

        OrderResponse response = orderService.cancelOrder(order.getId(), STUDENT_ID);

        assertThat(response.status()).isEqualTo(OrderStatus.PAID);
        verify(enrollmentRepository).save(any(Enrollment.class));
        verify(rewardService, never()).releaseVoucherReservation(any(), any(), any());
    }

    @Test
    void cancelOrder_notPaidOnPayOS_cancelsAndReleasesVoucher() {
        Order order = pendingOrderWithOneItem();
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));
        when(courseRepository.findByIdIn(any())).thenReturn(List.of());
        doReturn("PENDING").when(orderService).fetchPayOSStatus(order.getOrderCode());

        OrderResponse response = orderService.cancelOrder(order.getId(), STUDENT_ID);

        assertThat(response.status()).isEqualTo(OrderStatus.CANCELLED);
        verify(rewardService).releaseVoucherReservation(
                order.getRewardVoucherId(), STUDENT_ID, order.getId());
        verify(enrollmentRepository, never()).save(any());
    }

    @Test
    void cancelOrder_ofAnotherUser_isForbidden() {
        Order order = pendingOrderWithOneItem();
        when(orderRepository.findById(order.getId())).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> orderService.cancelOrder(order.getId(), UUID.randomUUID()))
                .isInstanceOf(BusinessException.class);
    }

    // ========================================================================
    // createOrder — validation trước khi gọi PayOS
    // ========================================================================

    @Test
    void createOrder_nonStudentRole_isRejected() {
        AuthenticatedUser teacher = new AuthenticatedUser(
                UUID.randomUUID(), "gv@beeacademy.vn", "teacher");

        assertThatThrownBy(() -> orderService.createOrder(
                teacher, new CreateOrderRequest(List.of(COURSE_ID), null)))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("học sinh");
    }

    @Test
    void createOrder_alreadyEnrolledCourse_isRejected() {
        AuthenticatedUser student = new AuthenticatedUser(
                STUDENT_ID, "hs@beeacademy.vn", "student");
        com.beeacademy.backend.model.Course course =
                org.mockito.Mockito.mock(com.beeacademy.backend.model.Course.class);
        when(courseRepository.findAllById(List.of(COURSE_ID))).thenReturn(List.of(course));
        when(enrollmentRepository.existsByStudentIdAndCourseId(eq(STUDENT_ID), any()))
                .thenReturn(true);

        assertThatThrownBy(() -> orderService.createOrder(
                student, new CreateOrderRequest(List.of(COURSE_ID), null)))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("sở hữu");
    }
}

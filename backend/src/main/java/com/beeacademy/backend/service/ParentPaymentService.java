package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.response.ParentPaymentHistoryResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.model.Order;
import com.beeacademy.backend.model.OrderItem;
import com.beeacademy.backend.model.OrderStatus;
import com.beeacademy.backend.model.ParentStudentLinkStatus;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.OrderRepository;
import com.beeacademy.backend.repository.ParentStudentLinkRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ParentPaymentService {

    private static final String INVOICE_SELLER_NAME = "Bee Academy";
    private static final String INVOICE_SELLER_TAX_CODE = "N/A";

    private final ProfileRepository profileRepository;
    private final ParentStudentLinkRepository linkRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final CourseRepository courseRepository;
    private final OrderRepository orderRepository;

    @Transactional(readOnly = true)
    public ParentPaymentHistoryResponse getChildPaymentHistory(AuthenticatedUser me, UUID studentId) {
        return getChildPaymentHistory(me, studentId, null, null, null);
    }

    @Transactional(readOnly = true)
    public ParentPaymentHistoryResponse getChildPaymentHistory(
            AuthenticatedUser me,
            UUID studentId,
            UUID courseFilterId,
            LocalDate from,
            LocalDate to) {
        log.info("Parent {} requested payment history for student {}", me.userId(), studentId);

        Profile student = requireLinkedStudent(me, studentId);
        Profile parent = requireParentProfile(me.userId());
        List<Enrollment> enrollments = enrollmentRepository.findByStudentId(studentId);
        if (courseFilterId != null) {
            enrollments = enrollments.stream()
                    .filter(enrollment -> courseFilterId.equals(enrollment.getCourseId()))
                    .toList();
        }

        if (enrollments.isEmpty()) {
            return new ParentPaymentHistoryResponse(
                    studentId,
                    displayName(student),
                    "",
                    Instant.now(),
                    0L,
                    0,
                    0,
                    0.0,
                    List.of());
        }

        Map<UUID, Enrollment> enrollmentByCourseId = enrollments.stream()
                .collect(Collectors.toMap(
                        Enrollment::getCourseId,
                        enrollment -> enrollment,
                        (left, right) -> left,
                        LinkedHashMap::new));
        List<UUID> courseIds = enrollmentByCourseId.keySet().stream().toList();
        Map<UUID, Course> courseById = courseRepository.findByIdIn(courseIds).stream()
                .collect(Collectors.toMap(Course::getId, Function.identity()));

        List<Order> orders = orderRepository.findParentChildHistoryWithItems(
                List.of(me.userId(), studentId),
                courseIds);
        List<ParentPaymentHistoryResponse.Transaction> transactions = orders.stream()
                .flatMap(order -> order.getItems().stream()
                        .filter(item -> enrollmentByCourseId.containsKey(item.getCourseId()))
                        .map(item -> toParentPaymentTransaction(
                                order,
                                item,
                                parent,
                                student,
                                courseById.get(item.getCourseId()),
                                enrollmentByCourseId.get(item.getCourseId()))))
                .filter(transaction -> isWithinDateRange(transaction.createdAt(), from, to))
                .sorted(Comparator.comparing(
                        ParentPaymentHistoryResponse.Transaction::createdAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();

        long totalPaidAmount = transactions.stream()
                .filter(transaction -> transaction.status() == OrderStatus.PAID)
                .mapToLong(transaction -> transaction.amountVnd() != null ? transaction.amountVnd() : 0)
                .sum();
        int pendingCount = (int) transactions.stream()
                .filter(transaction -> transaction.status() == OrderStatus.PENDING)
                .count();
        double averageProgress = transactions.isEmpty()
                ? 0.0
                : transactions.stream()
                .mapToInt(transaction -> transaction.currentProgressPct() != null ? transaction.currentProgressPct() : 0)
                .average()
                .orElse(0.0);

        return new ParentPaymentHistoryResponse(
                studentId,
                displayName(student),
                resolveGradeLabel(courseById.values().stream().toList()),
                Instant.now(),
                totalPaidAmount,
                transactions.size(),
                pendingCount,
                round1(averageProgress),
                transactions);
    }
    private ParentPaymentHistoryResponse.Transaction toParentPaymentTransaction(
            Order order,
            OrderItem item,
            Profile parent,
            Profile student,
            Course course,
            Enrollment enrollment) {
        String payerRole = order.getUserId().equals(parent.getId()) ? "parent" : "student";
        Profile payer = "parent".equals(payerRole) ? parent : student;
        OrderStatus status = order.isExpired() ? OrderStatus.EXPIRED : order.getStatus();
        Integer progressPct = enrollment != null && enrollment.getProgressPct() != null
                ? enrollment.getProgressPct()
                : 0;
        String courseSuffix = item.getCourseId().toString().substring(0, 8).toUpperCase();

        return new ParentPaymentHistoryResponse.Transaction(
                order.getId(),
                order.getOrderCode(),
                order.getPaymentRef(),
                order.getUserId(),
                displayName(payer, "parent".equals(payerRole) ? "Phụ huynh" : "Học sinh"),
                payerRole,
                item.getCourseId(),
                enrollment != null ? enrollment.getCourseVersionId() : null,
                course != null ? course.getTitle() : "Khóa học",
                course != null && course.getTeacher() != null ? displayName(course.getTeacher(), "Giáo viên") : null,
                course != null && course.getCategory() != null ? course.getCategory().getName() : null,
                course != null ? course.getThumbnailUrl() : null,
                course != null ? Arrays.stream(course.getGrades()).boxed().sorted().toList() : List.of(),
                item.getPriceAtPurchase(),
                status,
                order.getCreatedAt(),
                order.getPaidAt(),
                progressPct,
                order.getPaymentRef() + "-" + courseSuffix,
                new ParentPaymentHistoryResponse.InvoiceInfo(
                        INVOICE_SELLER_NAME,
                        INVOICE_SELLER_TAX_CODE,
                        displayName(payer, "parent".equals(payerRole) ? "Phu huynh" : "Hoc sinh"),
                        "Hoc phi khoa hoc " + (course != null ? course.getTitle() : courseSuffix),
                        "VND",
                        order.getPaidAt() != null ? order.getPaidAt() : order.getCreatedAt()));
    }


    private Profile requireLinkedStudent(AuthenticatedUser me, UUID studentId) {
        boolean linked = linkRepository.existsByIdParentIdAndIdStudentIdAndStatus(
                me.userId(), studentId, ParentStudentLinkStatus.ACTIVE.toDbValue());
        if (!linked) {
            throw new BusinessException(
                    "ACCESS_DENIED",
                    "Bạn không có quyền truy cập báo cáo của học sinh này do chưa liên kết tài khoản.",
                    HttpStatus.FORBIDDEN);
        }
        return profileRepository.findById(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", studentId));
    }

    private Profile requireParentProfile(UUID parentId) {
        return profileRepository.findById(parentId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", parentId));
    }

    private boolean isWithinDateRange(Instant value, LocalDate from, LocalDate to) {
        if (value == null) return false;
        LocalDate date = value.atZone(java.time.ZoneId.systemDefault()).toLocalDate();
        return (from == null || !date.isBefore(from)) && (to == null || !date.isAfter(to));
    }

    private String resolveGradeLabel(List<Course> courses) {
        return courses.stream()
                .flatMap(course -> Arrays.stream(course.getGrades()).boxed())
                .distinct()
                .sorted()
                .map(String::valueOf)
                .collect(Collectors.joining(", "));
    }

    private String displayName(Profile profile) {
        return displayName(profile, "Học sinh");
    }

    private String displayName(Profile profile, String fallback) {
        if (profile == null) return fallback;
        if (profile.getFullName() != null && !profile.getFullName().isBlank()) return profile.getFullName();
        return fallback;
    }

    private double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }
}

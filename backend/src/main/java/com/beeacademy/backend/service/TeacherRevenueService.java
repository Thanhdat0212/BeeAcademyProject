package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.response.PayoutPeriodResponse;
import com.beeacademy.backend.dto.response.RevenueSplitResponse;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.model.Order;
import com.beeacademy.backend.model.OrderItem;
import com.beeacademy.backend.model.OrderStatus;
import com.beeacademy.backend.model.PayoutPeriod;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.RevenueSplit;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.OrderItemRepository;
import com.beeacademy.backend.repository.OrderRepository;
import com.beeacademy.backend.repository.PayoutPeriodRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.RevenueSplitRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TeacherRevenueService {

    private final RevenueSplitRepository splitRepo;
    private final PayoutPeriodRepository periodRepo;
    private final ProfileRepository profileRepo;
    private final CourseRepository courseRepo;
    private final EnrollmentRepository enrollmentRepo;
    private final OrderRepository orderRepo;
    private final OrderItemRepository orderItemRepo;

    private static final DateTimeFormatter MONTH_FMT = DateTimeFormatter.ofPattern("yyyy-MM");

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void createRevenueSplit(UUID teacherId, UUID studentId, UUID courseId,
                                    UUID orderId, UUID orderItemId, int grossAmount) {
        if (splitRepo.existsByOrderItemId(orderItemId)) {
            log.debug("Revenue split da ton tai cho orderItem={}", orderItemId);
            return;
        }

        String monthYear = ZonedDateTime.now(ZoneOffset.UTC).format(MONTH_FMT);
        PayoutPeriod period = periodRepo.findByTeacherIdAndMonthYear(teacherId, monthYear)
                .orElseGet(() -> periodRepo.save(PayoutPeriod.create(teacherId, monthYear)));

        RevenueSplit split = RevenueSplit.create(teacherId, studentId, courseId,
                orderId, orderItemId, period.getId(), period.getMonthYear(), grossAmount);
        splitRepo.save(split);
        log.info("Revenue split created: teacher={} course={} orderItem={} amount={}",
                teacherId, courseId, orderItemId, grossAmount);
    }

    @Transactional
    public void recordEnrollmentRevenue(UUID studentId, Course course) {
        if (course == null || course.getTeacher() == null) return;

        UUID teacherId = course.getTeacher().getId();
        UUID courseId = course.getId();

        OrderItem paidItem = orderItemRepo
                .findPaidItemsByStudentAndCourse(studentId, courseId, OrderStatus.PAID)
                .stream()
                .findFirst()
                .orElse(null);

        UUID orderId;
        UUID orderItemId;
        int amount;
        if (paidItem != null) {
            orderId = paidItem.getOrder().getId();
            orderItemId = paidItem.getId();
            amount = paidItem.getPriceAtPurchase();
        } else {
            amount = course.getEffectivePriceVnd();
            Order order = Order.create(studentId, amount);
            order.markPaid();
            orderRepo.save(order);

            OrderItem item = OrderItem.create(order, courseId, amount);
            orderItemRepo.save(item);
            order.getItems().add(item);
            orderId = order.getId();
            orderItemId = item.getId();
        }

        createRevenueSplit(teacherId, studentId, courseId, orderId, orderItemId, amount);
    }

    @Transactional
    public void backfillEnrollmentRevenue(UUID teacherId) {
        List<Course> courses = courseRepo.findByTeacherId(teacherId);
        if (courses.isEmpty()) return;

        Map<UUID, Course> courseById = courses.stream()
                .collect(Collectors.toMap(Course::getId, c -> c));
        List<UUID> courseIds = new ArrayList<>(courseById.keySet());
        List<Enrollment> enrollments = enrollmentRepo.findByCourseIdIn(courseIds);

        for (Enrollment enrollment : enrollments) {
            Course course = courseById.get(enrollment.getCourseId());
            if (course == null) continue;
            recordEnrollmentRevenue(enrollment.getStudentId(), course);
        }
    }

    @Transactional
    public List<RevenueSplitResponse> getSplits(UUID teacherId) {
        backfillEnrollmentRevenue(teacherId);
        List<RevenueSplit> splits = splitRepo.findByTeacherIdOrderByOccurredAtDesc(teacherId);

        Set<UUID> studentIds = splits.stream().map(RevenueSplit::getStudentId).collect(Collectors.toSet());
        Set<UUID> courseIds = splits.stream().map(RevenueSplit::getCourseId).collect(Collectors.toSet());

        Map<UUID, String> studentNames = profileRepo.findAllById(studentIds).stream()
                .collect(Collectors.toMap(Profile::getId,
                        p -> p.getFullName() != null ? p.getFullName() : "Hoc vien"));
        Map<UUID, String> courseTitles = courseRepo.findAllById(courseIds).stream()
                .collect(Collectors.toMap(Course::getId, Course::getTitle));

        return splits.stream()
                .map(s -> RevenueSplitResponse.from(s,
                        studentNames.getOrDefault(s.getStudentId(), "Hoc vien"),
                        courseTitles.getOrDefault(s.getCourseId(), "Khoa hoc")))
                .toList();
    }

    @Transactional
    public List<PayoutPeriodResponse> getPeriods(UUID teacherId) {
        return periodRepo.findByTeacherIdOrderByMonthYearDesc(teacherId).stream()
                .map(p -> PayoutPeriodResponse.from(
                        p,
                        splitRepo.countByPayoutPeriodId(p.getId()),
                        splitRepo.sumGrossAmountByPeriodId(p.getId()),
                        splitRepo.sumTeacherAmountByPeriodId(p.getId())))
                .toList();
    }
}

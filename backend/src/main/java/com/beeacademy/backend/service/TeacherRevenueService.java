package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.response.PayoutPeriodResponse;
import com.beeacademy.backend.dto.response.RevenueSplitResponse;
import com.beeacademy.backend.dto.response.TeacherStatsResponse;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseStatus;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.jpa.domain.Specification;
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

    // Self-reference qua proxy — cần thiết để @Transactional(REQUIRES_NEW) hoạt động
    // khi gọi createRevenueSplit() từ bên trong cùng bean (tránh self-invocation bypass).
    @Autowired @Lazy
    private TeacherRevenueService self;

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

        // Dùng self proxy để @Transactional(REQUIRES_NEW) hoạt động đúng
        self.createRevenueSplit(teacherId, studentId, courseId, orderId, orderItemId, amount);
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

    @Transactional
    public TeacherStatsResponse getTeacherStats(UUID teacherId) {
        // Backfill trước: đảm bảo mọi enrollment đều có revenue_split tương ứng.
        // Idempotent — gọi nhiều lần an toàn, bỏ qua split đã tồn tại.
        try {
            backfillEnrollmentRevenue(teacherId);
        } catch (Exception e) {
            log.warn("Backfill revenue thất bại cho teacher={}: {}", teacherId, e.getMessage());
        }
        String curMonth  = ZonedDateTime.now(ZoneOffset.UTC).format(MONTH_FMT);
        String prevMonth = getPreviousMonth(curMonth);

        // ── 1. Load toàn bộ splits của GV (dùng lại cho nhiều bước) ─────────────
        List<RevenueSplit> allSplits = splitRepo.findByTeacherIdOrderByOccurredAtDesc(teacherId);

        // ── 2. Đếm học viên duy nhất đã mua (từ splits — không cần enrollments) ──
        // Tránh phụ thuộc vào schema enrollments (có thể chưa migrate student_id).
        long uniqueStudents = allSplits.stream()
                .map(RevenueSplit::getStudentId)
                .distinct()
                .count();

        // ── 3. Map courseId → số lượt mua — dùng cho bar chart ──────────────────
        Map<UUID, Long> courseEnrollmentCounts = allSplits.stream()
                .collect(Collectors.groupingBy(RevenueSplit::getCourseId, Collectors.counting()));

        // ── 4. Revenue splits: doanh thu tháng này / tháng trước ─────────────────
        long curRevenue  = periodRepo.findByTeacherIdAndMonthYear(teacherId, curMonth)
                .map(p -> splitRepo.sumTeacherAmountByPeriodId(p.getId()))
                .orElse(0L);
        long prevRevenue = periodRepo.findByTeacherIdAndMonthYear(teacherId, prevMonth)
                .map(p -> splitRepo.sumTeacherAmountByPeriodId(p.getId()))
                .orElse(0L);

        // ── 5. Lượt bán tháng này / tháng trước ─────────────────────────────────
        long curSales  = periodRepo.findByTeacherIdAndMonthYear(teacherId, curMonth)
                .map(p -> splitRepo.countByPayoutPeriodId(p.getId()))
                .orElse(0L);
        long prevSales = periodRepo.findByTeacherIdAndMonthYear(teacherId, prevMonth)
                .map(p -> splitRepo.countByPayoutPeriodId(p.getId()))
                .orElse(0L);

        // ── 6. Đếm published courses ─────────────────────────────────────────────
        Specification<Course> byTeacher = (root, q, cb) ->
                cb.equal(root.get("teacher").get("id"), teacherId);
        long publishedCount = courseRepo.findAll(byTeacher).stream()
                .filter(c -> c.getStatus() == CourseStatus.PUBLISHED)
                .count();

        // ── 7. 8 giao dịch gần nhất — batch-load names để tránh N+1 ─────────────
        List<RevenueSplit> recentRaw = allSplits.stream().limit(8).toList();

        Set<UUID> studentIds    = recentRaw.stream().map(RevenueSplit::getStudentId).collect(Collectors.toSet());
        Set<UUID> splitCourseIds = recentRaw.stream().map(RevenueSplit::getCourseId).collect(Collectors.toSet());

        Map<UUID, String> studentNames = profileRepo.findAllById(studentIds).stream()
                .collect(Collectors.toMap(Profile::getId,
                        p -> p.getFullName() != null ? p.getFullName() : "Học viên"));
        Map<UUID, String> courseTitles = courseRepo.findAllById(splitCourseIds).stream()
                .collect(Collectors.toMap(Course::getId, Course::getTitle));

        List<RevenueSplitResponse> recentSplits = recentRaw.stream()
                .map(s -> RevenueSplitResponse.from(
                        s,
                        studentNames.getOrDefault(s.getStudentId(), "Học viên"),
                        courseTitles.getOrDefault(s.getCourseId(), "Khóa học")))
                .toList();

        return TeacherStatsResponse.builder()
                .currentMonthRevenue(curRevenue)
                .previousMonthRevenue(prevRevenue)
                .uniqueStudentsTotal(uniqueStudents)
                .currentMonthSalesCount(curSales)
                .previousMonthSalesCount(prevSales)
                .publishedCoursesCount(publishedCount)
                .courseEnrollmentCounts(courseEnrollmentCounts)
                .recentSplits(recentSplits)
                .build();
    }

    /**
     * Tính tháng trước từ chuỗi "yyyy-MM".
     *
     * <p>Ví dụ: "2026-01" → "2025-12", "2026-06" → "2026-05".
     */
    private String getPreviousMonth(String monthYear) {
        // Parse "yyyy-MM" thành year + month, trừ 1 tháng, format lại
        int year  = Integer.parseInt(monthYear.substring(0, 4));
        int month = Integer.parseInt(monthYear.substring(5, 7));
        if (month == 1) { year--; month = 12; }
        else            { month--; }
        return String.format("%04d-%02d", year, month);
    }
}

package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.response.PayoutPeriodResponse;
import com.beeacademy.backend.dto.response.RevenueSplitResponse;
import com.beeacademy.backend.dto.response.TeacherStatsResponse;
import com.beeacademy.backend.model.*;
import com.beeacademy.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TeacherRevenueService {

    private final RevenueSplitRepository splitRepo;
    private final PayoutPeriodRepository periodRepo;
    private final ProfileRepository profileRepo;
    private final CourseRepository courseRepo;

    private static final DateTimeFormatter MONTH_FMT = DateTimeFormatter.ofPattern("yyyy-MM");

    // REQUIRES_NEW: chạy trong transaction riêng, lỗi ở đây không làm rollback enrollment
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void createRevenueSplit(UUID teacherId, UUID studentId, UUID courseId,
                                    UUID orderId, int grossAmount) {
        String monthYear = ZonedDateTime.now(ZoneOffset.UTC).format(MONTH_FMT);

        PayoutPeriod period = periodRepo.findByTeacherIdAndMonthYear(teacherId, monthYear)
                .orElseGet(() -> periodRepo.save(PayoutPeriod.create(teacherId, monthYear)));

        RevenueSplit split = RevenueSplit.create(teacherId, studentId, courseId,
                orderId, period.getId(), grossAmount);
        splitRepo.save(split);
        log.info("Revenue split created: teacher={} course={} amount={}", teacherId, courseId, grossAmount);
    }

    @Transactional(readOnly = true)
    public List<RevenueSplitResponse> getSplits(UUID teacherId) {
        List<RevenueSplit> splits = splitRepo.findByTeacherIdOrderByOccurredAtDesc(teacherId);

        Set<UUID> studentIds = splits.stream().map(RevenueSplit::getStudentId).collect(Collectors.toSet());
        Set<UUID> courseIds  = splits.stream().map(RevenueSplit::getCourseId).collect(Collectors.toSet());

        Map<UUID, String> studentNames = profileRepo.findAllById(studentIds).stream()
                .collect(Collectors.toMap(Profile::getId,
                        p -> p.getFullName() != null ? p.getFullName() : "Học viên"));
        Map<UUID, String> courseTitles = courseRepo.findAllById(courseIds).stream()
                .collect(Collectors.toMap(Course::getId, Course::getTitle));

        return splits.stream()
                .map(s -> RevenueSplitResponse.from(s,
                        studentNames.getOrDefault(s.getStudentId(), "Học viên"),
                        courseTitles.getOrDefault(s.getCourseId(), "Khóa học")))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PayoutPeriodResponse> getPeriods(UUID teacherId) {
        return periodRepo.findByTeacherIdOrderByMonthYearDesc(teacherId).stream()
                .map(p -> PayoutPeriodResponse.from(
                        p,
                        splitRepo.countByPayoutPeriodId(p.getId()),
                        splitRepo.sumGrossAmountByPeriodId(p.getId()),
                        splitRepo.sumTeacherAmountByPeriodId(p.getId())))
                .toList();
    }

    /**
     * Tổng hợp tất cả số liệu cần cho dashboard giáo viên trong 1 query set.
     *
     * <p>Thay vì frontend gọi 3 API riêng rồi tính toán client-side,
     * method này tổng hợp server-side và trả 1 response duy nhất.
     *
     * <p>Luồng xử lý:
     * <ol>
     *   <li>Load toàn bộ revenue_splits của GV một lần.</li>
     *   <li>Từ splits → đếm học viên unique, per-course counts, recent 8 giao dịch.</li>
     *   <li>Từ payout_periods → tính doanh thu tháng này / tháng trước.</li>
     *   <li>Từ courses → đếm published courses.</li>
     * </ol>
     *
     * <p><b>Tại sao KHÔNG dùng enrollmentRepo ở đây:</b>
     * Bảng {@code enrollments} có thể chưa được migrate sang cột {@code student_id}
     * (schema cũ dùng {@code user_id}). Dùng {@code revenue_splits} tránh phụ thuộc
     * vào schema của bảng enrollments — và ngữ nghĩa chính xác hơn (học viên đã trả tiền).
     */
    @Transactional(readOnly = true)
    public TeacherStatsResponse getTeacherStats(UUID teacherId) {
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

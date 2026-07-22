package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.response.CountPointResponse;
import com.beeacademy.backend.dto.response.PayoutPeriodResponse;
import com.beeacademy.backend.dto.response.RevenueSplitResponse;
import com.beeacademy.backend.dto.response.RevenueTrendPointResponse;
import com.beeacademy.backend.dto.response.TeacherStatsResponse;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseStatus;
import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.model.Order;
import com.beeacademy.backend.model.OrderItem;
import com.beeacademy.backend.model.OrderStatus;
import com.beeacademy.backend.model.PayoutPeriod;
import com.beeacademy.backend.model.PayoutStatus;
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
import java.util.Objects;
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
                .findPaidItemsByStudentAndCourse(studentId, courseId, OrderStatus.PAID.toDbValue())
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

        Set<UUID> studentIds = splits.stream().map(RevenueSplit::getStudentId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        Set<UUID> courseIds = splits.stream().map(RevenueSplit::getCourseId)
                .filter(Objects::nonNull).collect(Collectors.toSet());

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

    @Transactional
    public List<PayoutPeriodResponse> getPeriods(UUID teacherId) {
        return periodRepo.findByTeacherIdAndStatusOrderByMonthYearDesc(teacherId, PayoutStatus.PAID).stream()
                .map(p -> PayoutPeriodResponse.from(
                        p,
                        splitRepo.countByPayoutPeriodId(p.getId()),
                        splitRepo.sumGrossAmountByPeriodId(p.getId()),
                        splitRepo.sumTeacherAmountByPeriodId(p.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RevenueSplitResponse> getConfirmedPeriodSplits(UUID teacherId, UUID periodId) {
        PayoutPeriod period = requirePaidTeacherPeriod(teacherId, periodId);
        List<RevenueSplit> splits = splitRepo.findByTeacherIdAndPayoutPeriodIdOrderByOccurredAtDesc(
                teacherId, period.getId());
        Set<UUID> studentIds = splits.stream().map(RevenueSplit::getStudentId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        Set<UUID> courseIds = splits.stream().map(RevenueSplit::getCourseId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
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
    public String exportConfirmedPeriodCsv(UUID teacherId, UUID periodId) {
        PayoutPeriod period = requirePaidTeacherPeriod(teacherId, periodId);
        List<RevenueSplitResponse> rows = getConfirmedPeriodSplits(teacherId, periodId);
        StringBuilder csv = new StringBuilder();
        csv.append('\ufeff');
        csv.append("period,paid_at,paid_by_admin,transfer_ref,transfer_content,unc_attachment_url\n");
        csv.append(escapeCsv(period.getMonthYear())).append(',')
                .append(period.getPaidAt()).append(',')
                .append(period.getPaidByAdmin()).append(',')
                .append(escapeCsv(period.getTransferRef())).append(',')
                .append(escapeCsv(period.getTransferContent())).append(',')
                .append(escapeCsv(period.getUncAttachmentUrl())).append("\n\n");
        csv.append("occurred_at,student_id,student_name,course_id,course_title,gross_amount,platform_fee,teacher_amount,order_item_id\n");
        for (RevenueSplitResponse row : rows) {
            RevenueSplit split = splitRepo.findById(row.id()).orElse(null);
            csv.append(row.occurredAt()).append(',')
                    .append(row.studentId()).append(',')
                    .append(escapeCsv(row.studentName())).append(',')
                    .append(row.courseId()).append(',')
                    .append(escapeCsv(row.courseTitle())).append(',')
                    .append(row.grossAmount()).append(',')
                    .append(row.platformFee()).append(',')
                    .append(row.teacherAmount()).append(',')
                    .append(split != null ? split.getOrderItemId() : "")
                    .append('\n');
        }
        return csv.toString();
    }

    @Transactional(readOnly = true)
    public String exportConfirmedPeriodExcel(UUID teacherId, UUID periodId) {
        PayoutPeriod period = requirePaidTeacherPeriod(teacherId, periodId);
        List<RevenueSplitResponse> rows = getConfirmedPeriodSplits(teacherId, periodId);
        long totalGross = rows.stream().mapToLong(RevenueSplitResponse::grossAmount).sum();
        long totalPlatformFee = rows.stream().mapToLong(RevenueSplitResponse::platformFee).sum();
        long totalTeacherAmount = rows.stream().mapToLong(RevenueSplitResponse::teacherAmount).sum();

        StringBuilder html = new StringBuilder();
        html.append("""
                <html>
                <head>
                  <meta charset="UTF-8">
                  <style>
                    table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
                    th, td { border: 1px solid #999; padding: 6px; }
                    th { background: #f0f0f0; font-weight: bold; }
                    .money { mso-number-format:"#,##0"; }
                  </style>
                </head>
                <body>
                """);
        html.append("<h2>Bee Academy - Bảng kê kỳ chi trả giáo viên đã xác nhận</h2>");
        html.append("<table>");
        appendMetaRow(html, "Kỳ chi trả", period.getMonthYear());
        appendMetaRow(html, "Trạng thái", period.getStatus().name());
        appendMetaRow(html, "Ngày Admin xác nhận chuyển khoản", String.valueOf(period.getPaidAt()));
        appendMetaRow(html, "Admin xác nhận", String.valueOf(period.getPaidByAdmin()));
        appendMetaRow(html, "Mã giao dịch/UNC", period.getTransferRef());
        appendMetaRow(html, "Nội dung chuyển khoản", period.getTransferContent());
        appendMetaRow(html, "File chứng từ UNC", period.getUncAttachmentUrl());
        appendMetaRow(html, "Thời hạn lưu trữ theo SRS", "Tối thiểu 5 năm");
        html.append("</table><br>");

        html.append("<table><thead><tr>")
                .append("<th>Thời điểm giao dịch</th>")
                .append("<th>Mã học sinh</th>")
                .append("<th>Tên học sinh</th>")
                .append("<th>Mã khóa học</th>")
                .append("<th>Tên khóa học</th>")
                .append("<th>Doanh thu gốc</th>")
                .append("<th>Phí nền tảng</th>")
                .append("<th>Tiền giáo viên nhận</th>")
                .append("<th>Mã dòng đơn hàng</th>")
                .append("</tr></thead><tbody>");
        for (RevenueSplitResponse row : rows) {
            RevenueSplit split = splitRepo.findById(row.id()).orElse(null);
            html.append("<tr>")
                    .append(td(row.occurredAt()))
                    .append(td(row.studentId()))
                    .append(td(row.studentName()))
                    .append(td(row.courseId()))
                    .append(td(row.courseTitle()))
                    .append(money(row.grossAmount()))
                    .append(money(row.platformFee()))
                    .append(money(row.teacherAmount()))
                    .append(td(split != null ? split.getOrderItemId() : null))
                    .append("</tr>");
        }
        html.append("<tr>")
                .append("<th colspan=\"5\">Tổng cộng</th>")
                .append(money(totalGross))
                .append(money(totalPlatformFee))
                .append(money(totalTeacherAmount))
                .append("<td></td>")
                .append("</tr>");
        html.append("</tbody></table></body></html>");
        return html.toString();
    }

    private PayoutPeriod requirePaidTeacherPeriod(UUID teacherId, UUID periodId) {
        PayoutPeriod period = periodRepo.findById(periodId)
                .orElseThrow(() -> new com.beeacademy.backend.exception.ResourceNotFoundException(
                        "PayoutPeriod", periodId));
        if (!period.getTeacherId().equals(teacherId) || period.getStatus() != PayoutStatus.PAID) {
            throw new com.beeacademy.backend.exception.BusinessException(
                    "PAYOUT_PERIOD_NOT_CONFIRMED",
                    "Chỉ xem được kỳ thanh toán đã được Admin xác nhận.");
        }
        return period;
    }

    private String escapeCsv(String value) {
        if (value == null) return "";
        String escaped = value.replace("\"", "\"\"");
        return "\"" + escaped + "\"";
    }

    private void appendMetaRow(StringBuilder html, String label, String value) {
        html.append("<tr><th>").append(escapeHtml(label)).append("</th><td>")
                .append(escapeHtml(value)).append("</td></tr>");
    }

    private String td(Object value) {
        return "<td>" + escapeHtml(value != null ? value.toString() : "") + "</td>";
    }

    private String money(long value) {
        return "<td class=\"money\">" + value + "</td>";
    }

    private String escapeHtml(String value) {
        if (value == null) return "";
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
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
                .filter(Objects::nonNull)
                .distinct()
                .count();

        // ── 3. Map courseId → số lượt mua — dùng cho bar chart ──────────────────
        Map<UUID, Long> courseEnrollmentCounts = allSplits.stream()
                .filter(split -> split.getCourseId() != null)
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

        Set<UUID> studentIds = recentRaw.stream().map(RevenueSplit::getStudentId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        Set<UUID> splitCourseIds = recentRaw.stream().map(RevenueSplit::getCourseId)
                .filter(Objects::nonNull).collect(Collectors.toSet());

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
     * Doanh thu theo tháng của giáo viên — cho biểu đồ đường/vùng (UC37).
     *
     * <p>Chỉ đọc: dựa trên revenue_splits đã có. Dashboard/Revenue page gọi
     * {@code getTeacherStats}/{@code getSplits} (đã backfill) cùng lúc nên
     * dữ liệu split đã đầy đủ khi trend được vẽ.
     */
    @Transactional(readOnly = true)
    public List<RevenueTrendPointResponse> getRevenueTrend(UUID teacherId) {
        return splitRepo.findMonthlyRevenueByTeacher(teacherId).stream()
                .map(r -> new RevenueTrendPointResponse(
                        (String) r[0],
                        ((Number) r[1]).longValue(),
                        ((Number) r[2]).longValue(),
                        ((Number) r[3]).longValue(),
                        ((Number) r[4]).longValue()))
                .toList();
    }

    /** Lượt đăng ký theo tháng cho các khóa của giáo viên (UC37). */
    @Transactional(readOnly = true)
    public List<CountPointResponse> getEnrollmentTrend(UUID teacherId) {
        List<UUID> courseIds = courseRepo.findByTeacherId(teacherId).stream()
                .map(Course::getId)
                .toList();
        if (courseIds.isEmpty()) return List.of();
        return enrollmentRepo.enrollmentTrendByCourseIds(courseIds).stream()
                .map(r -> new CountPointResponse((String) r[0], ((Number) r[1]).longValue()))
                .toList();
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

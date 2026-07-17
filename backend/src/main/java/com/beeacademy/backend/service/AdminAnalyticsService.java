package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.response.CountPointResponse;
import com.beeacademy.backend.dto.response.RevenueTrendPointResponse;
import com.beeacademy.backend.model.CourseStatus;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.RevenueSplitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Số liệu time-series & phân bố cho trang Báo cáo & Thống kê của Admin (UC37).
 *
 * <p>Chỉ đọc — tổng hợp trực tiếp bằng các query GROUP BY ở tầng repository,
 * không backfill/ghi DB (khác {@link TeacherRevenueService}). Mỗi phương thức
 * map row {@code Object[]} thô sang DTO record để controller trả JSON gọn.
 */
@Service
@RequiredArgsConstructor
public class AdminAnalyticsService {

    private final RevenueSplitRepository splitRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final ProfileRepository profileRepository;
    private final CourseRepository courseRepository;

    /** GMV / phần GV / phí nền tảng theo tháng (toàn hệ thống). */
    @Transactional(readOnly = true)
    public List<RevenueTrendPointResponse> getRevenueTrend() {
        return splitRepository.findMonthlyRevenueAll().stream()
                .map(r -> new RevenueTrendPointResponse(
                        (String) r[0],
                        ((Number) r[1]).longValue(),
                        ((Number) r[2]).longValue(),
                        ((Number) r[3]).longValue(),
                        ((Number) r[4]).longValue()))
                .toList();
    }

    /** Lượt đăng ký toàn hệ thống theo tháng. */
    @Transactional(readOnly = true)
    public List<CountPointResponse> getEnrollmentTrend() {
        return enrollmentRepository.enrollmentTrendAll().stream()
                .map(r -> new CountPointResponse((String) r[0], ((Number) r[1]).longValue()))
                .toList();
    }

    /** Người dùng mới theo tháng. */
    @Transactional(readOnly = true)
    public List<CountPointResponse> getUserGrowth() {
        return profileRepository.userGrowthByMonth().stream()
                .map(r -> new CountPointResponse((String) r[0], ((Number) r[1]).longValue()))
                .toList();
    }

    /** Số khóa học PUBLISHED theo danh mục. */
    @Transactional(readOnly = true)
    public List<CountPointResponse> getCoursesByCategory() {
        return courseRepository.countByCategory(CourseStatus.PUBLISHED).stream()
                .map(r -> new CountPointResponse((String) r[0], ((Number) r[1]).longValue()))
                .toList();
    }
}

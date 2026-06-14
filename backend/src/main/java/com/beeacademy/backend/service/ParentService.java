package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.response.ChildOverviewResponse;
import com.beeacademy.backend.dto.response.LinkedStudentResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.model.ParentStudentLink;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.QuizAttempt;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.ParentStudentLinkRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.QuizAttemptRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Tầng dịch vụ quản lý các nghiệp vụ liên quan đến Phụ huynh (Parent Portal).
 * 
 * <p>Cung cấp các API liên kết tài khoản con, gỡ liên kết và truy vấn tiến độ học tập của các con.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ParentService {

    private final ProfileRepository profileRepository;
    private final ParentStudentLinkRepository linkRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final QuizAttemptRepository quizAttemptRepository;

    /**
     * Lấy danh sách học sinh (con) đã được liên kết với tài khoản phụ huynh đang đăng nhập.
     * 
     * @param me Thông tin phụ huynh đã xác thực
     * @return Danh sách DTO thông tin tóm tắt các con
     */
    @Transactional(readOnly = true)
    public List<LinkedStudentResponse> getLinkedChildren(AuthenticatedUser me) {
        log.info("Phụ huynh {} truy vấn danh sách con đã liên kết.", me.userId());

        
        List<ParentStudentLink> links = linkRepository.findByIdParentId(me.userId());
        
        // Bảng profiles hiện chưa có cột grade — trả chuỗi rỗng để FE tự xử lý.
        // TODO: thêm cột grade (vd: "Lớp 6") vào bảng profiles khi Module 5 hoàn thiện.
        return links.stream()
                .map(link -> {
                    Profile student = link.getStudent();
                    return LinkedStudentResponse.builder()
                            .id(student.getId())
                            .name(student.getFullName())
                            .avatarUrl(student.getAvatarUrl())
                            .code("")
                            .grade("")   // grade chưa có trong schema — xem TODO ở trên
                            .build();
                })
                .collect(Collectors.toList());
    }

    /**
     * Gỡ bỏ liên kết giám sát tài khoản con.
     * 
     * @param me        Thông tin phụ huynh đã xác thực
     * @param studentId UUID của học sinh cần gỡ liên kết
     */
    @Transactional
    public void unlinkStudent(AuthenticatedUser me, UUID studentId) {
        log.info("Phụ huynh {} yêu cầu gỡ liên kết học sinh {}", me.userId(), studentId);

        // 1. Kiểm tra sự tồn tại của mối liên kết
        ParentStudentLink link = linkRepository.findByIdParentIdAndIdStudentId(me.userId(), studentId)
                .orElseThrow(() -> new BusinessException(
                        "LINK_NOT_FOUND", 
                        "Không tìm thấy thông tin liên kết giữa tài khoản của bạn và học sinh này.", 
                        HttpStatus.NOT_FOUND));

        // 2. Thực hiện gỡ liên kết
        linkRepository.delete(link);
        log.info("Đã gỡ thành công liên kết học sinh {} với phụ huynh {}", studentId, me.userId());
    }

    /**
     * Lấy báo cáo tổng quan tiến trình và điểm số học tập của con (Dashboard).
     * 
     * @param me        Thông tin phụ huynh đã xác thực
     * @param studentId UUID của học sinh
     * @return Báo cáo chi tiết ChildOverviewResponse
     */
    @Transactional(readOnly = true)
    public ChildOverviewResponse getChildOverview(AuthenticatedUser me, UUID studentId) {
        log.info("Phụ huynh {} yêu cầu xem báo cáo tổng quan của con {}", me.userId(), studentId);

        // 1. Kiểm tra xem học sinh này có được liên kết với phụ huynh không
        boolean isLinked = linkRepository.existsByIdParentIdAndIdStudentId(me.userId(), studentId);
        if (!isLinked) {
            throw new BusinessException(
                    "ACCESS_DENIED", 
                    "Bạn không có quyền truy cập báo cáo của học sinh này do chưa liên kết tài khoản.", 
                    HttpStatus.FORBIDDEN);
        }

        // 2. Tải thông tin học sinh
        Profile student = profileRepository.findById(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", studentId));

        String studentName = student.getFullName();

        // 3. Tính toán tiến độ từ enrollments thực tế
        List<Enrollment> enrollments = enrollmentRepository.findByStudentId(studentId);
        int totalCourses = enrollments.size();
        int completed = (int) enrollments.stream()
                .filter(e -> e.getProgressPct() != null && e.getProgressPct() >= 100)
                .count();
        int active = totalCourses - completed;
        double avgProgress = totalCourses == 0 ? 0.0 :
                enrollments.stream()
                        .mapToInt(e -> e.getProgressPct() != null ? e.getProgressPct() : 0)
                        .average()
                        .orElse(0.0);

        // 4. Điểm quiz gần nhất
        Optional<QuizAttempt> latestAttempt = quizAttemptRepository
                .findFirstByStudentIdAndSubmittedAtIsNotNullOrderBySubmittedAtDesc(studentId);
        double latestQuizScore = latestAttempt
                .map(a -> a.getScore() != null ? a.getScore().doubleValue() : 0.0)
                .orElse(0.0);

        return ChildOverviewResponse.builder()
                .studentName(studentName)
                .grade("")
                .avgProgress(Math.round(avgProgress * 10.0) / 10.0)
                .activeCourses(active)
                .completedCourses(completed)
                .latestQuizScore(latestQuizScore)
                .latestExamScore(0.0)
                .weeklyActivityHours(Collections.nCopies(7, 0.0))
                .build();
    }
}

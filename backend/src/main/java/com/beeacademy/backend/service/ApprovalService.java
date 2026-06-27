package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.response.ApprovalHistoryResponse;
import com.beeacademy.backend.dto.response.PendingCourseResponse;
import com.beeacademy.backend.dto.response.PageResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.ApprovalHistory;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseStatus;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.repository.ApprovalHistoryRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Nghiệp vụ duyệt khóa học (Admin Portal — UC36).
 *
 * <p>Ba hành động Admin có thể thực hiện:
 * <ul>
 *   <li>{@link #approve}   — Duyệt, auto-publish.</li>
 *   <li>{@link #reject}    — Từ chối (cần comment).</li>
 *   <li>{@link #revise}    — Yêu cầu GV sửa lại (cần comment).</li>
 * </ul>
 *
 * <p>Mỗi hành động ghi vào {@code course_approval_history} và gửi email
 * thông báo cho GV.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ApprovalService {

    private final CourseRepository          courseRepository;
    private final ProfileRepository         profileRepository;
    private final ApprovalHistoryRepository historyRepository;
    private final UserNotificationService   notificationService;

    // ========================================================================
    // Admin views
    // ========================================================================

    /** Danh sách khóa học đang chờ duyệt (PENDING_REVIEW), sắp xếp cũ trước. */
    @Transactional(readOnly = true)
    public PageResponse<PendingCourseResponse> getPendingCourses(Pageable pageable) {
        Page<Course> page = courseRepository.findPendingReview(CourseStatus.PENDING_REVIEW, pageable);
        return PageResponse.of(page, PendingCourseResponse::fromEntity);
    }

    /** Lịch sử duyệt của một khóa học (timeline). */
    @Transactional(readOnly = true)
    public List<ApprovalHistoryResponse> getHistory(UUID courseId) {
        return historyRepository.findByCourseIdOrderByCreatedAtAsc(courseId)
                .stream().map(ApprovalHistoryResponse::fromEntity).toList();
    }

    // ========================================================================
    // Admin actions
    // ========================================================================

    /** Duyệt khóa học → PUBLISHED. */
    @Transactional
    public void approve(UUID courseId, AuthenticatedUser adminUser, String comment) {
        Course  course = loadPendingCourse(courseId);
        Profile admin  = loadProfile(adminUser.userId());

        course.approve();
        courseRepository.save(course);

        historyRepository.save(ApprovalHistory.create(course, admin, "approved", comment));
        notifyTeacherCourseReviewed(course, "course_approved",
                "Khóa học đã được duyệt",
                "Khóa học \"%s\" đã được duyệt và xuất bản.".formatted(course.getTitle()));
        log.info("Admin {} duyệt khóa học {} → PUBLISHED", adminUser.userId(), courseId);
        // TODO: gửi email thông báo GV khi JavaMailSender sẵn sàng
    }

    /** Từ chối khóa học → REJECTED (bắt buộc có comment). */
    @Transactional
    public void reject(UUID courseId, AuthenticatedUser adminUser, String comment) {
        if (comment == null || comment.isBlank()) {
            throw new BusinessException("COMMENT_REQUIRED",
                    "Vui lòng nhập lý do từ chối.", HttpStatus.BAD_REQUEST);
        }
        Course  course = loadPendingCourse(courseId);
        Profile admin  = loadProfile(adminUser.userId());

        course.reject();
        courseRepository.save(course);

        historyRepository.save(ApprovalHistory.create(course, admin, "rejected", comment));
        notifyTeacherCourseReviewed(course, "course_rejected",
                "Khóa học bị từ chối",
                "Khóa học \"%s\" bị từ chối. Lý do: %s".formatted(course.getTitle(), comment.trim()));
        log.info("Admin {} từ chối khóa học {}", adminUser.userId(), courseId);
    }

    /** Yêu cầu GV sửa lại → NEEDS_REVISION (bắt buộc có comment). */
    @Transactional
    public void revise(UUID courseId, AuthenticatedUser adminUser, String comment) {
        if (comment == null || comment.isBlank()) {
            throw new BusinessException("COMMENT_REQUIRED",
                    "Vui lòng nhập hướng dẫn cần sửa.", HttpStatus.BAD_REQUEST);
        }
        Course  course = loadPendingCourse(courseId);
        Profile admin  = loadProfile(adminUser.userId());

        course.needsRevision();
        courseRepository.save(course);

        historyRepository.save(
                ApprovalHistory.create(course, admin, "needs_revision", comment));
        notifyTeacherCourseReviewed(course, "course_revision_requested",
                "Khóa học cần chỉnh sửa",
                "Khóa học \"%s\" cần chỉnh sửa. Ghi chú: %s".formatted(course.getTitle(), comment.trim()));
        log.info("Admin {} yêu cầu sửa khóa học {}", adminUser.userId(), courseId);
    }

    // ========================================================================
    // Private helpers
    // ========================================================================

    private Course loadPendingCourse(UUID courseId) {
        Course course = courseRepository.findWithCategoryAndTeacherById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course", courseId));
        if (course.getStatus() != CourseStatus.PENDING_REVIEW) {
            throw new BusinessException("INVALID_STATUS",
                    "Khóa học không ở trạng thái chờ duyệt. Trạng thái hiện tại: "
                    + course.getStatus().toDbValue());
        }
        return course;
    }

    private Profile loadProfile(UUID id) {
        return profileRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", id));
    }

    private void notifyTeacherCourseReviewed(Course course, String type, String title, String body) {
        if (course.getTeacher() == null) {
            log.warn("Course {} has no teacher, skip teacher notification {}", course.getId(), type);
            return;
        }
        notificationService.notify(course.getTeacher().getId(), type, title, body, "/teacher/courses");
    }
}

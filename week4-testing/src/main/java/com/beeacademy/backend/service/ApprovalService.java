package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.response.ApprovalHistoryResponse;
import com.beeacademy.backend.dto.response.PageResponse;
import com.beeacademy.backend.dto.response.PendingCourseResponse;
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

@Slf4j
@Service
@RequiredArgsConstructor
public class ApprovalService {

    private final CourseRepository          courseRepository;
    private final ProfileRepository         profileRepository;
    private final ApprovalHistoryRepository historyRepository;

    @Transactional(readOnly = true)
    public PageResponse<PendingCourseResponse> getPendingCourses(Pageable pageable) {
        Page<Course> page = courseRepository.findPendingReview(CourseStatus.PENDING_REVIEW, pageable);
        return PageResponse.of(page, PendingCourseResponse::fromEntity);
    }

    @Transactional(readOnly = true)
    public List<ApprovalHistoryResponse> getHistory(UUID courseId) {
        return historyRepository.findByCourseIdOrderByCreatedAtAsc(courseId)
                .stream().map(ApprovalHistoryResponse::fromEntity).toList();
    }

    @Transactional
    public void approve(UUID courseId, AuthenticatedUser adminUser, String comment) {
        Course  course = loadPendingCourse(courseId);
        Profile admin  = loadProfile(adminUser.userId());

        course.approve();
        courseRepository.save(course);
        historyRepository.save(ApprovalHistory.create(course, admin, "approved", comment));
        log.info("Admin {} duyệt khóa học {} → PUBLISHED", adminUser.userId(), courseId);
    }

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
        log.info("Admin {} từ chối khóa học {}", adminUser.userId(), courseId);
    }

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
        historyRepository.save(ApprovalHistory.create(course, admin, "needs_revision", comment));
        log.info("Admin {} yêu cầu sửa khóa học {}", adminUser.userId(), courseId);
    }

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
}

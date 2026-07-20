package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.UpsertCourseReviewRequest;
import com.beeacademy.backend.dto.request.ModerateCourseReviewRequest;
import com.beeacademy.backend.dto.response.CourseReviewResponse;
import com.beeacademy.backend.dto.response.CourseReviewSummaryResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseReview;
import com.beeacademy.backend.model.CourseReviewModerationStatus;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.CourseReviewRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CourseReviewService {

    private final CourseRepository courseRepository;
    private final CourseReviewRepository courseReviewRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final ProfileRepository profileRepository;
    private final CourseProgressService courseProgressService;
    private final ReviewContentModerationService reviewContentModerationService;
    private final UserNotificationService userNotificationService;

    @Transactional(readOnly = true)
    public CourseReviewSummaryResponse getCourseReviews(UUID courseId, AuthenticatedUser me) {
        ensureCourseExists(courseId);
        List<CourseReviewResponse> reviews = courseReviewRepository
                .findTop20ByCourse_IdAndModerationStatusOrderByUpdatedAtDesc(
                        courseId, CourseReviewModerationStatus.PUBLISHED)
                .stream()
                .map(CourseReviewResponse::fromEntity)
                .toList();

        CourseReviewResponse myReview = null;
        if (me != null) {
            myReview = courseReviewRepository.findByCourse_IdAndStudent_Id(courseId, me.userId())
                    .map(CourseReviewResponse::fromEntity)
                    .orElse(null);
        }

        RatingSummary summary = fallbackSummary(getRatingSummary(courseId), reviews);
        return new CourseReviewSummaryResponse(
                summary.averageRating(),
                summary.reviewCount(),
                myReview,
                reviews
        );
    }

    @Transactional(readOnly = true)
    public CourseReviewSummaryResponse getTeacherCourseReviews(UUID courseId, AuthenticatedUser me) {
        Course course = courseRepository.findWithCategoryAndTeacherById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course", courseId));
        if (course.getTeacher() == null || !course.getTeacher().getId().equals(me.userId())) {
            throw new BusinessException(
                    "TEACHER_COURSE_REVIEW_FORBIDDEN",
                    "Ban khong co quyen xem danh gia cua khoa hoc nay.",
                    HttpStatus.FORBIDDEN
            );
        }

        List<CourseReviewResponse> reviews = courseReviewRepository
                .findTop20ByCourse_IdOrderByUpdatedAtDesc(courseId)
                .stream()
                .map(CourseReviewResponse::fromEntity)
                .toList();

        RatingSummary summary = fallbackSummary(getRatingSummary(courseId), reviews);
        return new CourseReviewSummaryResponse(
                summary.averageRating(),
                summary.reviewCount(),
                null,
                reviews
        );
    }

    @Transactional
    public CourseReviewResponse upsertCourseReview(
            UUID courseId,
            AuthenticatedUser me,
            UpsertCourseReviewRequest request
    ) {
        ensureStudentRole(me);
        if (!enrollmentRepository.existsByStudentIdAndCourseId(me.userId(), courseId)) {
            throw new BusinessException(
                    "COURSE_REVIEW_NOT_ALLOWED",
                    "Bạn cần mua khóa học trước khi gửi đánh giá.",
                    HttpStatus.FORBIDDEN
            );
        }

        int progressPct = courseProgressService
                .calculateLessonProgressForCourses(me.userId(), List.of(courseId))
                .getOrDefault(courseId, 0);
        if (progressPct < 30) {
            throw new BusinessException(
                    "COURSE_REVIEW_PROGRESS_NOT_ELIGIBLE",
                    "Ban can hoan thanh it nhat 30% noi dung khoa hoc truoc khi danh gia.",
                    HttpStatus.FORBIDDEN
            );
        }

        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course", courseId));
        Profile student = profileRepository.findById(me.userId())
                .orElseThrow(() -> new ResourceNotFoundException("Profile", me.userId()));

        CourseReviewModerationStatus moderationStatus = reviewContentModerationService
                .requiresModeration(request.comment())
                ? CourseReviewModerationStatus.PENDING_MODERATION
                : CourseReviewModerationStatus.PUBLISHED;
        CourseReview review = courseReviewRepository.findByCourse_IdAndStudent_Id(courseId, me.userId())
                .map(existing -> {
                    existing.update(request.rating(), request.comment(), moderationStatus);
                    return existing;
                })
                .orElseGet(() -> CourseReview.create(
                        course, student, request.rating(), request.comment(), moderationStatus));

        CourseReview saved = courseReviewRepository.save(review);
        notifyTeacher(course, student, saved.getModerationStatus());
        return CourseReviewResponse.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public List<CourseReviewResponse> getPendingModerationReviews(AuthenticatedUser me) {
        ensureAdminRole(me);
        return courseReviewRepository
                .findTop50ByModerationStatusOrderByUpdatedAtAsc(CourseReviewModerationStatus.PENDING_MODERATION)
                .stream()
                .map(CourseReviewResponse::fromEntity)
                .toList();
    }

    @Transactional
    public CourseReviewResponse moderateReview(UUID reviewId, AuthenticatedUser me,
                                               ModerateCourseReviewRequest request) {
        ensureAdminRole(me);
        CourseReview review = courseReviewRepository.findWithCourseAndStudentById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("CourseReview", reviewId));
        if (review.getModerationStatus() != CourseReviewModerationStatus.PENDING_MODERATION) {
            throw new BusinessException("COURSE_REVIEW_NOT_PENDING_MODERATION",
                    "Danh gia nay khong cho Admin duyet.", HttpStatus.BAD_REQUEST);
        }

        CourseReviewModerationStatus nextStatus = request.decision()
                == ModerateCourseReviewRequest.ModerationDecision.APPROVE
                ? CourseReviewModerationStatus.PUBLISHED
                : CourseReviewModerationStatus.REJECTED;
        if (nextStatus == CourseReviewModerationStatus.REJECTED
                && (request.reason() == null || request.reason().isBlank())) {
            throw new BusinessException(
                    "COURSE_REVIEW_REJECTION_REASON_REQUIRED",
                    "Admin cần nhập lý do khi từ chối đánh giá.",
                    HttpStatus.BAD_REQUEST);
        }
        review.moderate(nextStatus, request.reason(), me.userId());
        CourseReview saved = courseReviewRepository.save(review);
        userNotificationService.notify(
                saved.getStudent().getId(),
                "course_review_moderated",
                nextStatus == CourseReviewModerationStatus.PUBLISHED
                        ? "Danh gia khoa hoc da duoc hien thi"
                        : "Danh gia khoa hoc chua duoc phe duyet",
                nextStatus == CourseReviewModerationStatus.PUBLISHED
                        ? "Danh gia cua ban da duoc phe duyet va hien thi cong khai."
                        : "Danh gia cua ban khong duoc hien thi cong khai."
                        + (saved.getModerationReason() == null ? "" : " Ly do: " + saved.getModerationReason()),
                "/courses/" + saved.getCourse().getId());
        return CourseReviewResponse.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public RatingSummary getRatingSummary(UUID courseId) {
        Object[] raw = courseReviewRepository.summarizeByCourseId(
                courseId, CourseReviewModerationStatus.PUBLISHED);
        if (raw == null || raw.length < 2 || raw[0] == null || raw[1] == null) {
            return new RatingSummary(0.0, 0);
        }
        double average = ((Number) raw[0]).doubleValue();
        long count = ((Number) raw[1]).longValue();
        return new RatingSummary(round1(average), count);
    }

    private void ensureCourseExists(UUID courseId) {
        if (!courseRepository.existsById(courseId)) {
            throw new ResourceNotFoundException("Course", courseId);
        }
    }

    private void ensureStudentRole(AuthenticatedUser me) {
        if (me == null || !"student".equalsIgnoreCase(me.role())) {
            throw new BusinessException(
                    "COURSE_REVIEW_ROLE_NOT_ALLOWED",
                    "Chỉ học sinh mới có thể đánh giá khóa học.",
                    HttpStatus.FORBIDDEN
            );
        }
    }

    private void ensureAdminRole(AuthenticatedUser me) {
        if (me == null || !"admin".equalsIgnoreCase(me.role())) {
            throw new BusinessException("COURSE_REVIEW_MODERATION_FORBIDDEN",
                    "Chi Admin moi co quyen duyet danh gia.", HttpStatus.FORBIDDEN);
        }
    }

    private void notifyTeacher(Course course, Profile student,
                               CourseReviewModerationStatus moderationStatus) {
        if (course.getTeacher() == null) return;
        boolean pending = moderationStatus == CourseReviewModerationStatus.PENDING_MODERATION;
        userNotificationService.notify(
                course.getTeacher().getId(),
                pending ? "course_review_pending_moderation" : "course_review_received",
                pending ? "Co danh gia can kiem duyet" : "Co danh gia khoa hoc moi",
                (student.getFullName() == null ? "Hoc sinh" : student.getFullName())
                        + (pending ? " vua gui danh gia dang cho Admin duyet." : " vua danh gia khoa hoc cua ban."),
                "/teacher/courses/" + course.getId() + "/reviews");
    }

    private double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private RatingSummary fallbackSummary(RatingSummary summary, List<CourseReviewResponse> reviews) {
        if (summary.reviewCount() > 0 || reviews == null || reviews.isEmpty()) {
            return summary;
        }
        double average = reviews.stream()
                .mapToInt(CourseReviewResponse::rating)
                .average()
                .orElse(0.0);
        return new RatingSummary(round1(average), reviews.size());
    }

    public record RatingSummary(double averageRating, long reviewCount) {
    }
}

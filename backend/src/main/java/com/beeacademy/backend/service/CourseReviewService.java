package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.UpsertCourseReviewRequest;
import com.beeacademy.backend.dto.response.CourseReviewResponse;
import com.beeacademy.backend.dto.response.CourseReviewSummaryResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseReview;
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

    @Transactional(readOnly = true)
    public CourseReviewSummaryResponse getCourseReviews(UUID courseId, AuthenticatedUser me) {
        ensureCourseExists(courseId);
        List<CourseReviewResponse> reviews = courseReviewRepository
                .findTop20ByCourse_IdOrderByUpdatedAtDesc(courseId)
                .stream()
                .map(CourseReviewResponse::fromEntity)
                .toList();

        CourseReviewResponse myReview = null;
        if (me != null) {
            myReview = courseReviewRepository.findByCourse_IdAndStudent_Id(courseId, me.userId())
                    .map(CourseReviewResponse::fromEntity)
                    .orElse(null);
        }

        RatingSummary summary = getRatingSummary(courseId);
        return new CourseReviewSummaryResponse(
                summary.averageRating(),
                summary.reviewCount(),
                myReview,
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

        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course", courseId));
        Profile student = profileRepository.findById(me.userId())
                .orElseThrow(() -> new ResourceNotFoundException("Profile", me.userId()));

        CourseReview review = courseReviewRepository.findByCourse_IdAndStudent_Id(courseId, me.userId())
                .map(existing -> {
                    existing.update(request.rating(), request.comment());
                    return existing;
                })
                .orElseGet(() -> CourseReview.create(course, student, request.rating(), request.comment()));

        return CourseReviewResponse.fromEntity(courseReviewRepository.save(review));
    }

    @Transactional(readOnly = true)
    public RatingSummary getRatingSummary(UUID courseId) {
        Object[] raw = courseReviewRepository.summarizeByCourseId(courseId);
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

    private double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    public record RatingSummary(double averageRating, long reviewCount) {
    }
}

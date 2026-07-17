package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.ExamRetakeDecisionRequest;
import com.beeacademy.backend.dto.request.ExamRetakeRequestCreate;
import com.beeacademy.backend.dto.response.ExamRetakeRequestResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.ExamConfig;
import com.beeacademy.backend.model.ExamRetakeRequest;
import com.beeacademy.backend.model.ExamRetakeStatus;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.ExamAttemptRepository;
import com.beeacademy.backend.repository.ExamConfigRepository;
import com.beeacademy.backend.repository.ExamRetakeRequestRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Duyệt mở thêm lượt làm bài kiểm tra (BRULE-RETAKE-001):
 * HS bị RETAKE_LOCKED gửi yêu cầu → GV sở hữu khóa hoặc Admin duyệt/từ chối.
 * Mỗi lần duyệt cộng 1-5 lượt và mở lại cửa sổ làm bài 14 ngày; tối đa
 * {@link #MAX_APPROVALS_PER_EXAM} lần duyệt cho cùng (HS, bài kiểm tra).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExamRetakeService {

    private static final int MAX_APPROVALS_PER_EXAM = 5;
    private static final int MAX_EXTRA_ATTEMPTS_PER_APPROVAL = 5;
    private static final long RETAKE_WINDOW_DAYS = 14L;
    private static final String ROLE_ADMIN = "admin";

    private final ExamRetakeRequestRepository retakeRepository;
    private final ExamConfigRepository examConfigRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final ProfileRepository profileRepository;
    private final UserNotificationService userNotificationService;

    /** Tổng lượt được cộng thêm từ các yêu cầu đã APPROVED. */
    @Transactional(readOnly = true)
    public int extraAttemptsGranted(UUID studentId, UUID examConfigId) {
        return retakeRepository
                .findByStudentIdAndExamConfigIdAndStatus(studentId, examConfigId, ExamRetakeStatus.APPROVED)
                .stream()
                .mapToInt(r -> r.getExtraAttempts() != null ? r.getExtraAttempts() : 0)
                .sum();
    }

    /** Cửa sổ làm bài còn hiệu lực nhờ lần duyệt gần nhất chưa hết hạn. */
    @Transactional(readOnly = true)
    public boolean hasActiveRetakeWindow(UUID studentId, UUID examConfigId) {
        return retakeRepository
                .findByStudentIdAndExamConfigIdAndStatus(studentId, examConfigId, ExamRetakeStatus.APPROVED)
                .stream()
                .anyMatch(r -> r.getRetakeExpireAt() != null
                        && r.getRetakeExpireAt().isAfter(Instant.now()));
    }

    @Transactional
    public ExamRetakeRequestResponse requestRetake(
            UUID courseId, Integer slotIndex, AuthenticatedUser me, ExamRetakeRequestCreate request) {
        ExamConfig config = examConfigRepository
                .findStudentVisibleByCourseIdAndSlotIndex(courseId, slotIndex)
                .orElseThrow(() -> new BusinessException("EXAM_NOT_FOUND",
                        "Chưa có bài kiểm tra cho vị trí này.", HttpStatus.NOT_FOUND));
        if (!enrollmentRepository.existsByStudentIdAndCourseId(me.userId(), courseId)) {
            throw new BusinessException("NOT_ENROLLED",
                    "Bạn chưa sở hữu khóa học này.", HttpStatus.FORBIDDEN);
        }
        if (retakeRepository.existsByStudentIdAndExamConfigIdAndStatus(
                me.userId(), config.getId(), ExamRetakeStatus.PENDING)) {
            throw new BusinessException("RETAKE_REQUEST_PENDING",
                    "Bạn đã có một yêu cầu đang chờ duyệt cho bài kiểm tra này.");
        }
        long approvedCount = retakeRepository
                .findByStudentIdAndExamConfigIdAndStatus(me.userId(), config.getId(), ExamRetakeStatus.APPROVED)
                .size();
        if (approvedCount >= MAX_APPROVALS_PER_EXAM) {
            throw new BusinessException("RETAKE_APPROVAL_LIMIT",
                    "Bài kiểm tra này đã được duyệt mở thêm lượt tối đa %d lần."
                            .formatted(MAX_APPROVALS_PER_EXAM));
        }

        Profile student = profileRepository.findById(me.userId())
                .orElseThrow(() -> new ResourceNotFoundException("Profile", me.userId()));
        ExamRetakeRequest saved = retakeRepository.save(
                ExamRetakeRequest.create(student, config, request.reason().trim()));

        notifyTeacherAboutRequest(config, student);
        log.info("Student {} requested exam retake for config {}", me.userId(), config.getId());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public Optional<ExamRetakeRequestResponse> getLatestRequest(
            UUID courseId, Integer slotIndex, AuthenticatedUser me) {
        return examConfigRepository.findStudentVisibleByCourseIdAndSlotIndex(courseId, slotIndex)
                .flatMap(config -> retakeRepository
                        .findFirstByStudentIdAndExamConfigIdOrderByCreatedAtDesc(me.userId(), config.getId()))
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public List<ExamRetakeRequestResponse> listPendingForReviewer(AuthenticatedUser me) {
        List<ExamRetakeRequest> requests = ROLE_ADMIN.equals(me.role())
                ? retakeRepository.findByStatusOrderByCreatedAtAsc(ExamRetakeStatus.PENDING)
                : retakeRepository.findByExamConfigCourseTeacherIdAndStatusOrderByCreatedAtAsc(
                        me.userId(), ExamRetakeStatus.PENDING);
        return requests.stream().map(this::toResponse).toList();
    }

    @Transactional
    public ExamRetakeRequestResponse decide(
            UUID requestId, AuthenticatedUser me, ExamRetakeDecisionRequest decision) {
        ExamRetakeRequest request = retakeRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("ExamRetakeRequest", requestId));
        if (request.getStatus() != ExamRetakeStatus.PENDING) {
            throw new BusinessException("RETAKE_ALREADY_DECIDED",
                    "Yêu cầu này đã được xử lý trước đó.");
        }
        requireReviewerPermission(request, me);

        if (Boolean.TRUE.equals(decision.approve())) {
            int extra = decision.extraAttempts() != null ? decision.extraAttempts() : 1;
            if (extra < 1 || extra > MAX_EXTRA_ATTEMPTS_PER_APPROVAL) {
                throw new BusinessException("INVALID_EXTRA_ATTEMPTS",
                        "Số lượt mở thêm phải từ 1 đến %d.".formatted(MAX_EXTRA_ATTEMPTS_PER_APPROVAL));
            }
            long approvedCount = retakeRepository
                    .findByStudentIdAndExamConfigIdAndStatus(
                            request.getStudent().getId(),
                            request.getExamConfig().getId(),
                            ExamRetakeStatus.APPROVED)
                    .size();
            if (approvedCount >= MAX_APPROVALS_PER_EXAM) {
                throw new BusinessException("RETAKE_APPROVAL_LIMIT",
                        "Đã đạt tối đa %d lần duyệt cho bài kiểm tra này."
                                .formatted(MAX_APPROVALS_PER_EXAM));
            }
            request.approve(me.userId(), extra, decision.reason().trim(),
                    Instant.now().plus(RETAKE_WINDOW_DAYS, ChronoUnit.DAYS));
        } else {
            request.reject(me.userId(), decision.reason().trim());
        }
        ExamRetakeRequest saved = retakeRepository.save(request);

        notifyStudentAboutDecision(saved);
        log.info("Reviewer {} ({}) {} retake request {}",
                me.userId(), me.role(), saved.getStatus(), saved.getId());
        return toResponse(saved);
    }

    private void requireReviewerPermission(ExamRetakeRequest request, AuthenticatedUser me) {
        if (ROLE_ADMIN.equals(me.role())) {
            return;
        }
        Profile teacher = request.getExamConfig().getCourse().getTeacher();
        if (teacher == null || !teacher.getId().equals(me.userId())) {
            throw new BusinessException("FORBIDDEN",
                    "Chỉ giáo viên sở hữu khóa học hoặc Admin mới được duyệt yêu cầu này.",
                    HttpStatus.FORBIDDEN);
        }
    }

    private void notifyTeacherAboutRequest(ExamConfig config, Profile student) {
        if (config.getCourse() == null || config.getCourse().getTeacher() == null) {
            return;
        }
        String studentName = student.getFullName() == null || student.getFullName().isBlank()
                ? "Học sinh" : student.getFullName().trim();
        try {
            userNotificationService.notify(
                    config.getCourse().getTeacher().getId(),
                    "exam_retake_request",
                    "Yêu cầu mở thêm lượt làm bài",
                    "%s xin mở thêm lượt làm bài kiểm tra \"%s\".".formatted(studentName, config.getName()),
                    "/teacher/grades");
        } catch (Exception ex) {
            log.warn("Could not notify teacher about retake request", ex);
        }
    }

    private void notifyStudentAboutDecision(ExamRetakeRequest request) {
        boolean approved = request.getStatus() == ExamRetakeStatus.APPROVED;
        String examName = request.getExamConfig().getName();
        String body = approved
                ? "Yêu cầu mở thêm lượt cho bài \"%s\" đã được duyệt: +%d lượt, hạn làm lại 14 ngày."
                        .formatted(examName, request.getExtraAttempts())
                : "Yêu cầu mở thêm lượt cho bài \"%s\" bị từ chối: %s"
                        .formatted(examName, request.getDecidedReason());
        try {
            userNotificationService.notify(
                    request.getStudent().getId(),
                    "exam_retake_decision",
                    approved ? "Đã duyệt mở thêm lượt làm bài" : "Yêu cầu mở lượt bị từ chối",
                    body,
                    "/courses/%s/exams/%d".formatted(
                            request.getExamConfig().getCourse().getId(),
                            request.getExamConfig().getSlotIndex()));
        } catch (Exception ex) {
            log.warn("Could not notify student about retake decision", ex);
        }
    }

    private ExamRetakeRequestResponse toResponse(ExamRetakeRequest request) {
        int attemptsUsed = examAttemptRepository.countByStudentIdAndExamConfigIdAndSubmittedAtIsNotNull(
                request.getStudent().getId(), request.getExamConfig().getId());
        int maxAttempts = request.getExamConfig().getMaxAttempts() != null
                ? request.getExamConfig().getMaxAttempts() : 1;
        return ExamRetakeRequestResponse.fromEntity(request, attemptsUsed, maxAttempts);
    }
}

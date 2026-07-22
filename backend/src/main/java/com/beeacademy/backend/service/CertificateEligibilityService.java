package com.beeacademy.backend.service;

import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.model.ExamAttempt;
import com.beeacademy.backend.model.ExamConfig;
import com.beeacademy.backend.repository.CourseProgressItemRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.ExamAttemptRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** Single source of truth for the UC20 certificate gate. */
@Service
@RequiredArgsConstructor
public class CertificateEligibilityService {

    private static final int REQUIRED_EXAM_COUNT = 4;
    private static final int FINAL_EXAM_SLOT_INDEX = 3;

    private final ExamConfigVersionService examConfigVersionService;
    private final ExamAttemptRepository examAttemptRepository;
    private final CourseProgressItemRepository progressItemRepository;
    private final CourseRepository courseRepository;
    private final CourseVersionSnapshotService courseVersionSnapshotService;

    @Transactional(readOnly = true)
    public Eligibility evaluate(Enrollment enrollment) {
        List<ExamConfig> requiredConfigs = requiredConfigs(enrollment);
        Set<UUID> requiredConfigIds = requiredConfigs.stream()
                .map(ExamConfig::getId)
                .collect(Collectors.toSet());
        boolean hasAllRequiredExamSlots = requiredConfigs.stream()
                .map(ExamConfig::getSlotIndex)
                .distinct()
                .count() == REQUIRED_EXAM_COUNT;
        Set<UUID> passedConfigIds = hasAllRequiredExamSlots
                ? Set.copyOf(examAttemptRepository.findPassedRequiredExamConfigIds(
                        enrollment.getStudentId(), requiredConfigIds))
                : Set.of();

        UUID finalExamConfigId = requiredConfigs.stream()
                .filter(config -> FINAL_EXAM_SLOT_INDEX == config.getSlotIndex())
                .map(ExamConfig::getId)
                .findFirst()
                .orElse(null);
        ExamAttempt bestFinalAttempt = finalExamConfigId == null
                ? null
                : examAttemptRepository.findPassedAttemptsForConfig(
                                enrollment.getStudentId(), finalExamConfigId)
                        .stream()
                        .findFirst()
                        .orElse(null);

        boolean allRequiredExamsPassed = hasAllRequiredExamSlots
                && passedConfigIds.containsAll(requiredConfigIds);
        return new Eligibility(
                hasCompletedCourse(enrollment),
                allRequiredExamsPassed,
                bestFinalAttempt != null,
                bestFinalAttempt,
                Set.copyOf(requiredConfigIds));
    }

    @Transactional(readOnly = true)
    public boolean isFinalExamAttempt(Enrollment enrollment, ExamAttempt attempt) {
        if (attempt == null || attempt.getExamConfig() == null) {
            return false;
        }
        return requiredConfigs(enrollment).stream()
                .filter(config -> FINAL_EXAM_SLOT_INDEX == config.getSlotIndex())
                .anyMatch(config -> config.getId().equals(attempt.getExamConfig().getId()));
    }

    @Transactional(readOnly = true)
    public boolean isRequiredExamAttempt(Enrollment enrollment, ExamAttempt attempt) {
        if (attempt == null || attempt.getExamConfig() == null) {
            return false;
        }
        return requiredConfigs(enrollment).stream()
                .anyMatch(config -> config.getId().equals(attempt.getExamConfig().getId()));
    }

    private List<ExamConfig> requiredConfigs(Enrollment enrollment) {
        List<ExamConfig> configs = examConfigVersionService.forEnrollment(enrollment).stream()
                .filter(config -> config.getSlotIndex() != null)
                .filter(config -> config.getSlotIndex() >= 0
                        && config.getSlotIndex() < REQUIRED_EXAM_COUNT)
                .toList();
        return configs;
    }

    private boolean hasCompletedCourse(Enrollment enrollment) {
        long fallback = courseRepository.countProgressItemsByCourseId(enrollment.getCourseId());
        long total = courseVersionSnapshotService.findMetrics(enrollment.getCourseVersionId())
                .map(metrics -> metrics.quizSnapshotPresent()
                        ? (long) metrics.progressItemCount()
                        : (long) metrics.lessonIds().size()
                          + Math.max(0L, fallback - metrics.lessonIds().size()))
                .orElse(fallback);
        if (total <= 0) {
            return false;
        }
        long completed = Math.min(
                progressItemRepository.countByStudentIdAndCourseId(
                        enrollment.getStudentId(), enrollment.getCourseId()),
                total);
        return completed >= total;
    }

    public record Eligibility(
            boolean courseCompleted,
            boolean allRequiredExamsPassed,
            boolean finalExamPassed,
            ExamAttempt bestFinalAttempt,
            Set<UUID> requiredExamConfigIds) {

        public boolean eligible() {
            return courseCompleted && allRequiredExamsPassed;
        }
    }
}

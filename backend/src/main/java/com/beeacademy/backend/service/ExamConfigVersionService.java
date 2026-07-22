package com.beeacademy.backend.service;

import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.model.ExamConfig;
import com.beeacademy.backend.repository.CourseVersionRepository;
import com.beeacademy.backend.repository.ExamConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Keeps the editable exam set separate from configurations frozen per course version. */
@Service
@RequiredArgsConstructor
public class ExamConfigVersionService {

    private final ExamConfigRepository examConfigRepository;
    private final CourseVersionRepository courseVersionRepository;
    private final CourseVersionSnapshotService courseVersionSnapshotService;

    @Transactional(readOnly = true)
    public List<ExamConfig> currentForAuthoring(UUID courseId) {
        List<ExamConfig> drafts = drafts(courseId);
        if (!drafts.isEmpty()) {
            return drafts;
        }

        List<ExamConfig> latestVersion = courseVersionRepository
                .findByCourseIdOrderByVersionNoDesc(courseId).stream()
                .findFirst()
                .map(version -> examConfigRepository
                        .findByCourseIdAndCourseVersionIdAndDraftFalseOrderBySlotIndexAsc(
                                courseId, version.getId()))
                .orElse(List.of());
        if (!latestVersion.isEmpty()) {
            return latestVersion;
        }
        return legacy(courseId);
    }

    @Transactional(readOnly = true)
    public Optional<ExamConfig> currentForAuthoring(UUID courseId, Integer slotIndex) {
        return currentForAuthoring(courseId).stream()
                .filter(config -> slotIndex.equals(config.getSlotIndex()))
                .findFirst();
    }

    /**
     * Materializes a complete editable copy when the current set is already
     * frozen. Existing draft rows are returned unchanged.
     */
    @Transactional
    public List<ExamConfig> ensureDraftSet(UUID courseId) {
        List<ExamConfig> existingDrafts = drafts(courseId);
        if (!existingDrafts.isEmpty()) {
            return existingDrafts;
        }
        List<ExamConfig> source = currentForAuthoring(courseId);
        if (source.isEmpty()) {
            return List.of();
        }
        return sort(examConfigRepository.saveAll(source.stream()
                .map(ExamConfig::copyAsDraft)
                .toList()));
    }

    @Transactional
    public List<ExamConfig> publishDrafts(UUID courseId, UUID courseVersionId) {
        List<ExamConfig> configs = drafts(courseId);
        configs.forEach(config -> config.assignCourseVersion(courseVersionId));
        return sort(examConfigRepository.saveAll(configs));
    }

    /** Resolves exactly the exam set captured by the student's enrollment version. */
    @Transactional(readOnly = true)
    public List<ExamConfig> forEnrollment(Enrollment enrollment) {
        UUID courseId = enrollment.getCourseId();
        UUID courseVersionId = enrollment.getCourseVersionId();
        if (courseVersionId != null) {
            List<ExamConfig> snapshotConfigs = courseVersionSnapshotService.findMetrics(courseVersionId)
                    .filter(metrics -> !metrics.requiredExamIds().isEmpty())
                    .map(metrics -> examConfigRepository.findAllById(metrics.requiredExamIds()).stream()
                            .filter(config -> courseId.equals(config.getCourse().getId()))
                            .filter(config -> !config.isDraft())
                            .toList())
                    .orElse(List.of());
            if (!snapshotConfigs.isEmpty()) {
                return sort(snapshotConfigs);
            }

            List<ExamConfig> versioned = examConfigRepository
                    .findByCourseIdAndCourseVersionIdAndDraftFalseOrderBySlotIndexAsc(
                            courseId, courseVersionId);
            if (!versioned.isEmpty()) {
                return versioned;
            }
        }
        return legacy(courseId);
    }

    @Transactional(readOnly = true)
    public Optional<ExamConfig> forEnrollment(Enrollment enrollment, Integer slotIndex) {
        return forEnrollment(enrollment).stream()
                .filter(config -> slotIndex.equals(config.getSlotIndex()))
                .findFirst();
    }

    private List<ExamConfig> drafts(UUID courseId) {
        return examConfigRepository.findByCourseIdAndDraftTrueOrderBySlotIndexAsc(courseId);
    }

    private List<ExamConfig> legacy(UUID courseId) {
        return examConfigRepository
                .findByCourseIdAndCourseVersionIdIsNullAndDraftFalseOrderBySlotIndexAsc(courseId);
    }

    private List<ExamConfig> sort(List<ExamConfig> configs) {
        return configs.stream()
                .sorted(Comparator.comparing(ExamConfig::getSlotIndex))
                .toList();
    }
}

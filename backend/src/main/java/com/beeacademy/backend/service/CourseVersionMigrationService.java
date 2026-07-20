package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.CourseVersionMigrationRequest;
import com.beeacademy.backend.dto.response.CourseVersionMigrationResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Certificate;
import com.beeacademy.backend.model.CertificateStatus;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseProgressItem;
import com.beeacademy.backend.model.CourseVersion;
import com.beeacademy.backend.model.CourseVersionMigrationLog;
import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.model.ParentStudentLinkStatus;
import com.beeacademy.backend.model.QuizConfig;
import com.beeacademy.backend.repository.CertificateRepository;
import com.beeacademy.backend.repository.CourseProgressItemRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.CourseVersionMigrationLogRepository;
import com.beeacademy.backend.repository.CourseVersionRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.ParentStudentLinkRepository;
import com.beeacademy.backend.repository.QuizConfigRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CourseVersionMigrationService {

    private static final String CERTIFICATE_NEEDS_REVIEW = "MARK_NEEDS_REVIEW";

    private final CourseRepository courseRepository;
    private final CourseVersionRepository courseVersionRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final CourseProgressItemRepository progressRepository;
    private final QuizConfigRepository quizConfigRepository;
    private final CertificateRepository certificateRepository;
    private final CourseVersionMigrationLogRepository migrationLogRepository;
    private final ParentStudentLinkRepository parentLinkRepository;
    private final TeacherAccessService teacherAccessService;
    private final UserNotificationService notificationService;
    private final ObjectMapper objectMapper;

    @Transactional
    public CourseVersionMigrationResponse migrate(
            UUID courseId,
            CourseVersionMigrationRequest request,
            AuthenticatedUser actor) {
        Course course = courseRepository.findWithCategoryAndTeacherById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course", courseId));
        requireMigrationPermission(course, actor);

        CourseVersion targetVersion = courseVersionRepository.findById(request.targetCourseVersionId())
                .filter(version -> version.getCourse().getId().equals(courseId))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "CourseVersion", request.targetCourseVersionId()));
        if (!targetVersion.isApproved()) {
            throw new BusinessException(
                    "TARGET_VERSION_NOT_APPROVED",
                    "Chỉ có thể chuyển học sinh sang phiên bản đã được Admin duyệt.",
                    HttpStatus.CONFLICT);
        }

        List<UUID> requestedStudentIds = request.studentIds().stream().distinct().toList();
        List<Enrollment> enrollments = enrollmentRepository
                .findByCourseIdAndStudentIdIn(courseId, requestedStudentIds);
        if (enrollments.size() != requestedStudentIds.size()) {
            Set<UUID> found = enrollments.stream()
                    .map(Enrollment::getStudentId)
                    .collect(java.util.stream.Collectors.toSet());
            List<UUID> missing = requestedStudentIds.stream()
                    .filter(studentId -> !found.contains(studentId))
                    .toList();
            throw new BusinessException(
                    "ENROLLMENT_NOT_FOUND",
                    "Không tìm thấy enrollment của học sinh: " + missing,
                    HttpStatus.NOT_FOUND);
        }

        VersionItems targetItems = readVersionItems(targetVersion);
        Set<UUID> fallbackQuizChapterIds = loadCurrentQuizChapterIds(courseId, targetItems.chapterIds());
        Set<UUID> targetQuizIds = targetItems.quizChapterIds().isEmpty()
                ? fallbackQuizChapterIds
                : targetItems.quizChapterIds();
        Set<UUID> validTargetProgressIds = new HashSet<>(targetItems.lessonIds());
        validTargetProgressIds.addAll(targetQuizIds);
        int targetProgressItemCount = targetItems.lessonIds().size() + targetQuizIds.size();

        List<UUID> migratedStudentIds = new ArrayList<>();
        for (Enrollment enrollment : enrollments) {
            migrateEnrollment(
                    course,
                    enrollment,
                    targetVersion,
                    targetItems,
                    validTargetProgressIds,
                    targetProgressItemCount,
                    request,
                    actor);
            migratedStudentIds.add(enrollment.getStudentId());
        }

        return new CourseVersionMigrationResponse(
                courseId,
                targetVersion.getId(),
                targetVersion.getVersionNo(),
                migratedStudentIds.size(),
                List.copyOf(migratedStudentIds));
    }

    private void migrateEnrollment(
            Course course,
            Enrollment enrollment,
            CourseVersion targetVersion,
            VersionItems targetItems,
            Set<UUID> validTargetProgressIds,
            int targetProgressItemCount,
            CourseVersionMigrationRequest request,
            AuthenticatedUser actor) {
        UUID fromVersionId = enrollment.getCourseVersionId();
        if (fromVersionId == null) {
            throw new BusinessException(
                    "ENROLLMENT_VERSION_MISSING",
                    "Enrollment chưa có course_version_id; cần backfill trước khi migration.",
                    HttpStatus.CONFLICT);
        }
        if (fromVersionId.equals(targetVersion.getId())) {
            throw new BusinessException(
                    "ENROLLMENT_ALREADY_ON_TARGET_VERSION",
                    "Học sinh " + enrollment.getStudentId() + " đã học phiên bản đích.",
                    HttpStatus.CONFLICT);
        }

        CourseVersion fromVersion = courseVersionRepository.findById(fromVersionId)
                .orElseThrow(() -> new ResourceNotFoundException("CourseVersion", fromVersionId));
        if (targetVersion.getVersionNo() <= fromVersion.getVersionNo()) {
            throw new BusinessException(
                    "VERSION_DOWNGRADE_NOT_ALLOWED",
                    "Migration chỉ được chuyển sang phiên bản mới hơn.",
                    HttpStatus.CONFLICT);
        }

        validateFinalExamMapping(fromVersion, targetItems, request.finalExamMapping());

        List<CourseProgressItem> progressItems = progressRepository
                .findByStudentIdAndCourseId(enrollment.getStudentId(), course.getId());
        Set<String> mappedKeys = new HashSet<>();
        for (CourseProgressItem item : progressItems) {
            UUID mappedId = request.progressItemMapping()
                    .getOrDefault(item.getItemId(), item.getItemId());
            if (!validTargetProgressIds.contains(mappedId)) {
                throw new BusinessException(
                        "PROGRESS_MAPPING_INCOMPLETE",
                        "Thiếu mapping tiến độ cho item " + item.getItemId()
                                + " của học sinh " + enrollment.getStudentId() + ".",
                        HttpStatus.BAD_REQUEST);
            }
            String uniqueKey = item.getItemType() + ":" + mappedId;
            if (!mappedKeys.add(uniqueKey)) {
                throw new BusinessException(
                        "PROGRESS_MAPPING_DUPLICATE",
                        "Nhiều mục tiến độ đang được map vào cùng một nội dung đích.",
                        HttpStatus.BAD_REQUEST);
            }
            if (!mappedId.equals(item.getItemId())) {
                item.migrateItemId(mappedId);
            }
        }
        progressRepository.saveAll(progressItems);

        int progressPct = targetProgressItemCount == 0
                ? 0
                : (int) Math.round(Math.min(progressItems.size(), targetProgressItemCount)
                        * 100.0 / targetProgressItemCount);
        enrollment.migrateToVersion(targetVersion.getId(), progressPct);
        enrollmentRepository.save(enrollment);

        certificateRepository.findByStudentIdAndCourseId(enrollment.getStudentId(), course.getId())
                .ifPresent(certificate -> applyCertificateMapping(
                        certificate, request.certificateMapping(), targetVersion));

        migrationLogRepository.save(CourseVersionMigrationLog.create(
                enrollment,
                fromVersionId,
                targetVersion.getId(),
                actor.userId(),
                request.reason().trim(),
                toJson(request.progressItemMapping()),
                toJson(request.finalExamMapping()),
                request.certificateMapping().trim()));

        notifyStudentAndParents(course, enrollment, fromVersion, targetVersion);
    }

    private void applyCertificateMapping(
            Certificate certificate,
            String certificateMapping,
            CourseVersion targetVersion) {
        boolean issued = certificate.getStatus() == CertificateStatus.ISSUED
                || certificate.getStatus() == CertificateStatus.REISSUED;
        if (issued && !CERTIFICATE_NEEDS_REVIEW.equalsIgnoreCase(certificateMapping.trim())) {
            throw new BusinessException(
                    "CERTIFICATE_MAPPING_INVALID",
                    "Chứng chỉ đã cấp phải dùng mapping MARK_NEEDS_REVIEW khi đổi phiên bản.",
                    HttpStatus.BAD_REQUEST);
        }
        if (issued) {
            certificate.markNeedsReview(
                    "Course migrated to approved version " + targetVersion.getVersionNo());
            certificateRepository.save(certificate);
        }
    }

    private void validateFinalExamMapping(
            CourseVersion fromVersion,
            VersionItems targetItems,
            Map<UUID, UUID> finalExamMapping) {
        Set<UUID> sourceExamIds = readVersionItems(fromVersion).requiredExamIds();
        for (UUID sourceExamId : sourceExamIds) {
            UUID targetExamId = finalExamMapping.get(sourceExamId);
            if (targetExamId == null || !targetItems.requiredExamIds().contains(targetExamId)) {
                throw new BusinessException(
                        "FINAL_EXAM_MAPPING_INCOMPLETE",
                        "Thiếu mapping bài kiểm tra từ " + sourceExamId + " sang phiên bản đích.",
                        HttpStatus.BAD_REQUEST);
            }
        }
    }

    private void requireMigrationPermission(Course course, AuthenticatedUser actor) {
        if ("admin".equalsIgnoreCase(actor.role())) {
            return;
        }
        if ("teacher".equalsIgnoreCase(actor.role())) {
            teacherAccessService.requireApprovedTeacher(actor);
            if (course.getTeacher() != null
                    && course.getTeacher().getId().equals(actor.userId())) {
                return;
            }
        }
        throw new BusinessException(
                "COURSE_VERSION_MIGRATION_FORBIDDEN",
                "Chỉ Admin hoặc giáo viên sở hữu khóa học được migration phiên bản.",
                HttpStatus.FORBIDDEN);
    }

    private void notifyStudentAndParents(
            Course course,
            Enrollment enrollment,
            CourseVersion fromVersion,
            CourseVersion targetVersion) {
        String title = "Khóa học đã chuyển phiên bản";
        String body = "Khóa học \"" + course.getTitle() + "\" đã chuyển từ phiên bản "
                + fromVersion.getVersionNo() + " sang " + targetVersion.getVersionNo() + ".";
        notificationService.notify(
                enrollment.getStudentId(),
                "course_version_migrated",
                title,
                body,
                "/courses/" + course.getId());

        parentLinkRepository.findByIdStudentIdAndStatusOrderByInvitedAtDesc(
                        enrollment.getStudentId(), ParentStudentLinkStatus.ACTIVE.toDbValue())
                .forEach(link -> notificationService.notify(
                        link.getParent().getId(),
                        "child_course_version_migrated",
                        title,
                        body,
                        "/parent/progress"));
    }

    private Set<UUID> loadCurrentQuizChapterIds(UUID courseId, Set<UUID> targetChapterIds) {
        Set<UUID> ids = new LinkedHashSet<>();
        for (QuizConfig config : quizConfigRepository.findByCourseIds(List.of(courseId))) {
            UUID chapterId = config.getChapter().getId();
            if (targetChapterIds.contains(chapterId)) {
                ids.add(chapterId);
            }
        }
        return ids;
    }

    private VersionItems readVersionItems(CourseVersion version) {
        try {
            JsonNode root = objectMapper.readTree(version.getSnapshotJson());
            Set<UUID> chapterIds = new LinkedHashSet<>();
            Set<UUID> lessonIds = new LinkedHashSet<>();
            Set<UUID> quizChapterIds = readUuidArray(root.path("quizChapterIds"));
            Set<UUID> requiredExamIds = new LinkedHashSet<>();

            for (JsonNode chapter : root.path("chapters")) {
                addUuid(chapterIds, chapter.path("id"));
                for (JsonNode lesson : chapter.path("lessons")) {
                    addUuid(lessonIds, lesson.path("id"));
                }
            }
            for (JsonNode exam : root.path("requiredExams")) {
                addUuid(requiredExamIds, exam.path("id"));
            }
            return new VersionItems(chapterIds, lessonIds, quizChapterIds, requiredExamIds);
        } catch (JsonProcessingException | IllegalArgumentException ex) {
            throw new BusinessException(
                    "COURSE_VERSION_SNAPSHOT_INVALID",
                    "Snapshot phiên bản khóa học không hợp lệ.",
                    HttpStatus.CONFLICT);
        }
    }

    private Set<UUID> readUuidArray(JsonNode node) {
        Set<UUID> values = new LinkedHashSet<>();
        for (JsonNode item : node) {
            addUuid(values, item);
        }
        return values;
    }

    private void addUuid(Set<UUID> target, JsonNode value) {
        if (value != null && value.isTextual() && !value.asText().isBlank()) {
            target.add(UUID.fromString(value.asText()));
        }
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new BusinessException(
                    "COURSE_VERSION_MAPPING_INVALID",
                    "Không thể lưu mapping migration.",
                    HttpStatus.BAD_REQUEST);
        }
    }

    private record VersionItems(
            Set<UUID> chapterIds,
            Set<UUID> lessonIds,
            Set<UUID> quizChapterIds,
            Set<UUID> requiredExamIds) {
    }
}

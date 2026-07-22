package com.beeacademy.backend.service;

import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.model.CourseVersion;
import com.beeacademy.backend.repository.CourseVersionRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CourseVersionSnapshotService {

    private final CourseVersionRepository courseVersionRepository;
    private final ObjectMapper objectMapper;

    public Optional<SnapshotMetrics> findMetrics(UUID courseVersionId) {
        if (courseVersionId == null) {
            return Optional.empty();
        }
        return courseVersionRepository.findById(courseVersionId).map(this::readMetrics);
    }

    private SnapshotMetrics readMetrics(CourseVersion version) {
        try {
            JsonNode root = objectMapper.readTree(version.getSnapshotJson());
            Set<UUID> chapterIds = new LinkedHashSet<>();
            Set<UUID> lessonIds = new LinkedHashSet<>();
            boolean quizSnapshotPresent = root.has("quizChapterIds");
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
            return new SnapshotMetrics(
                    version.getId(),
                    version.getVersionNo(),
                    Set.copyOf(chapterIds),
                    Set.copyOf(lessonIds),
                    Set.copyOf(quizChapterIds),
                    quizSnapshotPresent,
                    Set.copyOf(requiredExamIds));
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

    public record SnapshotMetrics(
            UUID courseVersionId,
            Integer versionNo,
            Set<UUID> chapterIds,
            Set<UUID> lessonIds,
            Set<UUID> quizChapterIds,
            boolean quizSnapshotPresent,
            Set<UUID> requiredExamIds) {

        public int progressItemCount() {
            return lessonIds.size() + quizChapterIds.size();
        }

        public boolean containsProgressItem(UUID itemId, String itemType) {
            return switch (itemType) {
                case "lesson" -> lessonIds.contains(itemId);
                case "quiz" -> !quizSnapshotPresent || quizChapterIds.contains(itemId);
                default -> false;
            };
        }
    }
}

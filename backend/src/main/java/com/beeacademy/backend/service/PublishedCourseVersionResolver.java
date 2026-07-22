package com.beeacademy.backend.service;

import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.model.Chapter;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseStatus;
import com.beeacademy.backend.model.CourseVersion;
import com.beeacademy.backend.model.ExamConfig;
import com.beeacademy.backend.model.Lesson;
import com.beeacademy.backend.repository.ChapterRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.CourseVersionRepository;
import com.beeacademy.backend.repository.QuizConfigRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PublishedCourseVersionResolver {

    private final CourseRepository courseRepository;
    private final CourseVersionRepository courseVersionRepository;
    private final ChapterRepository chapterRepository;
    private final QuizConfigRepository quizConfigRepository;
    private final ExamConfigVersionService examConfigVersionService;
    private final ObjectMapper objectMapper;

    @Transactional
    public CourseVersion resolve(Course course) {
        CourseVersion exact = courseVersionRepository
                .findByCourseIdAndVersionNo(course.getId(), course.getSubmittedVersionNo())
                .filter(CourseVersion::isApproved)
                .orElse(null);
        if (exact != null) {
            return exact;
        }

        CourseVersion latestApproved = courseVersionRepository
                .findFirstByCourseIdAndApprovedAtIsNotNullOrderByVersionNoDesc(course.getId())
                .orElse(null);
        if (latestApproved != null) {
            return latestApproved;
        }
        if (course.getStatus() != CourseStatus.PUBLISHED) {
            throw new BusinessException(
                    "COURSE_VERSION_NOT_PUBLISHED",
                    "Khóa học chưa có phiên bản đã duyệt để cấp quyền học.",
                    HttpStatus.CONFLICT);
        }

        // Legacy PUBLISHED rows (for example seed data) predate course versioning.
        List<Chapter> chapters = chapterRepository.findWithLessonsByCourseId(course.getId());
        int versionNo = courseVersionRepository.findMaxVersionNo(course.getId()) + 1;
        course.markSubmittedVersion(versionNo);
        courseRepository.save(course);
        List<ExamConfig> exams = examConfigVersionService.ensureDraftSet(course.getId());
        CourseVersion legacyVersion = CourseVersion.create(
                course,
                course.getTeacher(),
                versionNo,
                buildSnapshot(course, chapters, exams));
        legacyVersion.markApproved(null);
        CourseVersion saved = courseVersionRepository.save(legacyVersion);
        examConfigVersionService.publishDrafts(course.getId(), saved.getId());
        return saved;
    }

    private String buildSnapshot(Course course, List<Chapter> chapters, List<ExamConfig> exams) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("courseId", course.getId());
        snapshot.put("versionNo", course.getSubmittedVersionNo());
        snapshot.put("title", course.getTitle());
        snapshot.put("priceVnd", course.getPriceVnd());
        snapshot.put("salePriceVnd", course.getSalePriceVnd());
        snapshot.put("status", course.getStatus().toDbValue());
        snapshot.put("quizChapterIds", quizConfigRepository.findByCourseIds(List.of(course.getId()))
                .stream()
                .map(config -> config.getChapter().getId())
                .distinct()
                .toList());
        snapshot.put("chapters", chapters.stream()
                .sorted(Comparator.comparing(Chapter::getPosition))
                .map(this::chapterSnapshot)
                .toList());
        snapshot.put("requiredExams", exams.stream()
                .map(this::examSnapshot)
                .toList());
        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (JsonProcessingException ex) {
            throw new BusinessException(
                    "COURSE_VERSION_SNAPSHOT_FAILED",
                    "Không thể tạo snapshot cho khóa học đã phát hành.",
                    HttpStatus.CONFLICT);
        }
    }

    private Map<String, Object> chapterSnapshot(Chapter chapter) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", chapter.getId());
        row.put("title", chapter.getTitle());
        row.put("position", chapter.getPosition());
        row.put("lessons", chapter.getLessons().stream()
                .sorted(Comparator.comparing(Lesson::getPosition))
                .map(this::lessonSnapshot)
                .toList());
        return row;
    }

    private Map<String, Object> lessonSnapshot(Lesson lesson) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", lesson.getId());
        row.put("title", lesson.getTitle());
        row.put("position", lesson.getPosition());
        row.put("completionRule", lesson.getCompletionRule());
        return row;
    }

    private Map<String, Object> examSnapshot(ExamConfig exam) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", exam.getId());
        row.put("slotIndex", exam.getSlotIndex());
        row.put("examType", exam.getExamType());
        row.put("name", exam.getName());
        return row;
    }
}

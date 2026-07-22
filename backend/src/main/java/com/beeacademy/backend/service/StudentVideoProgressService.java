package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.SaveStudentVideoProgressRequest;
import com.beeacademy.backend.dto.learning.VideoWatchedSegment;
import com.beeacademy.backend.dto.response.StudentVideoProgressResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Lesson;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.StudentVideoProgress;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.CourseProgressItemRepository;
import com.beeacademy.backend.repository.LessonRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.StudentVideoProgressRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class StudentVideoProgressService {

    private final StudentVideoProgressRepository progressRepository;
    private final LessonRepository lessonRepository;
    private final ProfileRepository profileRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final CourseProgressItemRepository courseProgressItemRepository;
    private final CourseProgressService courseProgressService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public StudentVideoProgressResponse getProgress(UUID courseId, UUID lessonId,
                                                    AuthenticatedUser me) {
        verifyStudentLessonAccess(courseId, lessonId, me);
        return progressRepository.findByStudent_IdAndLesson_Id(me.userId(), lessonId)
                .map(progress -> toResponse(progress, me.userId()))
                .orElseGet(() -> StudentVideoProgressResponse.empty(lessonId));
    }

    @Transactional(readOnly = true)
    public StudentVideoProgressResponse getLatestProgress(UUID courseId, AuthenticatedUser me) {
        verifyStudentCourseAccess(courseId, me);
        return progressRepository
                .findFirstByStudent_IdAndLesson_Chapter_Course_IdOrderByUpdatedAtDesc(me.userId(), courseId)
                .map(progress -> toResponse(progress, me.userId()))
                .orElse(null);
    }

    @Transactional
    public StudentVideoProgressResponse saveProgress(UUID courseId, UUID lessonId,
                                                     AuthenticatedUser me,
                                                     SaveStudentVideoProgressRequest request) {
        Lesson lesson = verifyStudentLessonAccess(courseId, lessonId, me);
        List<VideoWatchedSegment> mergedSegments = mergeSegments(
                loadSegments(progressRepository.findByStudent_IdAndLesson_Id(me.userId(), lessonId)
                        .map(StudentVideoProgress::getWatchedSegmentsJson).orElse("[]")),
                request.watchedSegments(),
                request.durationSec());
        String segmentsJson = writeSegments(mergedSegments);
        StudentVideoProgress progress = progressRepository
                .findByStudent_IdAndLesson_Id(me.userId(), lessonId)
                .orElseGet(() -> {
                    Profile student = profileRepository.findById(me.userId())
                            .orElseThrow(() -> new ResourceNotFoundException("Profile", me.userId()));
                    return StudentVideoProgress.create(
                            student, lesson, request.positionSec(), request.durationSec(), segmentsJson);
                });
        progress.update(request.positionSec(), request.durationSec());
        progress.updateWatchedSegments(segmentsJson);
        StudentVideoProgress saved = progressRepository.saveAndFlush(progress);
        int watchedDurationSec = coveredDuration(mergedSegments);
        boolean completed = isVideoLesson(lesson)
                && request.durationSec() > 0
                && watchedDurationSec >= Math.ceil(request.durationSec() * 0.9);
        if (completed) {
            courseProgressService.completeVideoLessonAfterWatch(courseId, lessonId, me);
        }
        return StudentVideoProgressResponse.fromEntity(
                saved, mergedSegments, watchedDurationSec,
                completed || courseProgressItemRepository
                        .existsByStudentIdAndCourseIdAndItemIdAndItemType(
                                me.userId(), courseId, lessonId, "lesson"));
    }

    private Lesson verifyStudentLessonAccess(UUID courseId, UUID lessonId, AuthenticatedUser me) {
        verifyStudentCourseAccess(courseId, me);
        Lesson lesson = lessonRepository.findWithChapterAndCourseById(lessonId)
                .orElseThrow(() -> new ResourceNotFoundException("Lesson", lessonId));
        if (!lesson.getChapter().getCourse().getId().equals(courseId)) {
            throw new BusinessException(
                    "STUDENT_VIDEO_PROGRESS_INVALID_LESSON",
                    "Bài học không thuộc khóa học đã chọn.",
                    HttpStatus.BAD_REQUEST
            );
        }
        return lesson;
    }

    private void verifyStudentCourseAccess(UUID courseId, AuthenticatedUser me) {
        if (me == null || !"student".equalsIgnoreCase(me.role())) {
            throw new BusinessException(
                    "STUDENT_VIDEO_PROGRESS_ROLE_FORBIDDEN",
                    "Chỉ học sinh mới có thể lưu tiến độ xem video.",
                    HttpStatus.FORBIDDEN
            );
        }
        if (!enrollmentRepository.existsByStudentIdAndCourseId(me.userId(), courseId)) {
            throw new BusinessException(
                    "STUDENT_VIDEO_PROGRESS_COURSE_FORBIDDEN",
                    "Bạn cần tham gia khóa học để lưu tiến độ xem video.",
                    HttpStatus.FORBIDDEN
            );
        }
    }

    private StudentVideoProgressResponse toResponse(StudentVideoProgress progress, UUID studentId) {
        List<VideoWatchedSegment> segments = loadSegments(progress.getWatchedSegmentsJson());
        boolean completed = courseProgressItemRepository
                .existsByStudentIdAndCourseIdAndItemIdAndItemType(
                        studentId, progress.getLesson().getChapter().getCourse().getId(),
                        progress.getLesson().getId(), "lesson");
        return StudentVideoProgressResponse.fromEntity(
                progress, segments, coveredDuration(segments), completed);
    }

    private boolean isVideoLesson(Lesson lesson) {
        return lesson.getVideoStoragePath() != null
                || lesson.getVideoUrl() != null
                || lesson.getVideoEmbedUrl() != null;
    }

    private List<VideoWatchedSegment> loadSegments(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json,
                    new TypeReference<List<VideoWatchedSegment>>() { });
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private String writeSegments(List<VideoWatchedSegment> segments) {
        try {
            return objectMapper.writeValueAsString(segments);
        } catch (Exception ex) {
            throw new IllegalStateException("Không thể lưu các đoạn video đã xem", ex);
        }
    }

    private List<VideoWatchedSegment> mergeSegments(
            List<VideoWatchedSegment> existing,
            List<VideoWatchedSegment> incoming,
            int durationSec) {
        List<VideoWatchedSegment> all = new ArrayList<>();
        if (existing != null) all.addAll(existing);
        if (incoming != null) all.addAll(incoming);
        int max = Math.max(0, durationSec);
        return all.stream()
                .filter(segment -> segment != null)
                .map(segment -> new VideoWatchedSegment(
                        Math.max(0, Math.min(segment.startSec(), max)),
                        Math.max(0, Math.min(segment.endSec(), max))))
                .filter(segment -> segment.endSec() > segment.startSec())
                .sorted(Comparator.comparingInt(VideoWatchedSegment::startSec))
                .collect(ArrayList::new, (merged, next) -> {
                    if (merged.isEmpty()) {
                        merged.add(next);
                        return;
                    }
                    VideoWatchedSegment previous = merged.get(merged.size() - 1);
                    if (next.startSec() <= previous.endSec()) {
                        merged.set(merged.size() - 1,
                                new VideoWatchedSegment(previous.startSec(),
                                        Math.max(previous.endSec(), next.endSec())));
                    } else {
                        merged.add(next);
                    }
                }, ArrayList::addAll);
    }

    private int coveredDuration(List<VideoWatchedSegment> segments) {
        return segments.stream().mapToInt(segment -> segment.endSec() - segment.startSec()).sum();
    }
}

package com.beeacademy.backend.dto.response;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record StudentLearningProgressResponse(
        Integer totalCourses,
        Integer averageProgressPct,
        Integer completedLessons,
        Integer totalLessons,
        Integer completedQuizzes,
        Integer totalQuizzes,
        List<CourseProgressDetail> courses
) {
    public record CourseProgressDetail(
            UUID courseId,
            String slug,
            String title,
            String thumbnailUrl,
            String categoryName,
            String teacherName,
            Integer progressPct,
            Integer completedLessons,
            Integer totalLessons,
            Integer completedQuizzes,
            Integer totalQuizzes,
            Double latestQuizScore,
            Boolean finalExamPassed,
            Instant enrolledAt,
            List<ChapterProgressDetail> chapters
    ) {}

    public record ChapterProgressDetail(
            UUID chapterId,
            String title,
            Integer position,
            Integer completedLessons,
            Integer totalLessons,
            Boolean quizConfigured,
            Boolean quizCompleted,
            UUID latestQuizAttemptId,
            Double latestQuizScore,
            Boolean latestQuizPassed,
            Instant latestQuizSubmittedAt,
            List<LessonProgressDetail> lessons
    ) {}

    public record LessonProgressDetail(
            UUID lessonId,
            String title,
            Integer position,
            Integer durationSec,
            Boolean completed,
            Instant completedAt
    ) {}

}

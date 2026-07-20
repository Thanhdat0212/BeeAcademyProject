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
        List<CourseProgressDetail> courses,
        Double averageScorePercent,
        Long totalStudyTimeSec
) {
    public record CourseProgressDetail(
            UUID courseId,
            UUID courseVersionId,
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
            Boolean allRequiredExamsPassed,
            Integer passedRequiredExams,
            List<RequiredExamProgress> requiredExams,
            Instant enrolledAt,
            List<ChapterProgressDetail> chapters,
            Double averageScorePercent,
            Long studyTimeSec,
            List<AssignmentProgress> assignments
    ) {}

    public record RequiredExamProgress(
            Integer slotIndex,
            String label,
            String status,
            UUID examConfigId,
            UUID examCourseVersionId,
            Boolean courseVersionMatched,
            Double scorePercent,
            Boolean passed,
            Instant submittedAt,
            UUID scopeStartChapterId,
            String scopeStartChapterTitle,
            UUID placementChapterId,
            String placementChapterTitle
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
            List<LessonProgressDetail> lessons,
            Integer progressPct
    ) {}

    public record AssignmentProgress(
            UUID submissionId,
            UUID assignmentId,
            String title,
            UUID chapterId,
            String chapterTitle,
            String status,
            Double score,
            Double maxScore,
            Double normalizedScorePercent,
            Boolean late,
            Instant submittedAt,
            Instant gradedAt
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

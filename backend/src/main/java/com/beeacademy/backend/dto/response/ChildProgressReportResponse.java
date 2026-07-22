package com.beeacademy.backend.dto.response;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record ChildProgressReportResponse(
        UUID studentId,
        String studentName,
        String gradeLabel,
        Instant generatedAt,
        boolean detailAccessAllowed,
        boolean sensitiveDataMasked,
        String detailAccessReason,
        WeeklySummary weeklySummary,
        List<CourseProgressItem> courses,
        List<AssessmentRecord> assessments,
        List<CertificateRecord> certificates
) {
    public record WeeklySummary(
            LocalDate periodStart,
            LocalDate periodEnd,
            String progressTrend,
            Integer currentWeekCompletedItems,
            Integer previousWeekCompletedItems,
            Double averageScore,
            Integer completedAssessments,
            Integer incompleteCourses,
            Integer incompleteLearningItems,
            Integer inactiveDays,
            String actionRule,
            String actionSuggestion
    ) {}

    public record CourseProgressItem(
            UUID courseId,
            UUID courseVersionId,
            String courseTitle,
            String teacherName,
            String status,
            Integer progressPct,
            Instant enrolledAt,
            Instant progressUpdatedAt,
            List<Integer> grades,
            Integer lessonCompletedCount,
            Integer lessonTotalCount,
            Integer quizCompletedCount,
            Integer quizTotalCount,
            Double averageQuizScore,
            Double latestQuizScore,
            Double latestExamScore,
            Double latestAssignmentScore,
            List<LessonProgressItem> completedLessons,
            List<RequiredExamResult> requiredExams
    ) {}

    public record LessonProgressItem(
            UUID lessonId,
            UUID chapterId,
            String chapterTitle,
            Integer chapterPosition,
            String lessonTitle,
            Integer lessonPosition,
            Integer durationSec,
            Instant completedAt
    ) {}

    public record RequiredExamResult(
            Integer slotIndex,
            String label,
            String examName,
            String examType,
            String status,
            UUID examConfigId,
            UUID courseVersionId,
            Double scorePercent,
            Double normalizedScore,
            Boolean passed,
            Instant submittedAt
    ) {}

    public record AssessmentRecord(
            String id,
            UUID courseId,
            String courseTitle,
            String courseStatus,
            String assessmentName,
            String assessmentType,
            String chapterTitle,
            Double rawScore,
            Double maxScore,
            Double normalizedScore,
            String feedback,
            Instant submittedAt
    ) {}

    public record CertificateRecord(
            UUID certificateId,
            UUID courseId,
            String courseTitle,
            String teacherName,
            String status,
            String certificateNo,
            String verificationCode,
            Integer versionNo,
            Instant issuedAt,
            Instant revokedAt,
            String reviewNote
    ) {}
}

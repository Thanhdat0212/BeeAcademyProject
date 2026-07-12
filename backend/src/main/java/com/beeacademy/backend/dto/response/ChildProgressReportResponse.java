package com.beeacademy.backend.dto.response;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ChildProgressReportResponse(
        UUID studentId,
        String studentName,
        String gradeLabel,
        Instant generatedAt,
        List<CourseProgressItem> courses,
        List<AssessmentRecord> assessments
) {
    public record CourseProgressItem(
            UUID courseId,
            String courseTitle,
            String teacherName,
            String status,
            Integer progressPct,
            Instant enrolledAt,
            List<Integer> grades,
            Integer quizCompletedCount,
            Integer quizTotalCount,
            Double averageQuizScore,
            Double latestQuizScore,
            Double latestExamScore,
            Double latestAssignmentScore
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
}

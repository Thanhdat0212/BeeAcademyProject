package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.RevenueSplit;
import lombok.Builder;

import java.time.Instant;
import java.util.UUID;

@Builder
public record RevenueSplitResponse(
    UUID id,
    UUID studentId,
    String studentName,
    UUID courseId,
    String courseTitle,
    int grossAmount,
    int platformFee,
    int teacherAmount,
    int teacherPercent,
    Instant occurredAt,
    UUID payoutPeriodId
) {
    public static RevenueSplitResponse from(RevenueSplit s, String studentName, String courseTitle) {
        return RevenueSplitResponse.builder()
                .id(s.getId())
                .studentId(s.getStudentId())
                .studentName(studentName)
                .courseId(s.getCourseId())
                .courseTitle(courseTitle)
                .grossAmount(s.getGrossAmount())
                .platformFee(s.getPlatformFee())
                .teacherAmount(s.getTeacherAmount())
                .teacherPercent(s.getTeacherPercent())
                .occurredAt(s.getOccurredAt())
                .payoutPeriodId(s.getPayoutPeriodId())
                .build();
    }
}

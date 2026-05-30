package com.beeacademy.backend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * DTO chứa báo cáo tổng quan tiến độ và điểm số của con để trả về cho Phụ huynh.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChildOverviewResponse {

    private String studentName;
    private String grade;
    private double avgProgress;
    private int activeCourses;
    private int completedCourses;
    private double latestQuizScore;
    private double latestExamScore;
    private List<Double> weeklyActivityHours; // Mảng chứa số giờ học của 7 ngày (T2 - CN)
}

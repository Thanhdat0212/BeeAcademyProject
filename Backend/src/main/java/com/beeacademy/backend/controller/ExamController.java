package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.ExamConfigRequest;
import com.beeacademy.backend.dto.request.ExamQuestionRandomRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.ExamConfigResponse;
import com.beeacademy.backend.dto.response.QuestionStatsResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.ExamService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/teacher/courses/{courseId}/exams")
@RequiredArgsConstructor
@PreAuthorize("hasRole('teacher')")
public class ExamController {

    private final ExamService examService;

    @GetMapping
    public ApiResponse<List<ExamConfigResponse>> listExams(@PathVariable UUID courseId) {
        return ApiResponse.ok(examService.listExams(courseId, CurrentUser.required()));
    }

    @GetMapping("/question-bank-stats")
    public ApiResponse<QuestionStatsResponse> getQuestionBankStats(@PathVariable UUID courseId) {
        return ApiResponse.ok(examService.getQuestionBankStats(courseId, CurrentUser.required()));
    }

    @PostMapping("/random-questions")
    public ApiResponse<List<ExamConfigResponse.ExamQuestionResponse>> randomQuestions(
            @PathVariable UUID courseId,
            @Valid @RequestBody ExamQuestionRandomRequest req) {
        return ApiResponse.ok(
                examService.randomQuestions(courseId, CurrentUser.required(), req),
                "Random questions");
    }

    @GetMapping("/{slotIndex}")
    public ApiResponse<ExamConfigResponse> getExam(@PathVariable UUID courseId,                                                   @PathVariable Integer slotIndex) {
        return ApiResponse.ok(examService.getExam(courseId, slotIndex, CurrentUser.required()));
    }

    @PutMapping("/{slotIndex}")
    public ApiResponse<ExamConfigResponse> saveExam(@PathVariable UUID courseId,
                                                    @PathVariable Integer slotIndex,
                                                    @Valid @RequestBody ExamConfigRequest req) {
        return ApiResponse.ok(
                examService.saveExam(courseId, slotIndex, CurrentUser.required(), req),
                "Saved exam");
    }

    @DeleteMapping("/{slotIndex}")
    public ApiResponse<Void> deleteExam(@PathVariable UUID courseId,
                                        @PathVariable Integer slotIndex) {
        examService.deleteExam(courseId, slotIndex, CurrentUser.required());
        return ApiResponse.ok(null, "Deleted exam");
    }
}

package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.request.ExamIntegrityEventRequest;
import com.beeacademy.backend.dto.response.ExamIntegrityEventResponse;
import com.beeacademy.backend.dto.response.ExamRetakeRequestResponse;
import com.beeacademy.backend.dto.response.StudentExamResponse;
import com.beeacademy.backend.dto.request.ExamRetakeRequestCreate;
import com.beeacademy.backend.dto.request.SaveExamDraftRequest;
import com.beeacademy.backend.dto.request.SubmitExamRequest;
import com.beeacademy.backend.dto.response.StudentExamSubmissionResponse;
import com.beeacademy.backend.dto.response.UploadResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.ExamRetakeService;
import com.beeacademy.backend.service.ExamService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/student/courses/{courseId}/exams")
@RequiredArgsConstructor
@PreAuthorize("hasRole('student')")
public class StudentExamController {

    private final ExamService examService;
    private final ExamRetakeService examRetakeService;

    @GetMapping
    public ApiResponse<List<StudentExamResponse>> listCourseExams(@PathVariable UUID courseId) {
        return ApiResponse.ok(examService.listStudentExams(courseId, CurrentUser.required()));
    }

    @GetMapping("/{slotIndex}")
    public ApiResponse<StudentExamResponse> getCourseExam(
            @PathVariable UUID courseId,
            @PathVariable Integer slotIndex) {
        return ApiResponse.ok(examService.getStudentExam(courseId, slotIndex, CurrentUser.required()));
    }

    @PostMapping(value = "/answer-images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<UploadResponse> uploadAnswerImage(
            @PathVariable UUID courseId,
            @RequestPart("file") MultipartFile file) {
        return ApiResponse.ok(
                examService.uploadStudentExamAnswerImage(courseId, CurrentUser.required(), file),
                "Tải ảnh đáp án thành công");
    }

    @PostMapping("/{slotIndex}/submit")
    public ApiResponse<StudentExamSubmissionResponse> submitCourseExam(
            @PathVariable UUID courseId,
            @PathVariable Integer slotIndex,
            @Valid @RequestBody SubmitExamRequest request) {
        return ApiResponse.ok(
                examService.submitStudentExam(courseId, slotIndex, CurrentUser.required(), request),
                "Nộp bài kiểm tra thanh cong");
    }

    @GetMapping("/{slotIndex}/result")
    public ApiResponse<StudentExamSubmissionResponse> getCourseExamResult(
            @PathVariable UUID courseId,
            @PathVariable Integer slotIndex) {
        return ApiResponse.ok(examService.getStudentExamResult(courseId, slotIndex, CurrentUser.required()));
    }

    @PostMapping("/{slotIndex}/draft")
    public ApiResponse<Void> saveCourseExamDraft(
            @PathVariable UUID courseId,
            @PathVariable Integer slotIndex,
            @Valid @RequestBody SaveExamDraftRequest request) {
        examService.saveStudentExamDraft(courseId, slotIndex, CurrentUser.required(), request);
        return ApiResponse.ok(null, "Đã lưu nháp bài kiểm tra");
    }

    @PostMapping("/{slotIndex}/integrity-events")
    public ApiResponse<ExamIntegrityEventResponse> recordIntegrityEvent(
            @PathVariable UUID courseId,
            @PathVariable Integer slotIndex,
            @Valid @RequestBody ExamIntegrityEventRequest request) {
        return ApiResponse.ok(
                examService.recordStudentExamIntegrityEvent(
                        courseId, slotIndex, CurrentUser.required(), request),
                "Đã ghi nhận sự kiện chống gian lận");
    }

    @PostMapping("/{slotIndex}/retake-requests")
    public ApiResponse<ExamRetakeRequestResponse> requestRetake(
            @PathVariable UUID courseId,
            @PathVariable Integer slotIndex,
            @Valid @RequestBody ExamRetakeRequestCreate request) {
        return ApiResponse.ok(
                examRetakeService.requestRetake(courseId, slotIndex, CurrentUser.required(), request),
                "Đã gửi yêu cầu mở thêm lượt làm bài");
    }

    @GetMapping("/{slotIndex}/retake-requests/latest")
    public ApiResponse<ExamRetakeRequestResponse> latestRetakeRequest(
            @PathVariable UUID courseId,
            @PathVariable Integer slotIndex) {
        return ApiResponse.ok(
                examRetakeService.getLatestRequest(courseId, slotIndex, CurrentUser.required())
                        .orElse(null));
    }
}

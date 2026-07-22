package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.ConfirmDocumentUploadRequest;
import com.beeacademy.backend.dto.request.ConfirmUploadRequest;
import com.beeacademy.backend.dto.request.ConfirmVideoUploadRequest;
import com.beeacademy.backend.dto.request.SignedUploadRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.SignedUploadResponse;
import com.beeacademy.backend.dto.response.UploadResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.ContentUploadService;
import com.beeacademy.backend.service.TeacherAccessService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

/**
 * Controller xử lý upload file nội dung khoá học (Phase 2 — video + tài liệu).
 *
 * <p>Video → private bucket "course-videos" (lưu storagePath, trả signed URL khi xem).
 * Tài liệu → public bucket "course-docs" (trả publicUrl trực tiếp).
 *
 * <p>Cần cấu hình application.yml:
 * <pre>
 *   spring.servlet.multipart.max-file-size: 2GB
 *   spring.servlet.multipart.max-request-size: 2GB
 * </pre>
 */
@RestController
@RequestMapping("/api/upload")
@RequiredArgsConstructor
@PreAuthorize("hasRole('teacher')")
public class UploadController {

    private final ContentUploadService uploadService;
    private final TeacherAccessService teacherAccessService;

    /**
     * Xin URL để browser upload video bài giảng thẳng lên Supabase.
     * Path: /api/upload/video/{courseId}/{chapterId}/{lessonId}/sign
     */
    @PostMapping("/video/{courseId}/{chapterId}/{lessonId}/sign")
    public ApiResponse<SignedUploadResponse> signVideoUpload(
            @PathVariable UUID courseId,
            @PathVariable UUID chapterId,
            @PathVariable UUID lessonId,
            @Valid @RequestBody SignedUploadRequest request) {
        var me = CurrentUser.required();
        teacherAccessService.requireApprovedTeacher(me);
        SignedUploadResponse result = uploadService.createVideoUploadTicket(
                courseId, chapterId, lessonId, me.userId(), request);
        return ApiResponse.ok(result, "Đã tạo đường dẫn tải lên");
    }

    /**
     * Báo đã upload xong video, xin gắn vào bài giảng.
     * Path: /api/upload/video/{courseId}/{chapterId}/{lessonId}/confirm
     */
    @PostMapping("/video/{courseId}/{chapterId}/{lessonId}/confirm")
    public ApiResponse<UploadResponse> confirmVideoUpload(
            @PathVariable UUID courseId,
            @PathVariable UUID chapterId,
            @PathVariable UUID lessonId,
            @Valid @RequestBody ConfirmVideoUploadRequest request) {
        var me = CurrentUser.required();
        teacherAccessService.requireApprovedTeacher(me);
        UploadResponse result = uploadService.confirmVideoUpload(
                courseId, chapterId, lessonId, me.userId(), request);
        return ApiResponse.ok(result, "Upload video thành công");
    }

    /**
     * Xin URL để browser upload tài liệu (PDF/slide) thẳng lên Supabase.
     * Path: /api/upload/document/{lessonId}/sign
     */
    @PostMapping("/document/{lessonId}/sign")
    public ApiResponse<SignedUploadResponse> signDocumentUpload(
            @PathVariable UUID lessonId,
            @Valid @RequestBody SignedUploadRequest request) {
        var me = CurrentUser.required();
        teacherAccessService.requireApprovedTeacher(me);
        SignedUploadResponse result = uploadService.createDocumentUploadTicket(
                lessonId, me.userId(), request);
        return ApiResponse.ok(result, "Đã tạo đường dẫn tải lên");
    }

    /**
     * Báo đã upload xong tài liệu, xin lưu metadata.
     * Path: /api/upload/document/{lessonId}/confirm
     */
    @PostMapping("/document/{lessonId}/confirm")
    public ApiResponse<UploadResponse> confirmDocumentUpload(
            @PathVariable UUID lessonId,
            @Valid @RequestBody ConfirmDocumentUploadRequest request) {
        var me = CurrentUser.required();
        teacherAccessService.requireApprovedTeacher(me);
        UploadResponse result = uploadService.confirmDocumentUpload(
                lessonId, me.userId(), request);
        return ApiResponse.ok(result, "Upload tài liệu thành công");
    }

    /** Xóa một tài liệu/slide đã đính kèm khỏi bài giảng. */
    @DeleteMapping("/document/{lessonId}/{documentId}")
    public ApiResponse<Void> deleteDocument(
            @PathVariable UUID lessonId,
            @PathVariable UUID documentId) {
        var me = CurrentUser.required();
        teacherAccessService.requireApprovedTeacher(me);
        uploadService.deleteDocument(
                lessonId, documentId, me.userId());
        return ApiResponse.ok(null, "Xóa tài liệu thành công");
    }

    /**
     * Upload ảnh bìa khóa học.
     * Path: /api/upload/course-thumbnail
     */
    @PostMapping("/course-thumbnail")
    public ApiResponse<UploadResponse> uploadCourseThumbnail(
            @RequestParam("file") MultipartFile file) {
        var me = CurrentUser.required();
        teacherAccessService.requireApprovedTeacher(me);
        UploadResponse result = uploadService.uploadCourseThumbnail(
                me.userId(), file);
        return ApiResponse.ok(result, "Upload anh bia thanh cong");
    }

    /**
     * Xin URL để browser upload video gioi thieu thang len Supabase.
     * Path: /api/upload/course-intro-video/sign
     */
    @PostMapping("/course-intro-video/sign")
    public ApiResponse<SignedUploadResponse> signCourseIntroVideoUpload(
            @Valid @RequestBody SignedUploadRequest request) {
        var me = CurrentUser.required();
        teacherAccessService.requireApprovedTeacher(me);
        SignedUploadResponse result = uploadService.createIntroVideoUploadTicket(
                me.userId(), request);
        return ApiResponse.ok(result, "Da tao duong dan tai len");
    }

    /**
     * Bao da upload xong video gioi thieu khoa hoc.
     * Path: /api/upload/course-intro-video/confirm
     */
    @PostMapping("/course-intro-video/confirm")
    public ApiResponse<UploadResponse> confirmCourseIntroVideoUpload(
            @Valid @RequestBody ConfirmUploadRequest request) {
        var me = CurrentUser.required();
        teacherAccessService.requireApprovedTeacher(me);
        UploadResponse result = uploadService.confirmIntroVideoUpload(
                me.userId(), request);
        return ApiResponse.ok(result, "Upload video gioi thieu thanh cong");
    }

    @PostMapping("/question-image")
    public ApiResponse<UploadResponse> uploadQuestionImage(
            @RequestParam("file") MultipartFile file) {
        var me = CurrentUser.required();
        teacherAccessService.requireApprovedTeacher(me);
        UploadResponse result = uploadService.uploadQuestionImage(
                me.userId(), file);
        return ApiResponse.ok(result, "Upload ảnh câu hỏi thành công");
    }

    @PostMapping("/question-audio")
    public ApiResponse<UploadResponse> uploadQuestionAudio(
            @RequestParam("file") MultipartFile file) {
        var me = CurrentUser.required();
        teacherAccessService.requireApprovedTeacher(me);
        UploadResponse result = uploadService.uploadQuestionAudio(
                me.userId(), file);
        return ApiResponse.ok(result, "Upload audio câu hỏi thành công");
    }
}

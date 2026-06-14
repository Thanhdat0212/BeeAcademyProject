package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.UploadResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.ContentUploadService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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
 *   spring.servlet.multipart.max-file-size: 500MB
 *   spring.servlet.multipart.max-request-size: 500MB
 * </pre>
 */
@RestController
@RequestMapping("/api/upload")
@RequiredArgsConstructor
@PreAuthorize("hasRole('teacher')")
public class UploadController {

    private final ContentUploadService uploadService;

    /**
     * Upload video cho một bài giảng.
     * Path: /api/upload/video/{courseId}/{chapterId}/{lessonId}
     */
    @PostMapping("/video/{courseId}/{chapterId}/{lessonId}")
    public ApiResponse<UploadResponse> uploadVideo(
            @PathVariable UUID courseId,
            @PathVariable UUID chapterId,
            @PathVariable UUID lessonId,
            @RequestParam("file") MultipartFile file) {
        UploadResponse result = uploadService.uploadVideo(
                courseId, chapterId, lessonId,
                CurrentUser.required().userId(), file);
        return ApiResponse.ok(result, "Upload video thành công");
    }

    /**
     * Upload tài liệu đính kèm (PDF/slide) cho một bài giảng.
     * Path: /api/upload/document/{lessonId}
     */
    @PostMapping("/document/{lessonId}")
    public ApiResponse<UploadResponse> uploadDocument(
            @PathVariable UUID lessonId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "name", required = false) String displayName) {
        String name = displayName != null ? displayName : file.getOriginalFilename();
        UploadResponse result = uploadService.uploadDocument(
                lessonId, CurrentUser.required().userId(), name, file);
        return ApiResponse.ok(result, "Upload tài liệu thành công");
    }

    /**
     * Upload anh bia khoa hoc.
     * Path: /api/upload/course-thumbnail
     */
    @PostMapping("/course-thumbnail")
    public ApiResponse<UploadResponse> uploadCourseThumbnail(
            @RequestParam("file") MultipartFile file) {
        UploadResponse result = uploadService.uploadCourseThumbnail(
                CurrentUser.required().userId(), file);
        return ApiResponse.ok(result, "Upload anh bia thanh cong");
    }
}

package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.CreateChapterRequest;
import com.beeacademy.backend.dto.request.CreateCourseRequest;
import com.beeacademy.backend.dto.request.CreateLessonRequest;
import com.beeacademy.backend.dto.request.ReorderChaptersRequest;
import com.beeacademy.backend.dto.request.ReorderLessonsRequest;
import com.beeacademy.backend.dto.request.UpdateChapterRequest;
import com.beeacademy.backend.dto.request.UpdateCourseRequest;
import com.beeacademy.backend.dto.request.UpdateLessonRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.PageResponse;
import com.beeacademy.backend.dto.response.TeacherChapterResponse;
import com.beeacademy.backend.dto.response.TeacherCourseDetailResponse;
import com.beeacademy.backend.dto.response.TeacherCourseResponse;
import com.beeacademy.backend.dto.response.TeacherLessonResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.TeacherCourseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

/**
 * REST controller cho phân hệ Teacher Course Portal (Phase 1).
 *
 * <p>Tất cả endpoint yêu cầu role = teacher.
 * Course và Chapter/Lesson CRUD bao gồm submit để Admin duyệt.
 */
@RestController
@RequestMapping("/api/teacher")
@RequiredArgsConstructor
@PreAuthorize("hasRole('teacher')")
public class TeacherCourseController {

    private final TeacherCourseService courseService;

    // ── Course ────────────────────────────────────────────────────────────────

    @PostMapping("/courses")
    public ApiResponse<TeacherCourseResponse> createCourse(
            @Valid @RequestBody CreateCourseRequest req) {
        return ApiResponse.ok(courseService.createCourse(CurrentUser.required(), req),
                "Tạo khóa học thành công");
    }

    @GetMapping("/courses")
    public ApiResponse<PageResponse<TeacherCourseResponse>> listCourses(
            @PageableDefault(size = 10, sort = "updatedAt", direction = Sort.Direction.DESC)
            Pageable pageable) {
        return ApiResponse.ok(courseService.listMyCourses(CurrentUser.required(), pageable));
    }

    @GetMapping("/courses/{courseId}")
    public ApiResponse<TeacherCourseDetailResponse> getCourseDetail(
            @PathVariable UUID courseId) {
        return ApiResponse.ok(courseService.getCourseDetail(courseId, CurrentUser.required()));
    }

    @PutMapping("/courses/{courseId}")
    public ApiResponse<TeacherCourseResponse> updateCourse(
            @PathVariable UUID courseId,
            @Valid @RequestBody UpdateCourseRequest req) {
        return ApiResponse.ok(
                courseService.updateCourse(courseId, CurrentUser.required(), req));
    }

    @PutMapping(value = "/courses/{courseId}/thumbnail", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<TeacherCourseResponse> updateThumbnail(
            @PathVariable UUID courseId,
            @RequestParam("file") MultipartFile file) {
        return ApiResponse.ok(
                courseService.updateThumbnail(courseId, CurrentUser.required(), file),
                "Đã cập nhật ảnh bìa");
    }

    @DeleteMapping("/courses/{courseId}")
    public ApiResponse<Void> deleteCourse(@PathVariable UUID courseId) {
        courseService.deleteCourse(courseId, CurrentUser.required());
        return ApiResponse.ok(null, "Xóa khóa học thành công");
    }

    @PostMapping("/courses/{courseId}/submit")
    public ApiResponse<TeacherCourseResponse> submitForReview(@PathVariable UUID courseId) {
        return ApiResponse.ok(
                courseService.submitForReview(courseId, CurrentUser.required()),
                "Đã nộp khóa học để duyệt. Chúng tôi sẽ phản hồi trong 2-3 ngày làm việc.");
    }

    // ── Chapter ───────────────────────────────────────────────────────────────

    @PostMapping("/courses/{courseId}/chapters")
    public ApiResponse<TeacherChapterResponse> addChapter(
            @PathVariable UUID courseId,
            @Valid @RequestBody CreateChapterRequest req) {
        return ApiResponse.ok(
                courseService.addChapter(courseId, CurrentUser.required(), req),
                "Thêm chương thành công");
    }

    @PutMapping("/courses/{courseId}/chapters/{chapterId}")
    public ApiResponse<TeacherChapterResponse> updateChapter(
            @PathVariable UUID courseId,
            @PathVariable UUID chapterId,
            @Valid @RequestBody UpdateChapterRequest req) {
        return ApiResponse.ok(
                courseService.updateChapter(courseId, chapterId, CurrentUser.required(), req));
    }

    @DeleteMapping("/courses/{courseId}/chapters/{chapterId}")
    public ApiResponse<Void> deleteChapter(
            @PathVariable UUID courseId,
            @PathVariable UUID chapterId) {
        courseService.deleteChapter(courseId, chapterId, CurrentUser.required());
        return ApiResponse.ok(null, "Xóa chương thành công");
    }

    // ── Lesson ────────────────────────────────────────────────────────────────

    @PutMapping("/courses/{courseId}/chapters/reorder")
    public ApiResponse<TeacherCourseDetailResponse> reorderChapters(
            @PathVariable UUID courseId,
            @Valid @RequestBody ReorderChaptersRequest req) {
        return ApiResponse.ok(
                courseService.reorderChapters(courseId, CurrentUser.required(), req),
                "Đã cập nhật thứ tự chương");
    }

    @PostMapping("/courses/{courseId}/chapters/{chapterId}/lessons")
    public ApiResponse<TeacherLessonResponse> addLesson(
            @PathVariable UUID courseId,
            @PathVariable UUID chapterId,
            @Valid @RequestBody CreateLessonRequest req) {
        return ApiResponse.ok(
                courseService.addLesson(courseId, chapterId, CurrentUser.required(), req),
                "Thêm bài giảng thành công");
    }

    @PutMapping("/courses/{courseId}/chapters/{chapterId}/lessons/{lessonId}")
    public ApiResponse<TeacherLessonResponse> updateLesson(
            @PathVariable UUID courseId,
            @PathVariable UUID chapterId,
            @PathVariable UUID lessonId,
            @Valid @RequestBody UpdateLessonRequest req) {
        return ApiResponse.ok(
                courseService.updateLesson(courseId, chapterId, lessonId,
                                           CurrentUser.required(), req));
    }

    @DeleteMapping("/courses/{courseId}/chapters/{chapterId}/lessons/{lessonId}")
    public ApiResponse<Void> deleteLesson(
            @PathVariable UUID courseId,
            @PathVariable UUID chapterId,
            @PathVariable UUID lessonId) {
        courseService.deleteLesson(courseId, chapterId, lessonId, CurrentUser.required());
        return ApiResponse.ok(null, "Xóa bài giảng thành công");
    }
    @PutMapping("/courses/{courseId}/chapters/{chapterId}/lessons/reorder")
    public ApiResponse<TeacherCourseDetailResponse> reorderLessons(
            @PathVariable UUID courseId,
            @PathVariable UUID chapterId,
            @Valid @RequestBody ReorderLessonsRequest req) {
        return ApiResponse.ok(
                courseService.reorderLessons(courseId, chapterId, CurrentUser.required(), req),
                "Đã cập nhật thứ tự bài giảng");
    }
}

package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.SaveStudentLessonNoteRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.StudentLessonNoteResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.StudentLessonNoteService;
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
@RequestMapping("/api/student/courses/{courseId}/lessons/{lessonId}/notes")
@RequiredArgsConstructor
@PreAuthorize("hasRole('student')")
public class StudentLessonNoteController {

    private final StudentLessonNoteService noteService;

    @GetMapping
    public ApiResponse<List<StudentLessonNoteResponse>> listNotes(
            @PathVariable UUID courseId,
            @PathVariable UUID lessonId) {
        return ApiResponse.ok(noteService.listNotes(courseId, lessonId, CurrentUser.required()));
    }

    @PostMapping
    public ApiResponse<StudentLessonNoteResponse> createNote(
            @PathVariable UUID courseId,
            @PathVariable UUID lessonId,
            @Valid @RequestBody SaveStudentLessonNoteRequest request) {
        return ApiResponse.ok(
                noteService.createNote(courseId, lessonId, CurrentUser.required(), request),
                "Đã lưu ghi chú"
        );
    }

    @PutMapping("/{noteId}")
    public ApiResponse<StudentLessonNoteResponse> updateNote(
            @PathVariable UUID courseId,
            @PathVariable UUID lessonId,
            @PathVariable UUID noteId,
            @Valid @RequestBody SaveStudentLessonNoteRequest request) {
        return ApiResponse.ok(
                noteService.updateNote(courseId, lessonId, noteId, CurrentUser.required(), request),
                "Đã cập nhật ghi chú"
        );
    }

    @DeleteMapping("/{noteId}")
    public ApiResponse<Void> deleteNote(
            @PathVariable UUID courseId,
            @PathVariable UUID lessonId,
            @PathVariable UUID noteId) {
        noteService.deleteNote(courseId, lessonId, noteId, CurrentUser.required());
        return ApiResponse.ok(null, "Đã xóa ghi chú");
    }
}

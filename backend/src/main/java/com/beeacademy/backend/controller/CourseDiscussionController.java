package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.CreateCourseDiscussionReplyRequest;
import com.beeacademy.backend.dto.request.CreateCourseDiscussionThreadRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.CourseDiscussionThreadResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.CourseDiscussionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/courses/{courseId}/discussion")
@RequiredArgsConstructor
public class CourseDiscussionController {

    private final CourseDiscussionService discussionService;

    @GetMapping
    public ApiResponse<List<CourseDiscussionThreadResponse>> listThreads(@PathVariable UUID courseId) {
        return ApiResponse.ok(discussionService.listThreads(courseId, CurrentUser.required()));
    }

    @PostMapping
    public ApiResponse<CourseDiscussionThreadResponse> createThread(
            @PathVariable UUID courseId,
            @Valid @RequestBody CreateCourseDiscussionThreadRequest req) {
        return ApiResponse.ok(
                discussionService.createThread(courseId, CurrentUser.required(), req),
                "Đã đăng câu hỏi thảo luận");
    }

    @PostMapping("/{threadId}/replies")
    public ApiResponse<CourseDiscussionThreadResponse> addReply(
            @PathVariable UUID courseId,
            @PathVariable UUID threadId,
            @Valid @RequestBody CreateCourseDiscussionReplyRequest req) {
        return ApiResponse.ok(
                discussionService.addReply(courseId, threadId, CurrentUser.required(), req),
                "Đã gửi phản hồi");
    }
}

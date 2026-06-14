package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.ComplaintMessageRequest;
import com.beeacademy.backend.dto.request.CreateComplaintRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.ComplaintResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.ComplaintService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Khiếu nại phía người gửi — HS / PH / GV (UC11).
 * Admin dùng {@link AdminComplaintController}.
 */
@RestController
@RequestMapping("/api/complaints")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class ComplaintController {

    private final ComplaintService complaintService;

    @PostMapping
    public ApiResponse<ComplaintResponse> create(@Valid @RequestBody CreateComplaintRequest req) {
        return ApiResponse.ok(complaintService.submit(CurrentUser.required(), req),
                "Đã gửi khiếu nại đến Admin");
    }

    @GetMapping
    public ApiResponse<List<ComplaintResponse>> listMine() {
        return ApiResponse.ok(complaintService.listMine(CurrentUser.required()));
    }

    @GetMapping("/{id}")
    public ApiResponse<ComplaintResponse> getMine(@PathVariable UUID id) {
        return ApiResponse.ok(complaintService.getMyThread(id, CurrentUser.required()));
    }

    @PostMapping("/{id}/messages")
    public ApiResponse<ComplaintResponse> reply(@PathVariable UUID id,
                                                @Valid @RequestBody ComplaintMessageRequest req) {
        return ApiResponse.ok(complaintService.senderReply(id, CurrentUser.required(), req),
                "Đã gửi tin nhắn");
    }
}

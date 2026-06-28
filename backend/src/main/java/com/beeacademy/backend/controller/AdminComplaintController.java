package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.ComplaintMessageRequest;
import com.beeacademy.backend.dto.request.UpdateComplaintStatusRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.ComplaintResponse;
import com.beeacademy.backend.dto.response.ComplaintStatsResponse;
import com.beeacademy.backend.dto.response.ComplaintSummaryResponse;
import com.beeacademy.backend.dto.response.PageResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.ComplaintService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

/**
 * Hộp thư xử lý khiếu nại của Admin (UC38).
 */
@RestController
@RequestMapping("/api/admin/complaints")
@RequiredArgsConstructor
@PreAuthorize("hasRole('admin')")
public class AdminComplaintController {

    private final ComplaintService complaintService;

    /** Danh sách khiếu nại, lọc theo status + search (tiêu đề / tên người gửi). */
    @GetMapping
    public ApiResponse<PageResponse<ComplaintSummaryResponse>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @PageableDefault(size = 30, sort = "lastActivityAt", direction = Sort.Direction.DESC)
            Pageable pageable) {
        return ApiResponse.ok(complaintService.adminList(status, search, pageable));
    }

    /** Số liệu nhanh cho header inbox + badge sidebar. */
    @GetMapping("/stats")
    public ApiResponse<ComplaintStatsResponse> stats() {
        return ApiResponse.ok(complaintService.adminStats());
    }

    /** Chi tiết một khiếu nại kèm toàn bộ thread. */
    @GetMapping("/{id}")
    public ApiResponse<ComplaintResponse> detail(@PathVariable UUID id) {
        return ApiResponse.ok(complaintService.adminGetThread(id));
    }

    /** Admin phản hồi vào thread (chuyển trạng thái sang đang xử lý). */
    @PostMapping(value = "/{id}/reply", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ComplaintResponse> reply(
            @PathVariable UUID id,
            @Valid @RequestPart("data") ComplaintMessageRequest req,
            @RequestPart(value = "files", required = false) List<MultipartFile> files) {
        return ApiResponse.ok(complaintService.adminReply(id, CurrentUser.required(), req, files),
                "Đã gửi phản hồi");
    }

    /** Đổi trạng thái xử lý: in_progress / resolved / rejected. */
    @PatchMapping("/{id}/status")
    public ApiResponse<ComplaintResponse> changeStatus(@PathVariable UUID id,
                                                       @Valid @RequestBody UpdateComplaintStatusRequest req) {
        return ApiResponse.ok(complaintService.adminChangeStatus(id, req.status()),
                "Đã cập nhật trạng thái khiếu nại");
    }
}

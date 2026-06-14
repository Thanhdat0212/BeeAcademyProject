package com.beeacademy.backend.controller;


import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.ChildOverviewResponse;
import com.beeacademy.backend.dto.response.LinkedStudentResponse;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.ParentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * REST controller điều phối các API phân hệ Phụ huynh (Parent Portal).
 * 
 * <p>Mọi request gửi tới endpoint {@code /api/parent/**} bắt buộc phải được
 * xác thực có vai trò là {@code parent} (Phụ huynh).
 */
@RestController
@RequestMapping("/api/parent")
@RequiredArgsConstructor
@PreAuthorize("hasRole('parent')") // Phân quyền cấp độ Controller cho Phụ huynh
public class ParentController {

    private final ParentService parentService;

    /**
     * Lấy danh sách học sinh (con) đã liên kết.
     * 
     * @return Bọc phản hồi ApiResponse chứa danh sách LinkedStudentResponse
     */
    @GetMapping("/children")
    public ApiResponse<List<LinkedStudentResponse>> getLinkedChildren() {
        AuthenticatedUser me = CurrentUser.required();
        return ApiResponse.ok(parentService.getLinkedChildren(me));
    }



    /**
     * Gỡ liên kết học sinh (con) khỏi tài khoản phụ huynh.
     * 
     * @param studentId UUID của học sinh cần gỡ liên kết
     * @return ApiResponse rỗng kèm thông điệp thành công
     */
    @DeleteMapping("/children/{studentId}")
    public ApiResponse<Void> unlinkStudent(@PathVariable UUID studentId) {
        AuthenticatedUser me = CurrentUser.required();
        parentService.unlinkStudent(me, studentId);
        return ApiResponse.ok(null, "Gỡ liên kết tài khoản con thành công!");
    }

    /**
     * Lấy báo cáo chi tiết tổng quan tiến độ và điểm số học tập của con.
     * 
     * @param studentId UUID của học sinh
     * @return Bọc phản hồi ApiResponse chứa ChildOverviewResponse
     */
    @GetMapping("/children/{studentId}/overview")
    public ApiResponse<ChildOverviewResponse> getChildOverview(@PathVariable UUID studentId) {
        AuthenticatedUser me = CurrentUser.required();
        return ApiResponse.ok(parentService.getChildOverview(me, studentId));
    }
}

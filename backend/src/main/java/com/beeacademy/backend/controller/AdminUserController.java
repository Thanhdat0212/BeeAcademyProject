package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.response.AdminUserResponse;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.PageResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.TeacherApprovalStatus;
import com.beeacademy.backend.model.UserRole;
import com.beeacademy.backend.repository.ProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Admin quản lý tài khoản người dùng (UC35).
 */
@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('admin')")
public class AdminUserController {

    private final ProfileRepository profileRepository;

    /** Danh sách tất cả user, hỗ trợ filter role + search tên/email. */
    @GetMapping
    public ApiResponse<PageResponse<AdminUserResponse>> listUsers(
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20)
            Pageable pageable) {

        String roleParam   = (role   != null && !role.isBlank())   ? role.toLowerCase() : "";
        String searchParam = (search != null && !search.isBlank()) ? search             : "";

        Page<Object[]> raw = profileRepository.findAllWithEmail(roleParam, searchParam, pageable);
        List<AdminUserResponse> items = raw.getContent().stream()
                .map(AdminUserResponse::fromRow)
                .toList();

        Page<AdminUserResponse> page = new PageImpl<>(items, pageable, raw.getTotalElements());
        return ApiResponse.ok(PageResponse.of(page, r -> r));
    }

    /** Block / unblock tài khoản. */
    @PatchMapping("/{userId}/block")
    public ApiResponse<Void> toggleBlock(@PathVariable UUID userId,
                                          @RequestParam boolean blocked) {
        Profile profile = profileRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", userId));

        if (profile.getRole() == UserRole.ADMIN) {
            throw new BusinessException("CANNOT_BLOCK_ADMIN",
                    "Không thể block tài khoản Admin.", HttpStatus.FORBIDDEN);
        }

        if (blocked) profile.block(); else profile.unblock();
        profileRepository.save(profile);
        return ApiResponse.ok(null, blocked ? "Đã khóa tài khoản" : "Đã mở khóa tài khoản");
    }

    /** Duyệt hoặc từ chối vai trò giáo viên sau khi đăng ký. */
    @PatchMapping("/{userId}/teacher-approval")
    public ApiResponse<Void> updateTeacherApproval(@PathVariable UUID userId,
                                                   @RequestParam String status) {
        Profile profile = profileRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", userId));
        if (profile.getRole() != UserRole.TEACHER) {
            throw new BusinessException(
                    "NOT_TEACHER",
                    "Chỉ tài khoản giáo viên mới có trạng thái phê duyệt.",
                    HttpStatus.BAD_REQUEST);
        }

        TeacherApprovalStatus approvalStatus;
        try {
            approvalStatus = TeacherApprovalStatus.fromDbValue(status);
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(
                    "INVALID_TEACHER_APPROVAL_STATUS",
                    "Trạng thái phê duyệt giáo viên không hợp lệ.",
                    HttpStatus.BAD_REQUEST);
        }

        switch (approvalStatus) {
            case PENDING -> profile.markTeacherPendingApproval();
            case APPROVED -> profile.approveTeacher();
            case REJECTED -> profile.rejectTeacher();
        }
        profileRepository.save(profile);
        return ApiResponse.ok(null, "Đã cập nhật trạng thái phê duyệt giáo viên.");
    }

    /** Thống kê số lượng user theo role — dùng cho Overview tab. */
    @GetMapping("/stats")
    public ApiResponse<UserStats> getStats() {
        long students = profileRepository.countByRole(UserRole.STUDENT);
        long teachers = profileRepository.countByRole(UserRole.TEACHER);
        long parents  = profileRepository.countByRole(UserRole.PARENT);
        return ApiResponse.ok(new UserStats(students, teachers, parents, students + teachers + parents));
    }

    public record UserStats(long students, long teachers, long parents, long total) {}
}

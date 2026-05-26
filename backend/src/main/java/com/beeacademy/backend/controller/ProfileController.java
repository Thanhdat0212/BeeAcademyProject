package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.UpdateProfileRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.ProfileResponse;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.ProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * REST controller cho phân hệ Profile (UC05).
 *
 * <p>Tất cả endpoint {@code /api/me/**} đều yêu cầu JWT hợp lệ - mọi
 * request không có token / token sai sẽ bị {@code SecurityConfig} chặn
 * 401 trước khi đến controller.
 *
 * <p>Triết lý "thin controller":
 * <ul>
 *   <li>Lấy {@link AuthenticatedUser} từ {@link CurrentUser} - KHÔNG nhận
 *       userId từ path/body để chống IDOR.</li>
 *   <li>Bind DTO request → gọi service → wrap {@code ApiResponse}.</li>
 *   <li>Không có if/else nghiệp vụ, không try/catch.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class ProfileController {

    private final ProfileService profileService;

    /**
     * UC05.1 - Lấy hồ sơ của chính user đang đăng nhập.
     *
     * <p>userId luôn là của user trong JWT - không có cách nào xem profile
     * người khác qua endpoint này (xem profile public sẽ là endpoint riêng
     * trong tương lai).
     */
    @GetMapping
    public ApiResponse<ProfileResponse> getMyProfile() {
        AuthenticatedUser me = CurrentUser.required();
        return ApiResponse.ok(profileService.getCurrentProfile(me));
    }

    /**
     * UC05.2 - Cập nhật hồ sơ.
     *
     * <p>{@code @Valid} kích hoạt Jakarta Validation trên
     * {@link UpdateProfileRequest}. Lỗi validation tự động được
     * {@code GlobalExceptionHandler} chuyển thành 400 với field errors.
     */
    @PutMapping
    public ApiResponse<ProfileResponse> updateMyProfile(
            @Valid @RequestBody UpdateProfileRequest request) {
        AuthenticatedUser me = CurrentUser.required();
        ProfileResponse updated = profileService.updateProfile(me, request);
        return ApiResponse.ok(updated, "Cập nhật hồ sơ thành công");
    }

    /**
     * UC05.3 - Upload ảnh đại diện.
     *
     * <p>Content-Type: {@code multipart/form-data}, field name {@code file}.
     *
     * <p>{@code consumes = MULTIPART_FORM_DATA_VALUE} là chỉ dẫn để Spring
     * phân biệt với các endpoint JSON khác (đặc biệt khi sau này có nhiều
     * @PostMapping cùng path).
     *
     * <p>Service validate MIME, size và xử lý upload lên Supabase Storage.
     * URL public mới được lưu vào {@code profile.avatar_url} và trả về
     * cho frontend để cập nhật UI ngay lập tức.
     */
    @PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ProfileResponse> uploadAvatar(@RequestParam("file") MultipartFile file) {
        AuthenticatedUser me = CurrentUser.required();
        ProfileResponse updated = profileService.uploadAvatar(me, file);
        return ApiResponse.ok(updated, "Cập nhật ảnh đại diện thành công");
    }
}

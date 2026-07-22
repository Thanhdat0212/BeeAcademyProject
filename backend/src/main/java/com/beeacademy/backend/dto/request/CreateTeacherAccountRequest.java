package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request body cho {@code POST /api/admin/users/teachers}.
 *
 * <p>Không có field {@code password}: mật khẩu tạm do backend sinh để đảm bảo
 * đủ mạnh và không trùng nhau giữa các giáo viên.
 *
 * @param email       email đăng nhập của giáo viên
 * @param fullName    họ tên hiển thị
 * @param phone       số điện thoại liên hệ (tuỳ chọn)
 * @param contactNote kênh mạng xã hội Admin đã dùng để trao đổi với GV
 *                    (link Facebook/Zalo) - lưu lại để đối chiếu về sau
 */
public record CreateTeacherAccountRequest(

        @NotBlank(message = "Email không được để trống")
        @Email(message = "Email không đúng định dạng")
        @Size(max = 255, message = "Email quá dài")
        String email,

        @NotBlank(message = "Họ tên không được để trống")
        @Size(min = 2, max = 100, message = "Họ tên dài 2-100 ký tự")
        String fullName,

        @Size(max = 20, message = "Số điện thoại quá dài")
        String phone,

        @Size(max = 500, message = "Ghi chú liên hệ tối đa 500 ký tự")
        String contactNote
) {
}

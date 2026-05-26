package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Request body cho {@code POST /api/auth/register} (UC01).
 *
 * <p>Validation chia 2 tầng:
 * <ul>
 *   <li><b>Tầng DTO này</b> (Jakarta Bean Validation) chặn input rác:
 *       email sai format, password yếu, fullName trống, role không thuộc
 *       danh sách cho phép. Lỗi trả 400 với danh sách field errors.</li>
 *   <li><b>Tầng AuthService</b> kiểm tra business rule sâu hơn (vd: rate
 *       limit signup theo IP, blacklist email...).</li>
 * </ul>
 *
 * <p>Pattern password: ít nhất 8 ký tự, có 1 chữ hoa, có 1 chữ số.
 * {@code (?=.*[A-Z])(?=.*\d).{8,}}
 *
 * @param email    email đăng ký
 * @param password mật khẩu raw (gửi qua HTTPS)
 * @param fullName họ và tên
 * @param role     vai trò - chỉ chấp nhận student/parent/teacher
 */
public record RegisterRequest(

        @NotBlank(message = "Email không được để trống")
        @Email(message = "Email không đúng định dạng")
        @Size(max = 255, message = "Email quá dài")
        String email,

        @NotBlank(message = "Mật khẩu không được để trống")
        @Pattern(
                regexp = "^(?=.*[A-Z])(?=.*\\d).{8,}$",
                message = "Mật khẩu tối thiểu 8 ký tự, có ít nhất 1 chữ hoa và 1 chữ số"
        )
        String password,

        @NotBlank(message = "Họ tên không được để trống")
        @Size(min = 2, max = 100, message = "Họ tên dài 2-100 ký tự")
        String fullName,

        @NotBlank(message = "Vai trò không được để trống")
        @Pattern(
                regexp = "^(student|parent|teacher)$",
                message = "Vai trò phải là student, parent hoặc teacher"
        )
        String role
) {
}

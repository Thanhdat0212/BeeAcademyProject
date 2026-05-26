package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.hibernate.validator.constraints.URL;

/**
 * Request body cho {@code PUT /api/me} (UC05 - cập nhật hồ sơ).
 *
 * <p>Mọi field đều OPTIONAL: client chỉ gửi field nào muốn đổi, field nào
 * null sẽ giữ nguyên giá trị cũ. Hành vi này được implement ở
 * {@link com.beeacademy.backend.model.Profile#updatePersonalInfo} - chỉ
 * apply khi giá trị khác null.
 *
 * <p>Validation ở đây chỉ kiểm tra <b>format</b> khi field có giá trị.
 * Không dùng {@code @NotBlank} vì null hợp lệ (= không đổi).
 *
 * <p>QUAN TRỌNG: KHÔNG có field {@code role} hay {@code email} - role chỉ
 * Admin được đổi (UC riêng sau này), email đổi qua flow xác thực riêng.
 * KHÔNG có field {@code id} - id luôn lấy từ JWT, frontend không được
 * phép chỉ định.
 *
 * @param fullName    họ tên - 2-100 ký tự nếu cung cấp
 * @param phone       SĐT VN - regex {@code 0[3-9]xxxxxxxx} (10 số bắt đầu 03-09)
 * @param bio         tiểu sử ngắn - tối đa 500 ký tự
 * @param twitterUrl  URL Twitter/X
 * @param facebookUrl URL Facebook
 * @param linkedinUrl URL LinkedIn
 */
public record UpdateProfileRequest(

        @Size(min = 2, max = 100, message = "Họ tên dài 2-100 ký tự")
        String fullName,

        @Pattern(
                regexp = "^(0[3-9])[0-9]{8}$",
                message = "Số điện thoại không hợp lệ (định dạng VN: 10 số, bắt đầu bằng 03-09)"
        )
        String phone,

        @Size(max = 500, message = "Tiểu sử không quá 500 ký tự")
        String bio,

        @URL(message = "Twitter URL không hợp lệ")
        @Size(max = 255, message = "URL quá dài")
        String twitterUrl,

        @URL(message = "Facebook URL không hợp lệ")
        @Size(max = 255, message = "URL quá dài")
        String facebookUrl,

        @URL(message = "LinkedIn URL không hợp lệ")
        @Size(max = 255, message = "URL quá dài")
        String linkedinUrl
) {
}

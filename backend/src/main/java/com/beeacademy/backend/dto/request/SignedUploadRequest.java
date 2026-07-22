package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Client khai báo file sắp upload để backend cấp signed upload URL.
 *
 * <p>Đây mới chỉ là lời khai — backend dùng nó để từ chối sớm file sai định dạng
 * hoặc quá lớn, nhưng vẫn phải kiểm tra lại metadata thật sau khi upload xong.
 */
public record SignedUploadRequest(
        @NotBlank String filename,
        // Không @NotBlank: trình duyệt đôi khi không đoán được MIME. Để service báo
        // "Chỉ chấp nhận video MP4..." thay vì lỗi validation khô khan.
        String contentType,
        @NotNull @Min(1) Long sizeBytes
) {}

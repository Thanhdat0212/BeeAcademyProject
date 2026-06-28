package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Size;

/**
 * Tin nhắn trong thread khiếu nại. {@code content} có thể rỗng nếu tin nhắn
 * chỉ gửi kèm file đính kèm — service kiểm tra "rỗng cả nội dung lẫn file".
 */
public record ComplaintMessageRequest(
        @Size(max = 5000, message = "Nội dung tối đa 5000 ký tự")
        String content
) {
    public String contentOrEmpty() {
        return content == null ? "" : content;
    }
}

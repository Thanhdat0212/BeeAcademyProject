package com.beeacademy.backend.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record AiChatRequest(
        @NotEmpty(message = "Cuộc trò chuyện không được để trống")
        @Size(max = 30, message = "Lịch sử trò chuyện tối đa 30 tin nhắn")
        @Valid
        List<Message> messages
) {
    public record Message(
            @NotBlank(message = "Vai trò tin nhắn không được để trống")
            @Pattern(regexp = "user|assistant", message = "Vai trò phải là user hoặc assistant")
            String role,

            @NotBlank(message = "Nội dung tin nhắn không được để trống")
            @Size(max = 4000, message = "Tin nhắn tối đa 4000 ký tự")
            String content
    ) {
    }
}

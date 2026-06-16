package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Size;

public record ApprovalActionRequest(
        @Size(max = 2000, message = "Nhận xét tối đa 2000 ký tự")
        String comment
) {}

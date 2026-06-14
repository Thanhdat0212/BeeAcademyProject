package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Size;

/** Nhận xét của Admin khi approve / reject / needs_revision. */
public record ApprovalActionRequest(

        @Size(max = 2000, message = "Nhận xét tối đa 2000 ký tự")
        String comment
) {}

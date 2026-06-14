package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record BankInfoRequest(
    @NotBlank String bankName,
    @NotBlank @Pattern(regexp = "\\d+", message = "Số tài khoản chỉ được chứa chữ số") String accountNumber,
    @NotBlank String accountHolder,
    @NotBlank String branch,
    String reason
) {}

package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.BankInfoRequest;
import com.beeacademy.backend.dto.request.VerifyBankOtpRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.BankAuditLogResponse;
import com.beeacademy.backend.dto.response.BankChangeRequestResponse;
import com.beeacademy.backend.dto.response.BankInfoResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.TeacherBankService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/teacher/bank")
@RequiredArgsConstructor
public class TeacherBankController {

    private final TeacherBankService bankService;

    @GetMapping
    public ResponseEntity<ApiResponse<BankInfoResponse>> getBankInfo() {
        UUID teacherId = CurrentUser.required().userId();
        return bankService.getBankInfo(teacherId)
                .map(info -> ResponseEntity.ok(ApiResponse.ok(info)))
                .orElse(ResponseEntity.ok(ApiResponse.ok(null)));
    }

    /**
     * Bước 1: xin mã xác nhận gửi về email GV. Chưa ghi gì vào DB.
     *
     * <p>Gọi lại chính endpoint này để "gửi lại mã" — service tự chặn spam bằng
     * cooldown 60 giây, nên không cần endpoint resend riêng.
     */
    @PostMapping("/change-requests")
    public ResponseEntity<ApiResponse<BankChangeRequestResponse>> requestBankChange(
            @Valid @RequestBody BankInfoRequest req) {
        UUID teacherId = CurrentUser.required().userId();
        BankChangeRequestResponse result = bankService.requestBankChange(teacherId, req);
        return ResponseEntity.ok(ApiResponse.ok(result,
                "Đã gửi mã xác nhận tới email " + result.maskedEmail()));
    }

    /** Bước 2: nhập mã đúng → TK được lưu và xác minh ngay. */
    @PostMapping("/change-requests/verify")
    public ResponseEntity<ApiResponse<BankInfoResponse>> confirmBankChange(
            @Valid @RequestBody VerifyBankOtpRequest req) {
        UUID teacherId = CurrentUser.required().userId();
        BankInfoResponse result = bankService.confirmBankChange(teacherId, req.otpCode());
        return ResponseEntity.ok(ApiResponse.ok(result, "Đã xác minh và lưu TK ngân hàng"));
    }

    @GetMapping("/audit-log")
    public ResponseEntity<ApiResponse<List<BankAuditLogResponse>>> getAuditLog() {
        UUID teacherId = CurrentUser.required().userId();
        return ResponseEntity.ok(ApiResponse.ok(bankService.getAuditLog(teacherId)));
    }
}

package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.BankInfoRequest;
import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.BankAuditLogResponse;
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

    @PutMapping
    public ResponseEntity<ApiResponse<BankInfoResponse>> upsertBankInfo(
            @Valid @RequestBody BankInfoRequest req) {
        UUID teacherId = CurrentUser.required().userId();
        BankInfoResponse result = bankService.upsertBankInfo(teacherId, req);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @GetMapping("/audit-log")
    public ResponseEntity<ApiResponse<List<BankAuditLogResponse>>> getAuditLog() {
        UUID teacherId = CurrentUser.required().userId();
        return ResponseEntity.ok(ApiResponse.ok(bankService.getAuditLog(teacherId)));
    }
}

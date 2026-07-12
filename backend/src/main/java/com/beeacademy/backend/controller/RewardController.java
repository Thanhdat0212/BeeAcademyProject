package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.RewardWalletResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.RewardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/rewards")
@RequiredArgsConstructor
@PreAuthorize("hasRole('student')")
public class RewardController {

    private final RewardService rewardService;

    @GetMapping("/wallet")
    public ResponseEntity<ApiResponse<RewardWalletResponse>> getWallet() {
        UUID studentId = CurrentUser.required().userId();
        return ResponseEntity.ok(ApiResponse.ok(rewardService.getWallet(studentId)));
    }

    @PostMapping("/vouchers/{voucherId}/redeem")
    public ResponseEntity<ApiResponse<RewardWalletResponse>> redeemVoucher(@PathVariable UUID voucherId) {
        UUID studentId = CurrentUser.required().userId();
        return ResponseEntity.ok(ApiResponse.ok(rewardService.redeemVoucher(studentId, voucherId)));
    }
}

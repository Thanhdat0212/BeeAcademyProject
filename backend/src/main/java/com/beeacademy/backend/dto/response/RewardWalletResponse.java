package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.RewardVoucher;
import com.beeacademy.backend.model.StudentRewardVoucher;
import com.beeacademy.backend.model.StudentRewardVoucherStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record RewardWalletResponse(
        Integer availablePoints,
        Integer lifetimePoints,
        List<RewardVoucherResponse> catalog,
        List<StudentRewardVoucherResponse> vouchers
) {
    public record RewardVoucherResponse(
            UUID id,
            String code,
            String displayName,
            Integer requiredPoints,
            Integer discountAmount,
            Boolean active
    ) {
        public static RewardVoucherResponse from(RewardVoucher voucher) {
            return new RewardVoucherResponse(
                    voucher.getId(),
                    voucher.getCode(),
                    voucher.getDisplayName(),
                    voucher.getRequiredPoints(),
                    voucher.getDiscountAmount(),
                    voucher.getActive());
        }
    }

    public record StudentRewardVoucherResponse(
            UUID id,
            UUID voucherId,
            String code,
            String displayName,
            Integer discountAmount,
            StudentRewardVoucherStatus status,
            Instant redeemedAt,
            Instant usedAt
    ) {
        public static StudentRewardVoucherResponse from(StudentRewardVoucher studentVoucher) {
            return new StudentRewardVoucherResponse(
                    studentVoucher.getId(),
                    studentVoucher.getVoucher().getId(),
                    studentVoucher.getVoucher().getCode(),
                    studentVoucher.getVoucher().getDisplayName(),
                    studentVoucher.getVoucher().getDiscountAmount(),
                    studentVoucher.getStatus(),
                    studentVoucher.getRedeemedAt(),
                    studentVoucher.getUsedAt());
        }
    }
}

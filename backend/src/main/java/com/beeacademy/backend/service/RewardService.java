package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.response.RewardWalletResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.RewardAssessmentType;
import com.beeacademy.backend.model.RewardVoucher;
import com.beeacademy.backend.model.StudentRewardBalance;
import com.beeacademy.backend.model.StudentRewardSource;
import com.beeacademy.backend.model.StudentRewardVoucher;
import com.beeacademy.backend.model.StudentRewardVoucherStatus;
import com.beeacademy.backend.repository.RewardVoucherRepository;
import com.beeacademy.backend.repository.StudentRewardBalanceRepository;
import com.beeacademy.backend.repository.StudentRewardSourceRepository;
import com.beeacademy.backend.repository.StudentRewardVoucherRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class RewardService {

    private final StudentRewardBalanceRepository balanceRepository;
    private final StudentRewardSourceRepository sourceRepository;
    private final RewardVoucherRepository voucherRepository;
    private final StudentRewardVoucherRepository studentVoucherRepository;

    public record AppliedRewardVoucher(UUID studentVoucherId, int discountAmount) {
        public static AppliedRewardVoucher none() {
            return new AppliedRewardVoucher(null, 0);
        }
    }

    @Transactional
    public int recordExamScore(
            UUID studentId,
            UUID examConfigId,
            double scorePercent) {
        if (studentId == null || examConfigId == null) {
            return 0;
        }
        int points = toRewardPoints(scorePercent);
        double normalizedScore = Math.max(0.0, Math.min(100.0, scorePercent));

        StudentRewardBalance balance = getOrCreateBalance(studentId);
        StudentRewardSource source = sourceRepository
                .findByStudentIdAndAssessmentTypeAndAssessmentId(
                        studentId, RewardAssessmentType.EXAM, examConfigId)
                .orElse(null);

        int delta;
        if (source == null) {
            source = StudentRewardSource.create(
                    studentId, RewardAssessmentType.EXAM, examConfigId, normalizedScore, points);
            sourceRepository.save(source);
            delta = points;
        } else {
            delta = source.updateIfHigher(normalizedScore, points);
        }

        if (delta > 0) {
            balance.addPoints(delta);
            balanceRepository.save(balance);
            log.info("Reward points +{} for student={} exam={}",
                    delta, studentId, examConfigId);
        }
        return delta;
    }

    @Transactional(readOnly = true)
    public RewardWalletResponse getWallet(UUID studentId) {
        StudentRewardBalance balance = balanceRepository.findById(studentId)
                .orElseGet(() -> StudentRewardBalance.create(studentId));
        return toWalletResponse(balance);
    }

    @Transactional
    public RewardWalletResponse redeemVoucher(UUID studentId, UUID voucherId) {
        RewardVoucher voucher = voucherRepository.findById(voucherId)
                .orElseThrow(() -> new ResourceNotFoundException("RewardVoucher", voucherId));
        if (!Boolean.TRUE.equals(voucher.getActive())) {
            throw new BusinessException("VOUCHER_INACTIVE",
                    "Voucher này hiện không khả dụng.", HttpStatus.BAD_REQUEST);
        }

        StudentRewardBalance balance = getOrCreateBalance(studentId);
        if (balance.getAvailablePoints() < voucher.getRequiredPoints()) {
            throw new BusinessException("NOT_ENOUGH_POINTS",
                    "Bạn chưa đủ điểm để đổi voucher này.", HttpStatus.BAD_REQUEST);
        }

        balance.spendPoints(voucher.getRequiredPoints());
        balanceRepository.save(balance);
        studentVoucherRepository.save(StudentRewardVoucher.redeem(studentId, voucher));
        return toWalletResponse(balance);
    }

    @Transactional
    public AppliedRewardVoucher reserveVoucherForOrder(
            UUID studentId,
            UUID studentVoucherId,
            UUID orderId,
            int subtotalAmount) {
        if (studentVoucherId == null) {
            return AppliedRewardVoucher.none();
        }
        StudentRewardVoucher studentVoucher = studentVoucherRepository
                .findByIdAndStudentIdAndStatus(
                        studentVoucherId, studentId, StudentRewardVoucherStatus.AVAILABLE)
                .orElseThrow(() -> new BusinessException("VOUCHER_NOT_AVAILABLE",
                        "Voucher không khả dụng hoặc đã được sử dụng.", HttpStatus.BAD_REQUEST));

        int discount = Math.min(
                Math.max(0, subtotalAmount),
                studentVoucher.getVoucher().getDiscountAmount());
        if (discount <= 0) {
            throw new BusinessException("VOUCHER_NOT_APPLICABLE",
                    "Voucher không áp dụng được cho đơn hàng này.", HttpStatus.BAD_REQUEST);
        }

        studentVoucher.reserveForOrder(orderId);
        studentVoucherRepository.save(studentVoucher);
        return new AppliedRewardVoucher(studentVoucher.getId(), discount);
    }

    @Transactional
    public void markVoucherUsed(UUID studentVoucherId, UUID studentId) {
        if (studentVoucherId == null) {
            return;
        }
        StudentRewardVoucher voucher = studentVoucherRepository
                .findByIdAndStudentId(studentVoucherId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("StudentRewardVoucher", studentVoucherId));
        if (voucher.getStatus() == StudentRewardVoucherStatus.USED) {
            return;
        }
        voucher.markUsed();
        studentVoucherRepository.save(voucher);
    }

    @Transactional
    public void releaseVoucherReservation(UUID studentVoucherId, UUID studentId, UUID orderId) {
        if (studentVoucherId == null || orderId == null) {
            return;
        }
        StudentRewardVoucher voucher = studentVoucherRepository
                .findByIdAndStudentId(studentVoucherId, studentId)
                .orElse(null);
        if (voucher == null || voucher.getStatus() == StudentRewardVoucherStatus.USED) {
            return;
        }
        voucher.releaseReservation(orderId);
        studentVoucherRepository.save(voucher);
    }

    private StudentRewardBalance getOrCreateBalance(UUID studentId) {
        return balanceRepository.findById(studentId)
                .orElseGet(() -> balanceRepository.save(StudentRewardBalance.create(studentId)));
    }

    private RewardWalletResponse toWalletResponse(StudentRewardBalance balance) {
        List<RewardWalletResponse.RewardVoucherResponse> catalog = voucherRepository
                .findByActiveTrueOrderBySortOrderAscRequiredPointsAsc()
                .stream()
                .map(RewardWalletResponse.RewardVoucherResponse::from)
                .toList();
        List<RewardWalletResponse.StudentRewardVoucherResponse> vouchers = studentVoucherRepository
                .findByStudentIdOrderByRedeemedAtDesc(balance.getStudentId())
                .stream()
                .map(RewardWalletResponse.StudentRewardVoucherResponse::from)
                .toList();
        return new RewardWalletResponse(
                balance.getAvailablePoints(),
                balance.getLifetimePoints(),
                catalog,
                vouchers);
    }

    private int toRewardPoints(double scorePercent) {
        if (Double.isNaN(scorePercent) || Double.isInfinite(scorePercent)) {
            return 0;
        }
        return Math.max(0, Math.min(100, (int) Math.round(scorePercent)));
    }
}

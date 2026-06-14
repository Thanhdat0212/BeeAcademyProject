package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.ConfirmPayoutRequest;
import com.beeacademy.backend.dto.response.AdminPayoutRowResponse;
import com.beeacademy.backend.dto.response.AdminPayoutStatsResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.PayoutPeriod;
import com.beeacademy.backend.model.PayoutStatus;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.TeacherBankAccount;
import com.beeacademy.backend.repository.PayoutPeriodRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.RevenueSplitRepository;
import com.beeacademy.backend.repository.TeacherBankAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Đối soát & chi lương GV cho Admin (UC37 xem doanh thu, UC39 xuất báo cáo,
 * UC40 xác nhận chuyển khoản).
 *
 * <p>Mỗi dòng đối soát = 1 {@link PayoutPeriod} (1 GV / 1 tháng). Tổng tiền
 * lấy từ {@code revenue_splits} đã ghi tự động qua webhook PayOS. Service này
 * chỉ đọc + xác nhận chuyển khoản, KHÔNG backfill (đắt khi quét toàn bộ GV).
 */
@Service
@RequiredArgsConstructor
public class AdminPayoutService {

    private static final DateTimeFormatter MONTH_FMT = DateTimeFormatter.ofPattern("yyyy-MM");

    private final PayoutPeriodRepository periodRepository;
    private final RevenueSplitRepository splitRepository;
    private final ProfileRepository profileRepository;
    private final TeacherBankAccountRepository bankRepository;

    @Transactional(readOnly = true)
    public List<AdminPayoutRowResponse> listPayouts() {
        List<PayoutPeriod> periods = periodRepository.findAllByOrderByMonthYearDescCreatedAtDesc();
        if (periods.isEmpty()) {
            return List.of();
        }

        String currentMonth = ZonedDateTime.now(ZoneOffset.UTC).format(MONTH_FMT);

        // Batch-load tên GV + TK ngân hàng theo danh sách teacherId (tránh N+1).
        List<UUID> teacherIds = periods.stream().map(PayoutPeriod::getTeacherId).distinct().toList();
        Map<UUID, String> teacherNames = profileRepository.findAllById(teacherIds).stream()
                .collect(Collectors.toMap(Profile::getId,
                        p -> p.getFullName() != null ? p.getFullName() : "Giáo viên"));
        Map<UUID, TeacherBankAccount> banks = bankRepository.findByTeacherIdIn(teacherIds).stream()
                .collect(Collectors.toMap(TeacherBankAccount::getTeacherId, Function.identity()));

        return periods.stream()
                .map(p -> toRow(p, currentMonth, teacherNames, banks))
                .toList();
    }

    @Transactional(readOnly = true)
    public AdminPayoutStatsResponse getStats() {
        String currentMonth = ZonedDateTime.now(ZoneOffset.UTC).format(MONTH_FMT);
        long currentMonthGross = periodRepository.findByMonthYear(currentMonth).stream()
                .mapToLong(p -> splitRepository.sumGrossAmountByPeriodId(p.getId()))
                .sum();
        long pending  = splitRepository.sumUnpaidTeacherAmount(PayoutStatus.PAID);
        long platform = splitRepository.sumAllPlatformFee();
        return new AdminPayoutStatsResponse(currentMonthGross, pending, platform);
    }

    @Transactional
    public AdminPayoutRowResponse confirmPayout(UUID periodId, ConfirmPayoutRequest req, UUID adminId) {
        PayoutPeriod period = periodRepository.findById(periodId)
                .orElseThrow(() -> new ResourceNotFoundException("PayoutPeriod", periodId));
        if (period.isPaid()) {
            throw new BusinessException("ALREADY_PAID", "Kỳ này đã được xác nhận chuyển khoản.");
        }
        period.markPaid(adminId, req.transferRef(), req.transferContent());
        periodRepository.save(period);

        String currentMonth = ZonedDateTime.now(ZoneOffset.UTC).format(MONTH_FMT);
        String teacherName = profileRepository.findById(period.getTeacherId())
                .map(Profile::getFullName).orElse("Giáo viên");
        TeacherBankAccount bank = bankRepository.findByTeacherId(period.getTeacherId()).orElse(null);
        return toRow(period, currentMonth,
                Map.of(period.getTeacherId(), teacherName != null ? teacherName : "Giáo viên"),
                bank != null ? Map.of(period.getTeacherId(), bank) : Map.of());
    }

    /** Map 1 kỳ → DTO, gộp tổng tiền + thông tin GV/bank đã batch-load. */
    private AdminPayoutRowResponse toRow(PayoutPeriod p, String currentMonth,
                                         Map<UUID, String> teacherNames,
                                         Map<UUID, TeacherBankAccount> banks) {
        long gross   = splitRepository.sumGrossAmountByPeriodId(p.getId());
        long teacher = splitRepository.sumTeacherAmountByPeriodId(p.getId());
        long count   = splitRepository.countByPayoutPeriodId(p.getId());
        TeacherBankAccount bank = banks.get(p.getTeacherId());
        boolean overdue = !p.isPaid() && p.getMonthYear().compareTo(currentMonth) < 0;

        return new AdminPayoutRowResponse(
                p.getId(),
                p.getTeacherId(),
                teacherNames.getOrDefault(p.getTeacherId(), "Giáo viên"),
                p.getMonthYear(),
                bank != null ? bank.getBankName()      : null,
                bank != null ? bank.getAccountNumber() : null,
                bank != null ? bank.getAccountHolder() : null,
                gross,
                gross - teacher,
                teacher,
                count,
                p.getStatus(),
                overdue,
                p.getPaidAt(),
                p.getTransferRef(),
                p.getTransferContent());
    }
}

package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.PayoutStatus;
import com.beeacademy.backend.model.RevenueSplit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RevenueSplitRepository extends JpaRepository<RevenueSplit, UUID> {

    List<RevenueSplit> findByTeacherIdOrderByOccurredAtDesc(UUID teacherId);

    List<RevenueSplit> findByPayoutPeriodIdOrderByOccurredAtDesc(UUID payoutPeriodId);

    boolean existsByOrderItemId(UUID orderItemId);

    @Query("SELECT COALESCE(SUM(s.teacherAmount), 0) FROM RevenueSplit s WHERE s.payoutPeriodId = :periodId")
    long sumTeacherAmountByPeriodId(@Param("periodId") UUID periodId);

    @Query("SELECT COALESCE(SUM(s.grossAmount), 0) FROM RevenueSplit s WHERE s.payoutPeriodId = :periodId")
    long sumGrossAmountByPeriodId(@Param("periodId") UUID periodId);

    long countByPayoutPeriodId(UUID payoutPeriodId);

    // ── Aggregate toàn hệ thống cho Admin Dashboard (UC34) ──────────────

    /** Tổng GMV: toàn bộ tiền học sinh đã trả qua các giao dịch đã split. */
    @Query("SELECT COALESCE(SUM(s.grossAmount), 0) FROM RevenueSplit s")
    long sumAllGrossAmount();

    /** Tổng phí nền tảng (30%) công ty giữ lại — quỹ vận hành. */
    @Query("SELECT COALESCE(SUM(s.platformFee), 0) FROM RevenueSplit s")
    long sumAllPlatformFee();

    /**
     * Tổng phần GV của các kỳ CHƯA thanh toán (status khác PAID) —
     * chính là số tiền Admin còn nợ giáo viên ("Tiền cần chuyển kỳ này").
     */
    @Query("SELECT COALESCE(SUM(s.teacherAmount), 0) FROM RevenueSplit s " +
           "WHERE s.payoutPeriodId IN (SELECT p.id FROM PayoutPeriod p WHERE p.status <> :paidStatus)")
    long sumUnpaidTeacherAmount(@Param("paidStatus") PayoutStatus paidStatus);
}

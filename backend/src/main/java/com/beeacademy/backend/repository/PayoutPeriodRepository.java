package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.PayoutPeriod;
import com.beeacademy.backend.model.PayoutStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PayoutPeriodRepository extends JpaRepository<PayoutPeriod, UUID> {

    Optional<PayoutPeriod> findByTeacherIdAndMonthYear(UUID teacherId, String monthYear);

    List<PayoutPeriod> findByTeacherIdOrderByMonthYearDesc(UUID teacherId);

    /**
     * Số GV "trễ hạn": có kỳ chưa thanh toán thuộc tháng đã qua.
     * monthYear định dạng "yyyy-MM" nên so sánh chuỗi {@code <} đúng
     * thứ tự thời gian — không cần parse về date.
     */
    @Query("SELECT COUNT(DISTINCT p.teacherId) FROM PayoutPeriod p " +
           "WHERE p.status <> :paidStatus AND p.monthYear < :currentMonth")
    long countOverdueTeachers(@Param("paidStatus") PayoutStatus paidStatus,
                              @Param("currentMonth") String currentMonth);

    /** Tất cả kỳ thanh toán, mới nhất trước — cho bảng đối soát Admin (UC37/39). */
    List<PayoutPeriod> findAllByOrderByMonthYearDescCreatedAtDesc();

    /** Các kỳ thuộc một tháng — dùng tính GMV tháng hiện tại cho thẻ thống kê. */
    List<PayoutPeriod> findByMonthYear(String monthYear);
}

package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.RevenueSplit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RevenueSplitRepository extends JpaRepository<RevenueSplit, UUID> {

    List<RevenueSplit> findByTeacherIdOrderByOccurredAtDesc(UUID teacherId);

    List<RevenueSplit> findByPayoutPeriodIdOrderByOccurredAtDesc(UUID payoutPeriodId);

    boolean existsByOrderItemId(UUID orderItemId);

    @Query("SELECT COALESCE(SUM(s.teacherAmount), 0) FROM RevenueSplit s WHERE s.payoutPeriodId = :periodId")
    long sumTeacherAmountByPeriodId(UUID periodId);

    @Query("SELECT COALESCE(SUM(s.grossAmount), 0) FROM RevenueSplit s WHERE s.payoutPeriodId = :periodId")
    long sumGrossAmountByPeriodId(UUID periodId);

    long countByPayoutPeriodId(UUID payoutPeriodId);
}

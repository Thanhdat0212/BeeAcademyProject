package com.beeacademy.backend.repository;

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

    @Query("SELECT COALESCE(SUM(s.teacherAmount), 0) FROM RevenueSplit s WHERE s.payoutPeriodId = :periodId")
    long sumTeacherAmountByPeriodId(@Param("periodId") UUID periodId);

    @Query("SELECT COALESCE(SUM(s.grossAmount), 0) FROM RevenueSplit s WHERE s.payoutPeriodId = :periodId")
    long sumGrossAmountByPeriodId(@Param("periodId") UUID periodId);

    long countByPayoutPeriodId(UUID payoutPeriodId);
}

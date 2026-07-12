package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.RewardVoucher;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RewardVoucherRepository extends JpaRepository<RewardVoucher, UUID> {

    List<RewardVoucher> findByActiveTrueOrderBySortOrderAscRequiredPointsAsc();
}

package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.StudentRewardVoucher;
import com.beeacademy.backend.model.StudentRewardVoucherStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StudentRewardVoucherRepository extends JpaRepository<StudentRewardVoucher, UUID> {

    List<StudentRewardVoucher> findByStudentIdOrderByRedeemedAtDesc(UUID studentId);

    Optional<StudentRewardVoucher> findByIdAndStudentId(UUID id, UUID studentId);

    Optional<StudentRewardVoucher> findByIdAndStudentIdAndStatus(
            UUID id,
            UUID studentId,
            StudentRewardVoucherStatus status);
}

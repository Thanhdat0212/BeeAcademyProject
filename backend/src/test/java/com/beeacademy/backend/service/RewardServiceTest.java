package com.beeacademy.backend.service;

import com.beeacademy.backend.model.RewardAssessmentType;
import com.beeacademy.backend.model.StudentRewardBalance;
import com.beeacademy.backend.repository.RewardVoucherRepository;
import com.beeacademy.backend.repository.StudentRewardBalanceRepository;
import com.beeacademy.backend.repository.StudentRewardSourceRepository;
import com.beeacademy.backend.repository.StudentRewardVoucherRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RewardServiceTest {

    @Mock StudentRewardBalanceRepository balanceRepository;
    @Mock StudentRewardSourceRepository sourceRepository;
    @Mock RewardVoucherRepository voucherRepository;
    @Mock StudentRewardVoucherRepository studentVoucherRepository;

    @InjectMocks RewardService rewardService;

    @Test
    void recordExamScoreAwardsOnlyTheExamScore() {
        UUID studentId = UUID.randomUUID();
        UUID examConfigId = UUID.randomUUID();
        StudentRewardBalance balance = StudentRewardBalance.create(studentId);

        when(balanceRepository.findById(studentId)).thenReturn(Optional.of(balance));
        when(sourceRepository.findByStudentIdAndAssessmentTypeAndAssessmentId(
                studentId, RewardAssessmentType.EXAM, examConfigId))
                .thenReturn(Optional.empty());

        int awarded = rewardService.recordExamScore(studentId, examConfigId, 82.6);

        assertThat(awarded).isEqualTo(83);
        assertThat(balance.getAvailablePoints()).isEqualTo(83);
        assertThat(balance.getLifetimePoints()).isEqualTo(83);
        verify(sourceRepository).findByStudentIdAndAssessmentTypeAndAssessmentId(
                studentId, RewardAssessmentType.EXAM, examConfigId);
        verify(balanceRepository).save(balance);
    }
}

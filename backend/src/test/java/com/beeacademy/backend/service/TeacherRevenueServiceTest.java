package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.response.TeacherStatsResponse;
import com.beeacademy.backend.model.RevenueSplit;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.OrderItemRepository;
import com.beeacademy.backend.repository.OrderRepository;
import com.beeacademy.backend.repository.PayoutPeriodRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.RevenueSplitRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TeacherRevenueServiceTest {

    @Mock RevenueSplitRepository splitRepository;
    @Mock PayoutPeriodRepository periodRepository;
    @Mock ProfileRepository profileRepository;
    @Mock CourseRepository courseRepository;
    @Mock EnrollmentRepository enrollmentRepository;
    @Mock OrderRepository orderRepository;
    @Mock OrderItemRepository orderItemRepository;

    @InjectMocks TeacherRevenueService service;

    @Test
    void getTeacherStatsIgnoresLegacySplitWithNullCourseId() {
        UUID teacherId = UUID.randomUUID();
        UUID studentId = UUID.randomUUID();
        RevenueSplit legacySplit = RevenueSplit.create(
                teacherId,
                studentId,
                null,
                UUID.randomUUID(),
                UUID.randomUUID(),
                null,
                "2026-07",
                100_000);

        when(courseRepository.findByTeacherId(teacherId)).thenReturn(List.of());
        when(splitRepository.findByTeacherIdOrderByOccurredAtDesc(teacherId))
                .thenReturn(List.of(legacySplit));

        TeacherStatsResponse result = service.getTeacherStats(teacherId);

        assertThat(result.uniqueStudentsTotal()).isEqualTo(1);
        assertThat(result.courseEnrollmentCounts()).isEmpty();
        assertThat(result.recentSplits()).hasSize(1);
        assertThat(result.recentSplits().getFirst().courseId()).isNull();
    }
}

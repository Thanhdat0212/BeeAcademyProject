package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.response.StudentLearningProgressResponse;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class LearningProgressPdfServiceTest {

    @Test
    void generateCreatesPdfContainingFourExamRows() {
        CourseProgressService progressService = mock(CourseProgressService.class);
        ProfileRepository profileRepository = mock(ProfileRepository.class);
        LearningProgressPdfService service = new LearningProgressPdfService(progressService, profileRepository);
        UUID studentId = UUID.randomUUID();
        UUID versionId = UUID.randomUUID();
        AuthenticatedUser me = new AuthenticatedUser(studentId, "student@example.com", "student");
        Profile profile = mock(Profile.class);
        when(profile.getFullName()).thenReturn("Nguyễn Văn An");
        when(profileRepository.findById(studentId)).thenReturn(Optional.of(profile));
        when(progressService.getLearningProgress(me)).thenReturn(progress(versionId));

        byte[] pdf = service.generate(me);

        assertThat(pdf.length).isGreaterThan(1_000);
        assertThat(new String(pdf, 0, 5, StandardCharsets.ISO_8859_1)).isEqualTo("%PDF-");
    }

    private StudentLearningProgressResponse progress(UUID versionId) {
        List<StudentLearningProgressResponse.RequiredExamProgress> exams = List.of(
                exam(0, "Giữa kỳ 1", "passed", 85.0, true),
                exam(1, "Cuối kỳ 1", "failed", 45.0, false),
                exam(2, "Giữa kỳ 2", "pending_grading", 70.0, null),
                exam(3, "Cuối kỳ 2", "not_submitted", null, null));
        var course = new StudentLearningProgressResponse.CourseProgressDetail(
                UUID.randomUUID(),
                versionId,
                "toan-8",
                "Toán lớp 8",
                null,
                "Toán học",
                "Giáo viên A",
                75,
                15,
                20,
                3,
                4,
                8.0,
                false,
                false,
                1,
                exams,
                Instant.parse("2026-01-01T00:00:00Z"),
                List.of(),
                76.5,
                3_600L,
                List.of());
        return new StudentLearningProgressResponse(
                1, 75, 15, 20, 3, 4, List.of(course), 76.5, 3_600L);
    }

    private StudentLearningProgressResponse.RequiredExamProgress exam(
            int slot,
            String label,
            String status,
            Double score,
            Boolean passed
    ) {
        return new StudentLearningProgressResponse.RequiredExamProgress(
                slot,
                label,
                status,
                UUID.randomUUID(),
                UUID.randomUUID(),
                true,
                score,
                passed,
                Instant.parse("2026-07-17T08:00:00Z"),
                null,
                null,
                null,
                null);
    }
}

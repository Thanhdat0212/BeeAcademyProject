package com.beeacademy.backend.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ReviewContentModerationServiceTest {

    private final ReviewContentModerationService service = new ReviewContentModerationService();

    @Test
    void flagsProhibitedTermsWithoutDependingOnVietnameseDiacritics() {
        assertThat(service.requiresModeration("Noi dung nay that do ngu va khong phu hop.")).isTrue();
        assertThat(service.requiresModeration("Noi dung nay rất đồ ngu va khong phu hop.")).isTrue();
    }

    @Test
    void allowsConstructiveFeedback() {
        assertThat(service.requiresModeration("Bai giang de hieu, nhung minh muon co them bai tap.")).isFalse();
    }
}

package com.beeacademy.backend.model;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ParentStudentLinkStatusTest {

    @Test
    void apiValuesExposeActiveAsTheCanonicalLinkedState() {
        assertThat(ParentStudentLinkStatus.values())
                .extracting(ParentStudentLinkStatus::toApiValue)
                .containsExactly("pending", "active", "rejected", "expired", "revoked")
                .doesNotContain("accepted");
    }

    @Test
    void activeIsTheCanonicalInternalApiAndDatabaseStatus() {
        assertThat(ParentStudentLinkStatus.ACTIVE.toDbValue()).isEqualTo("active");
        assertThat(ParentStudentLinkStatus.ACTIVE.toApiValue()).isEqualTo("active");
        assertThat(ParentStudentLinkStatus.fromDbValue("active"))
                .isEqualTo(ParentStudentLinkStatus.ACTIVE);
    }

    @Test
    void legacyAcceptedValueStillReadsAsActive() {
        assertThat(ParentStudentLinkStatus.fromDbValue("accepted"))
                .isEqualTo(ParentStudentLinkStatus.ACTIVE);
    }
}

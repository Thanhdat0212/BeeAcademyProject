package com.beeacademy.backend.dto.request;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class RevokeParentStudentLinkRequestValidationTest {

    private final Validator validator = Validation
            .buildDefaultValidatorFactory()
            .getValidator();

    @Test
    void acceptsOperationIdAndOptionalReason() {
        var violations = validator.validate(
                new RevokeParentStudentLinkRequest(UUID.randomUUID(), null));

        assertThat(violations).isEmpty();
    }

    @Test
    void rejectsMissingOperationIdAndReasonOverFiveHundredCharacters() {
        var violations = validator.validate(
                new RevokeParentStudentLinkRequest(null, "x".repeat(501)));

        assertThat(violations)
                .extracting(violation -> violation.getPropertyPath().toString())
                .containsExactlyInAnyOrder("operationId", "reason");
    }
}

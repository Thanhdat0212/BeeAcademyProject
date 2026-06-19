package com.beeacademy.backend.dto.request;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class GradeExamAttemptRequestValidationTest {

    private final Validator validator = Validation
            .buildDefaultValidatorFactory()
            .getValidator();

    @Test
    void acceptsScoreWithinRange() {
        var violations = validator.validate(
                new GradeExamAttemptRequest(87.5, "Nhận xét"));

        assertThat(violations).isEmpty();
    }

    @Test
    void rejectsScoreAboveOneHundred() {
        var violations = validator.validate(
                new GradeExamAttemptRequest(100.1, null));

        assertThat(violations)
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("scorePercent");
    }
}

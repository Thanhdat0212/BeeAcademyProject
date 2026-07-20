package com.beeacademy.backend.dto.request;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class CreateQaThreadRequestValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void rejectsMissingTitleAndContentShorterThanTenCharacters() {
        var request = new CreateQaThreadRequest(
                UUID.randomUUID(), null, " ", "123456789", "public",
                null, null, null, null);

        var invalidFields = validator.validate(request).stream()
                .map(violation -> violation.getPropertyPath().toString())
                .toList();

        assertThat(invalidFields).contains("title", "content");
    }

    @Test
    void acceptsCompleteUc21Question() {
        var request = new CreateQaThreadRequest(
                UUID.randomUUID(), null, "Câu hỏi bài 3", "Nội dung đủ mười ký tự", "private",
                null, null, null, null);

        assertThat(validator.validate(request)).isEmpty();
    }
}

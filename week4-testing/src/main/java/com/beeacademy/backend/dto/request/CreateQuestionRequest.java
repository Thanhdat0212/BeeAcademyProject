package com.beeacademy.backend.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record CreateQuestionRequest(
        @NotNull(message = "Vui lòng chọn môn học")
        UUID categoryId,

        @NotNull(message = "Vui lòng chọn lớp")
        Integer grade,

        UUID chapterId,

        @NotBlank(message = "Nội dung câu hỏi không được trống")
        @Size(max = 5000)
        String content,

        @Size(max = 2000)
        String explanation,

        @NotNull
        @Pattern(regexp = "easy|medium|hard", message = "Độ khó phải là: easy, medium, hard")
        String difficulty,

        @NotNull
        @Pattern(regexp = "multiple_choice|true_false", message = "Loại phải là: multiple_choice, true_false")
        String type,

        @NotNull
        @Size(min = 2, max = 4, message = "Câu hỏi phải có 2-4 đáp án")
        @Valid
        List<ChoiceRequest> choices
) {
    public record ChoiceRequest(
            @NotBlank String content,
            boolean isCorrect
    ) {}
}

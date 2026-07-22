package com.beeacademy.backend.dto.request;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;

import java.util.List;
import java.util.UUID;

/** Tạo câu hỏi mới vào ngân hàng câu hỏi. */
public record CreateQuestionRequest(

        @NotNull(message = "Vui lòng chọn môn học")
        UUID categoryId,

        @NotNull(message = "Vui lòng chọn lớp")
        Integer grade,

        UUID questionBankId,

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
        @Pattern(
                regexp = "multiple_choice|true_false|fill_in_blank|matching|essay|essay_short|essay_long|image_question|formula_question|audio_question|file_upload",
                message = "Loại câu hỏi không hợp lệ")
        String type,

        @Size(max = 6, message = "Câu hỏi trắc nghiệm có tối đa 6 đáp án")
        @Valid
        List<ChoiceRequest> choices,

        @DecimalMin(value = "0.01", message = "Điểm câu hỏi phải lớn hơn 0")
        @DecimalMax(value = "100", message = "Điểm câu hỏi tối đa là 100")
        Double defaultPoints,

        @Size(max = 20, message = "Mỗi câu hỏi có tối đa 20 tag")
        List<@Size(max = 50, message = "Tag tối đa 50 ký tự") String> tags,

        JsonNode metadata
) {
    public record ChoiceRequest(
            @NotBlank String content,
            boolean isCorrect
    ) {}
}

package com.beeacademy.backend.dto.request;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

/** Tao cau hoi moi vao ngan hang cau hoi. */
public record CreateQuestionRequest(

        @NotNull(message = "Vui long chon mon hoc")
        UUID categoryId,

        @NotNull(message = "Vui long chon lop")
        Integer grade,

        UUID questionBankId,

        UUID chapterId,

        @NotBlank(message = "Noi dung cau hoi khong duoc trong")
        @Size(max = 5000)
        String content,

        @Size(max = 2000)
        String explanation,

        @NotNull
        @Pattern(regexp = "easy|medium|hard", message = "Do kho phai la: easy, medium, hard")
        String difficulty,

        @NotNull
        @Pattern(
                regexp = "multiple_choice|true_false|fill_in_blank|matching|essay|essay_short|essay_long|image_question|formula_question|audio_question|file_upload",
                message = "Loai cau hoi khong hop le")
        String type,

        @Size(max = 6, message = "Cau hoi trac nghiem co toi da 6 dap an")
        @Valid
        List<ChoiceRequest> choices,

        JsonNode metadata
) {
    public record ChoiceRequest(
            @NotBlank String content,
            boolean isCorrect
    ) {}
}

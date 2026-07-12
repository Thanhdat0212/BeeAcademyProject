package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record SaveStudentLessonNoteRequest(
        @NotNull(message = "Moc thoi gian la bat buoc")
        @PositiveOrZero(message = "Moc thoi gian khong duoc am")
        @Max(value = 604800, message = "Moc thoi gian khong hop le")
        Integer timeSec,

        @NotBlank(message = "Noi dung ghi chu la bat buoc")
        @Size(max = 2000, message = "Ghi chu toi da 2000 ky tu")
        String content
) {
}

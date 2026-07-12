package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.QuestionBank;
import com.beeacademy.backend.repository.QuestionBankRepository;

import java.time.Instant;
import java.util.UUID;

public record QuestionBankResponse(
        UUID id,
        String title,
        String description,
        String status,
        UUID categoryId,
        String categoryName,
        Integer grade,
        long questionCount,
        Instant createdAt,
        Instant updatedAt
) {

    public static QuestionBankResponse fromEntity(QuestionBank bank, long questionCount) {
        return new QuestionBankResponse(
                bank.getId(),
                bank.getTitle(),
                bank.getDescription(),
                bank.getStatus(),
                bank.getCategory().getId(),
                bank.getCategory().getName(),
                bank.getGrade(),
                questionCount,
                bank.getCreatedAt(),
                bank.getUpdatedAt()
        );
    }

    public static QuestionBankResponse fromSummary(QuestionBankRepository.QuestionBankSummaryView summary) {
        return new QuestionBankResponse(
                summary.getId(),
                summary.getTitle(),
                summary.getDescription(),
                summary.getStatus(),
                summary.getCategoryId(),
                summary.getCategoryName(),
                summary.getGrade(),
                summary.getQuestionCount() != null ? summary.getQuestionCount() : 0L,
                summary.getCreatedAt(),
                summary.getUpdatedAt()
        );
    }
}

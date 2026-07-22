package com.beeacademy.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "question_versions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class QuestionVersion {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    private Question question;

    @Column(name = "teacher_id", nullable = false)
    private UUID teacherId;

    @Column(name = "version_no", nullable = false)
    private Integer versionNo;

    @Column(name = "question_bank_id")
    private UUID questionBankId;

    @Column(name = "category_id")
    private UUID categoryId;

    @Column(name = "grade")
    private Integer grade;

    @Column(name = "chapter_id")
    private UUID chapterId;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "explanation", columnDefinition = "TEXT")
    private String explanation;

    @Column(name = "default_points", columnDefinition = "NUMERIC(6,2)")
    private Double defaultPoints;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "tags_json", columnDefinition = "jsonb")
    private String tagsJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata_json", columnDefinition = "jsonb")
    private String metadataJson;

    @Column(name = "difficulty", nullable = false)
    private String difficulty;

    @Column(name = "type", nullable = false)
    private String type;

    @Column(name = "status")
    private String status;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "choices_json", nullable = false, columnDefinition = "jsonb")
    private String choicesJson;

    @Column(name = "change_reason")
    private String changeReason;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public static QuestionVersion snapshot(Question question, int versionNo,
                                           String choicesJson, String changeReason) {
        QuestionVersion version = new QuestionVersion();
        version.id = UUID.randomUUID();
        version.question = question;
        version.teacherId = question.getTeacher().getId();
        version.versionNo = versionNo;
        version.questionBankId = question.getQuestionBank() != null
                ? question.getQuestionBank().getId()
                : null;
        version.categoryId = question.getCategory() != null
                ? question.getCategory().getId()
                : null;
        version.grade = question.getGrade();
        version.chapterId = question.getChapter() != null
                ? question.getChapter().getId()
                : null;
        version.content = question.getContent();
        version.explanation = question.getExplanation();
        version.defaultPoints = question.getDefaultPoints();
        version.tagsJson = question.getTagsJson();
        version.metadataJson = question.getMetadataJson();
        version.difficulty = question.getDifficulty();
        version.type = question.getType();
        version.status = question.getStatus();
        version.choicesJson = choicesJson;
        version.changeReason = changeReason == null || changeReason.isBlank()
                ? "Question updated after it was used in attempts."
                : changeReason.trim();
        return version;
    }

    public boolean matches(Question question, String currentChoicesJson) {
        return Objects.equals(questionBankId,
                        question.getQuestionBank() != null ? question.getQuestionBank().getId() : null)
                && Objects.equals(categoryId,
                        question.getCategory() != null ? question.getCategory().getId() : null)
                && Objects.equals(grade, question.getGrade())
                && Objects.equals(chapterId,
                        question.getChapter() != null ? question.getChapter().getId() : null)
                && Objects.equals(content, question.getContent())
                && Objects.equals(explanation, question.getExplanation())
                && Objects.equals(defaultPoints, question.getDefaultPoints())
                && Objects.equals(tagsJson, question.getTagsJson())
                && Objects.equals(metadataJson, question.getMetadataJson())
                && Objects.equals(difficulty, question.getDifficulty())
                && Objects.equals(type, question.getType())
                && Objects.equals(status, question.getStatus())
                && Objects.equals(choicesJson, currentChoicesJson);
    }
}

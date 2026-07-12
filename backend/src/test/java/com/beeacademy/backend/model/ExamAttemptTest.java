package com.beeacademy.backend.model;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class ExamAttemptTest {

    @Test
    void saveDraftStoresAnswersBeforeSubmission() {
        ExamAttempt attempt = new ExamAttempt();

        attempt.saveDraft("{\"q1\":{\"selectedIndices\":[0]}}");

        assertThat(attempt.getAnswers()).isEqualTo("{\"q1\":{\"selectedIndices\":[0]}}");
        assertThat(attempt.getSubmittedAt()).isNull();
    }

    @Test
    void submitStoresAnswersScorePassStatusAndSubmittedAt() {
        ExamAttempt attempt = new ExamAttempt();

        attempt.submit("{\"q1\":{\"selectedIndices\":[1]}}", 82.46, true);

        assertThat(attempt.getAnswers()).isEqualTo("{\"q1\":{\"selectedIndices\":[1]}}");
        assertThat(attempt.getScorePercent()).isEqualByComparingTo("82.5");
        assertThat(attempt.getEffectiveScorePercent()).isEqualByComparingTo("82.5");
        assertThat(attempt.getPassed()).isTrue();
        assertThat(attempt.getSubmittedAt()).isNotNull();
    }

    @Test
    void saveDraftDoesNotOverwriteSubmittedAttempt() {
        ExamAttempt attempt = new ExamAttempt();
        ReflectionTestUtils.setField(attempt, "answers", "{\"q1\":{\"selectedIndices\":[1]}}");
        ReflectionTestUtils.setField(attempt, "submittedAt", Instant.now());

        attempt.saveDraft("{\"q1\":{\"selectedIndices\":[0]}}");

        assertThat(attempt.getAnswers()).isEqualTo("{\"q1\":{\"selectedIndices\":[1]}}");
    }

    @Test
    void gradeStoresManualScoreAndMarksAttemptAsPassed() {
        ExamConfig config = new ExamConfig();
        ReflectionTestUtils.setField(config, "passScorePercent", 60);
        ExamAttempt attempt = new ExamAttempt();
        ReflectionTestUtils.setField(attempt, "examConfig", config);
        ReflectionTestUtils.setField(attempt, "scorePercent", BigDecimal.valueOf(55));

        attempt.grade(75.5, "  Bài làm tốt.  ");

        assertThat(attempt.getManualScorePercent()).isEqualByComparingTo("75.5");
        assertThat(attempt.getEffectiveScorePercent()).isEqualByComparingTo("75.5");
        assertThat(attempt.getTeacherFeedback()).isEqualTo("Bài làm tốt.");
        assertThat(attempt.getPassed()).isTrue();
        assertThat(attempt.getGradedAt()).isNotNull();
    }

    @Test
    void gradeRecalculatesPassedWhenManualScoreIsBelowThreshold() {
        ExamConfig config = new ExamConfig();
        ReflectionTestUtils.setField(config, "passScorePercent", 70);
        ExamAttempt attempt = new ExamAttempt();
        ReflectionTestUtils.setField(attempt, "examConfig", config);
        ReflectionTestUtils.setField(attempt, "scorePercent", BigDecimal.valueOf(90));
        ReflectionTestUtils.setField(attempt, "passed", true);

        attempt.grade(65, "Cần ôn lại.");

        assertThat(attempt.getEffectiveScorePercent()).isEqualByComparingTo("65.0");
        assertThat(attempt.getPassed()).isFalse();
    }
}

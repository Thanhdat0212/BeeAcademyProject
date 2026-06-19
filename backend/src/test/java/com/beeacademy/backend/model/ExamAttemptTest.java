package com.beeacademy.backend.model;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class ExamAttemptTest {

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

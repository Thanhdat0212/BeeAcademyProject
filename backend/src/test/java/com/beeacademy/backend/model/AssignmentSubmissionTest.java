package com.beeacademy.backend.model;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class AssignmentSubmissionTest {

    @Test
    void gradeStoresScoreFeedbackAndStatus() {
        AssignmentSubmission submission = new AssignmentSubmission();
        Profile teacher = Profile.createNew(
                java.util.UUID.randomUUID(), UserRole.TEACHER, "Teacher");

        submission.grade(8, "  Lập luận rõ ràng.  ", teacher);

        assertThat(submission.getScore()).isEqualTo(8);
        assertThat(submission.getFeedback()).isEqualTo("Lập luận rõ ràng.");
        assertThat(submission.getStatus()).isEqualTo("graded");
        assertThat(submission.getRawScore()).isEqualTo(8);
        assertThat(submission.getGradedAt()).isNotNull();
        assertThat(submission.getGradedBy()).isEqualTo(teacher);
    }

    @Test
    void resubmitIncrementsAttemptAndStoresLatePolicySnapshot() {
        AssignmentSubmission submission = AssignmentSubmission.submit(
                org.mockito.Mockito.mock(Assignment.class),
                Profile.createNew(java.util.UUID.randomUUID(), UserRole.STUDENT, "Student"),
                "Lần 1",
                "[]");

        submission.resubmit("Lần 2", "[]", true, 15);

        assertThat(submission.effectiveAttemptNumber()).isEqualTo(2);
        assertThat(submission.isLate()).isTrue();
        assertThat(submission.effectiveLatePenaltyPercent()).isEqualTo(15);
    }

    @Test
    void blankFeedbackIsStoredAsNull() {
        AssignmentSubmission submission = new AssignmentSubmission();
        Profile teacher = Profile.createNew(
                java.util.UUID.randomUUID(), UserRole.TEACHER, "Teacher");

        submission.grade(7, "   ", teacher);

        assertThat(submission.getFeedback()).isNull();
    }
}

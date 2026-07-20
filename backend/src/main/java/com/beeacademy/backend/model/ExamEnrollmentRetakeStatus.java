package com.beeacademy.backend.model;

/**
 * Retake access state of the conceptual (enrollment, exam) pair.
 * It is derived from authoritative attempts and approvals so it cannot become stale.
 */
public enum ExamEnrollmentRetakeStatus {
    AVAILABLE,
    RETAKE_LOCKED,
    RETAKE_APPROVED
}

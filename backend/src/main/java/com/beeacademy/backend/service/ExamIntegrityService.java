package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.response.ExamIntegrityEventResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.model.ExamAttempt;
import com.beeacademy.backend.model.ExamConfig;
import com.beeacademy.backend.model.ExamIntegrityEvent;
import com.beeacademy.backend.repository.ExamAttemptRepository;
import com.beeacademy.backend.repository.ExamIntegrityEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ExamIntegrityService {

    private static final Set<String> ALLOWED_EVENT_TYPES = Set.of(
            "TAB_HIDDEN",
            "FULLSCREEN_EXIT",
            "WINDOW_BLUR");

    private final ExamIntegrityEventRepository integrityEventRepository;
    private final ExamAttemptRepository examAttemptRepository;

    @Transactional
    public ExamIntegrityEventResponse record(
            Enrollment enrollment,
            ExamConfig examConfig,
            ExamAttempt attempt,
            UUID clientEventId,
            String rawEventType) {
        String eventType = normalizeEventType(rawEventType);
        return integrityEventRepository
                .findByAttemptIdAndClientEventId(attempt.getId(), clientEventId)
                .map(ExamIntegrityEventResponse::fromEntity)
                .orElseGet(() -> recordNew(
                        enrollment, examConfig, attempt, clientEventId, eventType));
    }

    private ExamIntegrityEventResponse recordNew(
            Enrollment enrollment,
            ExamConfig examConfig,
            ExamAttempt attempt,
            UUID clientEventId,
            String eventType) {
        ExamAttempt lockedAttempt = examAttemptRepository.findByIdForUpdate(attempt.getId())
                .orElseThrow(() -> new BusinessException(
                        "EXAM_ATTEMPT_NOT_FOUND",
                        "Không tìm thấy lượt làm bài đang hoạt động.",
                        HttpStatus.NOT_FOUND));
        Optional<ExamIntegrityEvent> eventRecordedWhileWaitingForLock = integrityEventRepository
                .findByAttemptIdAndClientEventId(lockedAttempt.getId(), clientEventId);
        if (eventRecordedWhileWaitingForLock.isPresent()) {
            return ExamIntegrityEventResponse.fromEntity(eventRecordedWhileWaitingForLock.get());
        }
        if (lockedAttempt.getSubmittedAt() != null) {
            throw new BusinessException(
                    "EXAM_ATTEMPT_ALREADY_SUBMITTED",
                    "Bài kiểm tra đã được nộp, không thể ghi thêm sự kiện.",
                    HttpStatus.CONFLICT);
        }

        int nextCount = integrityEventRepository
                .findMaxViolationCountByAttemptId(lockedAttempt.getId()) + 1;
        ExamIntegrityEvent saved = integrityEventRepository.saveAndFlush(
                ExamIntegrityEvent.record(
                        clientEventId,
                        enrollment,
                        examConfig,
                        lockedAttempt,
                        eventType,
                        nextCount));
        return ExamIntegrityEventResponse.fromEntity(saved);
    }

    private String normalizeEventType(String rawEventType) {
        String eventType = rawEventType == null
                ? ""
                : rawEventType.trim().toUpperCase(Locale.ROOT);
        if (!ALLOWED_EVENT_TYPES.contains(eventType)) {
            throw new BusinessException(
                    "INVALID_INTEGRITY_EVENT_TYPE",
                    "Loại sự kiện chống gian lận không hợp lệ.");
        }
        return eventType;
    }
}

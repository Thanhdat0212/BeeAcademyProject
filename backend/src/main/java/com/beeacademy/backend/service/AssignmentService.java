package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.GradeAssignmentSubmissionRequest;
import com.beeacademy.backend.dto.response.AssignmentSubmissionResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Assignment;
import com.beeacademy.backend.model.AssignmentSubmission;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.repository.AssignmentSubmissionRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AssignmentService {

    private final AssignmentSubmissionRepository submissionRepository;
    private final ProfileRepository profileRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<AssignmentSubmissionResponse> listTeacherSubmissions(AuthenticatedUser me) {
        return submissionRepository.findAllForTeacher(me.userId()).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public AssignmentSubmissionResponse gradeSubmission(
            UUID submissionId,
            AuthenticatedUser me,
            GradeAssignmentSubmissionRequest request) {
        AssignmentSubmission submission = submissionRepository
                .findOwned(submissionId, me.userId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "AssignmentSubmission", submissionId));
        int maxScore = submission.getAssignment().getMaxScore();
        if (request.score() > maxScore || request.score() % 1 != 0) {
            throw new BusinessException("INVALID_SCORE",
                    "Điểm phải là số nguyên từ 0 đến " + maxScore + ".");
        }
        Profile teacher = profileRepository.findById(me.userId())
                .orElseThrow(() -> new ResourceNotFoundException("Profile", me.userId()));
        submission.grade(request.score().intValue(), request.feedback(), teacher);
        return toResponse(submissionRepository.save(submission));
    }

    private AssignmentSubmissionResponse toResponse(AssignmentSubmission submission) {
        Assignment assignment = submission.getAssignment();
        Course course = assignment.getCourse();
        if (course == null) {
            throw new BusinessException("ASSIGNMENT_COURSE_MISSING",
                    "Bài tự luận chưa được liên kết với khóa học.");
        }
        Instant dueAt = assignment.getDueAt();
        String status = switch (submission.getStatus()) {
            case "graded" -> "graded";
            case "returned" -> "resubmit";
            default -> "pending";
        };
        return new AssignmentSubmissionResponse(
                submission.getId(),
                assignment.getId(),
                assignment.getTitle(),
                assignment.getDescription(),
                course.getId(),
                course.getTitle(),
                submission.getStudent().getId(),
                submission.getStudent().getFullName(),
                submission.getContent(),
                readFiles(submission.getFileUrlsJson()),
                1,
                status,
                submission.getScore() != null ? submission.getScore().doubleValue() : null,
                assignment.getMaxScore().doubleValue(),
                submission.getFeedback(),
                submission.getSubmittedAt(),
                submission.getGradedAt(),
                dueAt,
                dueAt != null && submission.getSubmittedAt().isAfter(dueAt));
    }

    private List<AssignmentSubmissionResponse.SubmissionFile> readFiles(String json) {
        if (json == null || json.isBlank() || "[]".equals(json.trim())) return List.of();
        try {
            List<Map<String, Object>> files = objectMapper.readValue(
                    json, new TypeReference<List<Map<String, Object>>>() {});
            return files.stream()
                    .map(file -> new AssignmentSubmissionResponse.SubmissionFile(
                            stringValue(file, "name", "fileName"),
                            stringValue(file, "url", "fileUrl"),
                            stringValue(file, "type", "fileType"),
                            longValue(file, "sizeBytes", "size")))
                    .filter(file -> file.url() != null)
                    .toList();
        } catch (Exception ex) {
            return List.of();
        }
    }

    private String stringValue(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            Object value = map.get(key);
            if (value != null) return value.toString();
        }
        return null;
    }

    private Long longValue(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            Object value = map.get(key);
            if (value instanceof Number number) return number.longValue();
            if (value != null) {
                try {
                    return Long.parseLong(value.toString());
                } catch (NumberFormatException ignored) {
                    return null;
                }
            }
        }
        return null;
    }
}

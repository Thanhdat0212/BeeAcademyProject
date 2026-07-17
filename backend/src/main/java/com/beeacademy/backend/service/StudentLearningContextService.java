package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.response.StudentLearningContextResponse;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Lớp gộp (composition) cho trang học của học sinh — không có business logic
 * riêng, chỉ tái sử dụng 3 service hiện có để trả về một response duy nhất.
 * Mỗi service con tự kiểm tra enrollment; không bypass kiểm tra quyền nào.
 */
@Service
@RequiredArgsConstructor
public class StudentLearningContextService {

    private final CourseProgressService courseProgressService;
    private final ExamService examService;
    private final StudentVideoProgressService studentVideoProgressService;

    @Transactional(readOnly = true)
    public StudentLearningContextResponse getLearningContext(UUID courseId, AuthenticatedUser me) {
        return new StudentLearningContextResponse(
                courseProgressService.getProgress(courseId, me),
                examService.listStudentExams(courseId, me),
                studentVideoProgressService.getLatestProgress(courseId, me)
        );
    }
}

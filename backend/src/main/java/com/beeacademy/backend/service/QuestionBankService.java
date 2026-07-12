package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.CreateQuestionBankRequest;
import com.beeacademy.backend.dto.response.QuestionBankResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Category;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.QuestionBank;
import com.beeacademy.backend.model.UserRole;
import com.beeacademy.backend.repository.CategoryRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.QuestionBankRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class QuestionBankService {

    private final QuestionBankRepository questionBankRepository;
    private final CategoryRepository categoryRepository;
    private final ProfileRepository profileRepository;

    @Transactional
    public QuestionBankResponse createQuestionBank(AuthenticatedUser me, CreateQuestionBankRequest req) {
        if (req == null) {
            throw new BusinessException("INVALID_REQUEST", "Dữ liệu ngân hàng câu hỏi không hợp lệ.");
        }
        String title = normalizeTitle(req.title());
        if (title == null) {
            throw new BusinessException("QUESTION_BANK_TITLE_REQUIRED", "Tên ngân hàng không được trống.");
        }
        if (req.grade() == null || req.grade() < 1) {
            throw new BusinessException("GRADE_REQUIRED", "Vui lòng chọn lớp.");
        }

        Profile teacher = profileRepository.findById(me.userId())
                .orElseThrow(() -> new ResourceNotFoundException("Profile", me.userId()));
        assertApprovedTeacher(me, teacher);
        if (questionBankRepository.existsByTeacherIdAndTitleIgnoreCase(me.userId(), title)) {
            throw duplicateTitle();
        }
        Category category = categoryRepository.findById(req.categoryId())
                .orElseThrow(() -> new ResourceNotFoundException("Category", req.categoryId()));

        QuestionBank bank = QuestionBank.create(
                teacher,
                category,
                req.grade(),
                title,
                req.description());

        try {
            QuestionBank saved = questionBankRepository.save(bank);
            log.info("Teacher {} created question bank {}", me.userId(), saved.getId());
            return QuestionBankResponse.fromEntity(saved, 0L);
        } catch (DataIntegrityViolationException ex) {
            throw duplicateTitle();
        }
    }

    @Transactional(readOnly = true)
    public List<QuestionBankResponse> listQuestionBanks(AuthenticatedUser me) {
        return questionBankRepository.findSummariesByTeacherId(me.userId()).stream()
                .map(QuestionBankResponse::fromSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public QuestionBank getOwnedQuestionBank(UUID questionBankId, UUID teacherId) {
        return questionBankRepository.findByIdAndTeacherId(questionBankId, teacherId)
                .orElseThrow(() -> new ResourceNotFoundException("QuestionBank", questionBankId));
    }

    private void assertApprovedTeacher(AuthenticatedUser me, Profile profile) {
        if (!UserRole.TEACHER.toDbValue().equalsIgnoreCase(me.role())
                || !profile.isApprovedTeacher()) {
            throw new BusinessException(
                    "TEACHER_NOT_APPROVED",
                    "Giáo viên chưa được phê duyệt vai trò GV.",
                    HttpStatus.FORBIDDEN);
        }
    }

    private String normalizeTitle(String title) {
        if (title == null || title.isBlank()) {
            return null;
        }
        return title.trim().replaceAll("\\s+", " ");
    }

    private BusinessException duplicateTitle() {
        return new BusinessException(
                "QUESTION_BANK_TITLE_EXISTS",
                "Tên ngân hàng đã tồn tại.",
                HttpStatus.CONFLICT);
    }
}

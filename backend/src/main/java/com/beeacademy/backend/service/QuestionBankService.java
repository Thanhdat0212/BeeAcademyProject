package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.CreateQuestionBankRequest;
import com.beeacademy.backend.dto.response.QuestionBankResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Category;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.QuestionBank;
import com.beeacademy.backend.repository.CategoryRepository;
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
    private final TeacherAccessService teacherAccessService;

    @Transactional
    public QuestionBankResponse createQuestionBank(AuthenticatedUser me, CreateQuestionBankRequest req) {
        if (req == null) {
            throw new BusinessException("INVALID_REQUEST", "Du lieu ngan hang cau hoi khong hop le.");
        }
        String title = normalizeTitle(req.title());
        if (title == null) {
            throw new BusinessException("QUESTION_BANK_TITLE_REQUIRED", "Ten ngan hang khong duoc trong.");
        }
        if (req.grade() == null || req.grade() < 1) {
            throw new BusinessException("GRADE_REQUIRED", "Vui long chon lop.");
        }

        Profile teacher = teacherAccessService.requireApprovedTeacher(me);
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

    @Transactional
    public QuestionBankResponse updateQuestionBank(
            AuthenticatedUser me, UUID questionBankId, CreateQuestionBankRequest req) {
        if (req == null) {
            throw new BusinessException("INVALID_REQUEST", "Du lieu ngan hang cau hoi khong hop le.");
        }
        teacherAccessService.requireApprovedTeacher(me);
        QuestionBank bank = getOwnedQuestionBank(questionBankId, me.userId());
        String title = normalizeTitle(req.title());
        if (title == null) {
            throw new BusinessException("QUESTION_BANK_TITLE_REQUIRED", "Ten ngan hang khong duoc trong.");
        }
        if (req.grade() == null || req.grade() < 1) {
            throw new BusinessException("GRADE_REQUIRED", "Vui long chon lop.");
        }
        if (questionBankRepository.existsByTeacherIdAndTitleIgnoreCase(me.userId(), title, questionBankId)) {
            throw duplicateTitle();
        }
        Category category = categoryRepository.findById(req.categoryId())
                .orElseThrow(() -> new ResourceNotFoundException("Category", req.categoryId()));
        bank.update(category, req.grade(), title, req.description());
        QuestionBank saved = questionBankRepository.save(bank);
        log.info("Teacher {} updated question bank {}", me.userId(), saved.getId());
        return QuestionBankResponse.fromEntity(saved, 0L);
    }

    @Transactional
    public QuestionBankResponse updateStatus(AuthenticatedUser me, UUID questionBankId, boolean active) {
        teacherAccessService.requireApprovedTeacher(me);
        QuestionBank bank = getOwnedQuestionBank(questionBankId, me.userId());
        if (active) {
            bank.activate();
        } else {
            bank.deactivate();
        }
        QuestionBank saved = questionBankRepository.save(bank);
        log.info("Teacher {} {} question bank {}", me.userId(),
                active ? "activated" : "deactivated", saved.getId());
        return QuestionBankResponse.fromEntity(saved, 0L);
    }

    @Transactional(readOnly = true)
    public QuestionBank getOwnedQuestionBank(UUID questionBankId, UUID teacherId) {
        return questionBankRepository.findByIdAndTeacherId(questionBankId, teacherId)
                .orElseThrow(() -> new ResourceNotFoundException("QuestionBank", questionBankId));
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
                "Ten ngan hang da ton tai.",
                HttpStatus.CONFLICT);
    }
}

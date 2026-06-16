package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.CreateQuestionRequest;
import com.beeacademy.backend.dto.response.QuestionResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Category;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.Question;
import com.beeacademy.backend.model.QuestionChoice;
import com.beeacademy.backend.model.UserRole;
import com.beeacademy.backend.repository.CategoryRepository;
import com.beeacademy.backend.repository.ChapterRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.QuestionRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit Test cho QuestionService.
 * Dung Mockito mock tat ca dependencies (khong can Spring, khong can DB).
 * Ten test: methodName_ShouldDoWhat_WhenCondition
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("QuestionService Unit Tests")
class QuestionServiceTest {

    @Mock private QuestionRepository questionRepository;
    @Mock private CategoryRepository  categoryRepository;
    @Mock private ProfileRepository   profileRepository;
    @Mock private ChapterRepository   chapterRepository;

    @InjectMocks
    private QuestionService questionService;

    private UUID teacherId;
    private UUID categoryId;
    private AuthenticatedUser teacher;
    private Profile teacherProfile;
    private Category category;

    @BeforeEach
    void setUp() {
        teacherId  = UUID.randomUUID();
        categoryId = UUID.randomUUID();

        teacher = new AuthenticatedUser(teacherId, "teacher@test.com", "teacher");

        teacherProfile = Profile.createNew(teacherId, UserRole.TEACHER, "Giáo viên Test");
        category = Category.create("toan-hoc", "Toán học");
    }

    // =========================================================================
    // TC01 — Happy path: tao cau hoi hop le
    // =========================================================================
    @Test
    @DisplayName("TC01: createQuestion_ShouldReturnResponse_WhenValidRequest")
    void createQuestion_ShouldReturnResponse_WhenValidRequest() {
        // Arrange
        CreateQuestionRequest req = buildValidRequest(categoryId, List.of(
                new CreateQuestionRequest.ChoiceRequest("A - Đáp án đúng", true),
                new CreateQuestionRequest.ChoiceRequest("B - Sai", false)
        ));

        Question mockSaved = Question.create(teacherProfile, category, 7, null,
                "Nội dung câu hỏi", null, "easy", "multiple_choice");

        when(profileRepository.findById(teacherId)).thenReturn(Optional.of(teacherProfile));
        when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(category));
        when(questionRepository.save(any())).thenReturn(mockSaved);

        // Act
        QuestionResponse response = questionService.createQuestion(teacher, req);

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.difficulty()).isEqualTo("easy");
        assertThat(response.type()).isEqualTo("multiple_choice");
        verify(questionRepository).save(any(Question.class));
    }

    // =========================================================================
    // TC02 — Khong co dap an dung -> throw
    // =========================================================================
    @Test
    @DisplayName("TC02: createQuestion_ShouldThrow_WhenNoCorrectAnswer")
    void createQuestion_ShouldThrow_WhenNoCorrectAnswer() {
        // Arrange — 2 dap an deu sai
        CreateQuestionRequest req = buildValidRequest(categoryId, List.of(
                new CreateQuestionRequest.ChoiceRequest("A - Sai", false),
                new CreateQuestionRequest.ChoiceRequest("B - Sai", false)
        ));

        // Act & Assert — no stubs needed: validation throws before any DB call
        assertThatThrownBy(() -> questionService.createQuestion(teacher, req))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("đúng 1 đáp án đúng");

        verify(questionRepository, never()).save(any());
    }

    // =========================================================================
    // TC03 — Nhieu hon 1 dap an dung -> throw
    // =========================================================================
    @Test
    @DisplayName("TC03: createQuestion_ShouldThrow_WhenMultipleCorrectAnswers")
    void createQuestion_ShouldThrow_WhenMultipleCorrectAnswers() {
        // Arrange — 2 dap an deu dung
        CreateQuestionRequest req = buildValidRequest(categoryId, List.of(
                new CreateQuestionRequest.ChoiceRequest("A", true),
                new CreateQuestionRequest.ChoiceRequest("B", true)
        ));

        // Act & Assert — no stubs needed: validation throws before any DB call
        assertThatThrownBy(() -> questionService.createQuestion(teacher, req))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("đúng 1 đáp án đúng");
    }

    // =========================================================================
    // TC04 — Category khong ton tai -> throw ResourceNotFoundException
    // =========================================================================
    @Test
    @DisplayName("TC04: createQuestion_ShouldThrow_WhenCategoryNotFound")
    void createQuestion_ShouldThrow_WhenCategoryNotFound() {
        // Arrange
        UUID nonExistentCategoryId = UUID.randomUUID();
        CreateQuestionRequest req = buildValidRequest(nonExistentCategoryId, List.of(
                new CreateQuestionRequest.ChoiceRequest("Đúng", true),
                new CreateQuestionRequest.ChoiceRequest("Sai", false)
        ));

        when(profileRepository.findById(teacherId)).thenReturn(Optional.of(teacherProfile));
        when(categoryRepository.findById(nonExistentCategoryId)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> questionService.createQuestion(teacher, req))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Category");
    }

    // =========================================================================
    // TC05 — deleteQuestion: usageCount > 0 -> soft-delete (deactivate)
    // =========================================================================
    @Test
    @DisplayName("TC05: deleteQuestion_ShouldDeactivate_WhenUsageCountPositive")
    void deleteQuestion_ShouldDeactivate_WhenUsageCountPositive() {
        // Arrange
        UUID questionId = UUID.randomUUID();
        Question question = Question.create(teacherProfile, category, 7, null,
                "Câu hỏi đã dùng", null, "medium", "multiple_choice");
        question.incrementUsage(); // usageCount = 1

        when(questionRepository.findById(questionId)).thenReturn(Optional.of(question));
        when(questionRepository.save(any())).thenReturn(question);

        // Act
        questionService.deleteQuestion(questionId, teacher);

        // Assert: deactivate (save) chứ không delete
        verify(questionRepository).save(question);
        verify(questionRepository, never()).delete(any(Question.class));
        assertThat(question.getStatus()).isEqualTo("inactive");
    }

    // =========================================================================
    // TC06 — deleteQuestion: usageCount = 0 -> hard-delete
    // =========================================================================
    @Test
    @DisplayName("TC06: deleteQuestion_ShouldHardDelete_WhenUsageCountZero")
    void deleteQuestion_ShouldHardDelete_WhenUsageCountZero() {
        // Arrange
        UUID questionId = UUID.randomUUID();
        Question question = Question.create(teacherProfile, category, 7, null,
                "Câu hỏi chưa dùng", null, "hard", "multiple_choice");
        // usageCount = 0 (mặc định)

        when(questionRepository.findById(questionId)).thenReturn(Optional.of(question));

        // Act
        questionService.deleteQuestion(questionId, teacher);

        // Assert: delete thực sự, không save
        verify(questionRepository).delete(question);
        verify(questionRepository, never()).save(any());
    }

    // =========================================================================
    // TC07 — bulkCreateQuestions: > 200 cau -> throw
    // =========================================================================
    @Test
    @DisplayName("TC07: bulkCreateQuestions_ShouldThrow_WhenExceeds200")
    void bulkCreateQuestions_ShouldThrow_WhenExceeds200() {
        // Arrange — tao 201 request
        CreateQuestionRequest singleReq = buildValidRequest(categoryId, List.of(
                new CreateQuestionRequest.ChoiceRequest("A", true),
                new CreateQuestionRequest.ChoiceRequest("B", false)
        ));
        List<CreateQuestionRequest> requests = java.util.Collections.nCopies(201, singleReq);

        // Act & Assert
        assertThatThrownBy(() -> questionService.bulkCreateQuestions(teacher, requests))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("tối đa 200 câu");
    }

    // =========================================================================
    // TC-S10 — getQuestion: tra ve response dung khi owner goi
    // =========================================================================
    @Test
    @DisplayName("TC-S10: getQuestion_ShouldReturnResponse_WhenOwnerAccesses")
    void getQuestion_ShouldReturnResponse_WhenOwnerAccesses() {
        UUID questionId = UUID.randomUUID();
        Question question = Question.create(teacherProfile, category, 7, null,
                "Nội dung test?", "Giải thích", "medium", "multiple_choice");
        QuestionChoice correctChoice = QuestionChoice.create(question, "Đúng", true, 1);
        QuestionChoice wrongChoice  = QuestionChoice.create(question, "Sai",  false, 2);
        question.addChoice(correctChoice);
        question.addChoice(wrongChoice);

        when(questionRepository.findById(questionId)).thenReturn(Optional.of(question));

        var response = questionService.getQuestion(questionId, teacher);

        assertThat(response).isNotNull();
        assertThat(response.difficulty()).isEqualTo("medium");
        assertThat(response.choices()).hasSize(2);
    }

    // =========================================================================
    // TC-S11 — updateQuestion: cap nhat thanh cong khi du lieu hop le
    // =========================================================================
    @Test
    @DisplayName("TC-S11: updateQuestion_ShouldReturnUpdatedResponse_WhenValidRequest")
    void updateQuestion_ShouldReturnUpdatedResponse_WhenValidRequest() {
        UUID questionId = UUID.randomUUID();
        Question question = Question.create(teacherProfile, category, 7, null,
                "Nội dung cũ", "Giải thích cũ", "easy", "multiple_choice");
        question.addChoice(QuestionChoice.create(question, "A-cũ", true,  1));
        question.addChoice(QuestionChoice.create(question, "B-cũ", false, 2));

        CreateQuestionRequest updateReq = buildValidRequest(categoryId, List.of(
                new CreateQuestionRequest.ChoiceRequest("A-mới", true),
                new CreateQuestionRequest.ChoiceRequest("B-mới", false)
        ));

        when(questionRepository.findById(questionId)).thenReturn(Optional.of(question));
        when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(category));
        when(questionRepository.save(any(Question.class))).thenReturn(question);

        var response = questionService.updateQuestion(questionId, teacher, updateReq);

        assertThat(response).isNotNull();
        verify(questionRepository).save(any(Question.class));
    }

    // =========================================================================
    // TC08 — listQuestions: tra ve PageResponse dung cau truc
    // =========================================================================
    @Test
    @DisplayName("TC08: listQuestions_ShouldReturnPageResponse_WhenCalled")
    void listQuestions_ShouldReturnPageResponse_WhenCalled() {
        // Arrange
        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(0, 10);
        org.springframework.data.domain.Page<Question> emptyPage =
                org.springframework.data.domain.Page.empty(pageable);

        when(questionRepository.findAll(
                org.mockito.ArgumentMatchers.<org.springframework.data.jpa.domain.Specification<Question>>any(),
                org.mockito.ArgumentMatchers.eq(pageable)))
                .thenReturn(emptyPage);

        // Act
        var result = questionService.listQuestions(teacher, null, null, null, null, null, pageable);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.items()).isEmpty();
        assertThat(result.totalItems()).isZero();
    }

    // =========================================================================
    // TC09 — bulkCreateQuestions: list rong -> tra ve result 0 created
    // =========================================================================
    @Test
    @DisplayName("TC09: bulkCreateQuestions_ShouldReturnZeroCreated_WhenEmptyList")
    void bulkCreateQuestions_ShouldReturnZeroCreated_WhenEmptyList() {
        // Act
        var result = questionService.bulkCreateQuestions(teacher, List.of());

        // Assert
        assertThat(result.created()).isZero();
        assertThat(result.failed()).isZero();
        assertThat(result.errors()).isEmpty();
    }

    // =========================================================================
    // Helper
    // =========================================================================
    private CreateQuestionRequest buildValidRequest(UUID catId,
                                                    List<CreateQuestionRequest.ChoiceRequest> choices) {
        return new CreateQuestionRequest(
                catId,    // categoryId
                7,        // grade
                null,     // chapterId
                "Câu hỏi test nội dung?",
                "Giải thích",
                "easy",
                "multiple_choice",
                choices
        );
    }
}

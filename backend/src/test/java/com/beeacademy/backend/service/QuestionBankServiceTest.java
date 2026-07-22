package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.CreateQuestionBankRequest;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.model.Category;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.QuestionBank;
import com.beeacademy.backend.model.UserRole;
import com.beeacademy.backend.repository.CategoryRepository;
import com.beeacademy.backend.repository.QuestionBankRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class QuestionBankServiceTest {

    @Mock
    private QuestionBankRepository questionBankRepository;

    @Mock
    private CategoryRepository categoryRepository;

    @Mock
    private TeacherAccessService teacherAccessService;

    @InjectMocks
    private QuestionBankService service;

    @Test
    @DisplayName("ST-TCH-003: teacher creates an active empty question bank that is ready for UC33")
    void createQuestionBankCreatesActiveEmptyBankForTeacher() {
        UUID teacherId = UUID.randomUUID();
        UUID categoryId = UUID.randomUUID();
        Profile teacher = Profile.createNew(teacherId, UserRole.TEACHER, "Teacher One");
        Category category = category(categoryId, "Toan hoc");

        when(teacherAccessService.requireApprovedTeacher(teacher(teacherId))).thenReturn(teacher);
        when(questionBankRepository.existsByTeacherIdAndTitleIgnoreCase(
                teacherId, "Ngan hang Toan lop 8")).thenReturn(false);
        when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(category));
        when(questionBankRepository.save(any(QuestionBank.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.createQuestionBank(
                teacher(teacherId),
                new CreateQuestionBankRequest(
                        "  Ngan   hang Toan lop 8  ",
                        categoryId,
                        8,
                        "Dai so co ban"));

        ArgumentCaptor<QuestionBank> captor = ArgumentCaptor.forClass(QuestionBank.class);
        verify(questionBankRepository).save(captor.capture());
        assertThat(captor.getValue().getTitle()).isEqualTo("Ngan hang Toan lop 8");
        assertThat(captor.getValue().getStatus()).isEqualTo("active");
        assertThat(response.questionCount()).isZero();
        assertThat(response.status()).isEqualTo("active");
        assertThat(response.categoryId()).isEqualTo(categoryId);
        assertThat(response.grade()).isEqualTo(8);
    }

    @Test
    void createQuestionBankRejectsDuplicateTitleForSameTeacher() {
        UUID teacherId = UUID.randomUUID();
        UUID categoryId = UUID.randomUUID();
        Profile teacher = Profile.createNew(teacherId, UserRole.TEACHER, "Teacher One");

        when(teacherAccessService.requireApprovedTeacher(teacher(teacherId))).thenReturn(teacher);
        when(questionBankRepository.existsByTeacherIdAndTitleIgnoreCase(
                teacherId, "Ngan hang Toan lop 8")).thenReturn(true);

        assertThatThrownBy(() -> service.createQuestionBank(
                teacher(teacherId),
                new CreateQuestionBankRequest("Ngan hang Toan lop 8", categoryId, 8, null)))
                .isInstanceOfSatisfying(BusinessException.class, ex -> {
                    BusinessException businessException = (BusinessException) ex;
                    assertThat(businessException.getCode()).isEqualTo("QUESTION_BANK_TITLE_EXISTS");
                    assertThat(businessException.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                });

        verify(categoryRepository, never()).findById(categoryId);
        verify(questionBankRepository, never()).save(any());
    }

    @Test
    void createQuestionBankRejectsNonTeacherProfile() {
        UUID userId = UUID.randomUUID();
        UUID categoryId = UUID.randomUUID();
        Profile student = Profile.createNew(userId, UserRole.STUDENT, "Student One");

        when(teacherAccessService.requireApprovedTeacher(
                new AuthenticatedUser(userId, "student@example.com", "student")))
                .thenThrow(new BusinessException("TEACHER_NOT_APPROVED",
                        "Teacher account is not approved.", HttpStatus.FORBIDDEN));

        assertThatThrownBy(() -> service.createQuestionBank(
                new AuthenticatedUser(userId, "student@example.com", "student"),
                new CreateQuestionBankRequest("Bank", categoryId, 8, null)))
                .isInstanceOfSatisfying(BusinessException.class, ex -> {
                    BusinessException businessException = (BusinessException) ex;
                    assertThat(businessException.getCode()).isEqualTo("TEACHER_NOT_APPROVED");
                    assertThat(businessException.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
                });

        verify(questionBankRepository, never()).save(any());
    }

    @Test
    void createQuestionBankRejectsBlockedTeacherProfile() {
        UUID teacherId = UUID.randomUUID();
        UUID categoryId = UUID.randomUUID();
        Profile teacher = Profile.createNew(teacherId, UserRole.TEACHER, "Teacher One");
        teacher.block();

        when(teacherAccessService.requireApprovedTeacher(teacher(teacherId)))
                .thenThrow(new BusinessException("TEACHER_NOT_APPROVED",
                        "Teacher account is not approved.", HttpStatus.FORBIDDEN));

        assertThatThrownBy(() -> service.createQuestionBank(
                teacher(teacherId),
                new CreateQuestionBankRequest("Bank", categoryId, 8, null)))
                .isInstanceOfSatisfying(BusinessException.class, ex -> {
                    BusinessException businessException = (BusinessException) ex;
                    assertThat(businessException.getCode()).isEqualTo("TEACHER_NOT_APPROVED");
                    assertThat(businessException.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
                });

        verify(questionBankRepository, never()).save(any());
    }

    @Test
    void createQuestionBankRejectsPendingTeacherProfile() {
        UUID teacherId = UUID.randomUUID();
        UUID categoryId = UUID.randomUUID();
        Profile teacher = Profile.createNew(teacherId, UserRole.TEACHER, "Teacher One");
        teacher.markTeacherPendingApproval();

        when(teacherAccessService.requireApprovedTeacher(teacher(teacherId)))
                .thenThrow(new BusinessException("TEACHER_NOT_APPROVED",
                        "Giáo viên chưa được phê duyệt vai trò GV.",
                        HttpStatus.FORBIDDEN));

        assertThatThrownBy(() -> service.createQuestionBank(
                teacher(teacherId),
                new CreateQuestionBankRequest("Bank", categoryId, 8, null)))
                .isInstanceOfSatisfying(BusinessException.class, ex -> {
                    BusinessException businessException = (BusinessException) ex;
                    assertThat(businessException.getCode()).isEqualTo("TEACHER_NOT_APPROVED");
                    assertThat(businessException.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
                });

        verify(questionBankRepository, never()).save(any());
    }

    private Category category(UUID id, String name) {
        Category category = mock(Category.class);
        when(category.getId()).thenReturn(id);
        when(category.getName()).thenReturn(name);
        return category;
    }

    private AuthenticatedUser teacher(UUID teacherId) {
        return new AuthenticatedUser(teacherId, "teacher@example.com", "teacher");
    }
}

package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.CreateQuestionRequest;
import com.beeacademy.backend.dto.response.QuestionResponse;
import com.beeacademy.backend.model.Category;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.Question;
import com.beeacademy.backend.model.QuestionAuditLog;
import com.beeacademy.backend.model.QuestionChoice;
import com.beeacademy.backend.model.QuestionVersion;
import com.beeacademy.backend.model.UserRole;
import com.beeacademy.backend.repository.CategoryRepository;
import com.beeacademy.backend.repository.ChapterRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.QuestionAuditLogRepository;
import com.beeacademy.backend.repository.QuestionRepository;
import com.beeacademy.backend.repository.QuestionVersionRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class QuestionServiceTest {

    @Mock private QuestionRepository questionRepository;
    @Mock private CategoryRepository categoryRepository;
    @Mock private ProfileRepository profileRepository;
    @Mock private ChapterRepository chapterRepository;
    @Mock private QuestionVersionRepository questionVersionRepository;
    @Mock private QuestionAuditLogRepository questionAuditLogRepository;
    @Mock private QuestionBankService questionBankService;
    @Mock private TeacherAccessService teacherAccessService;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @InjectMocks
    private QuestionService service;

    @Test
    @DisplayName("UT-TCH-006: creating a question records version 1 and CREATE audit")
    void createQuestionRecordsInitialVersionAndAudit() throws Exception {
        Fixture fixture = fixture();
        stubCommonCreate(fixture);

        service.createQuestion(fixture.user(), request(fixture.categoryId(), "Question v1"));

        ArgumentCaptor<QuestionVersion> versionCaptor = ArgumentCaptor.forClass(QuestionVersion.class);
        ArgumentCaptor<QuestionAuditLog> auditCaptor = ArgumentCaptor.forClass(QuestionAuditLog.class);
        verify(questionVersionRepository).save(versionCaptor.capture());
        verify(questionAuditLogRepository).save(auditCaptor.capture());

        assertThat(versionCaptor.getValue().getVersionNo()).isEqualTo(1);
        assertThat(versionCaptor.getValue().getContent()).isEqualTo("Question v1");
        assertThat(auditCaptor.getValue().getTeacherId()).isEqualTo(fixture.teacherId());
        assertThat(auditCaptor.getValue().getAction()).isEqualTo("CREATE");
        assertThat(auditCaptor.getValue().getOldVersion()).isNull();
        assertThat(auditCaptor.getValue().getNewVersion()).isEqualTo(1);
        assertThat(auditCaptor.getValue().getOldState()).isNull();
        assertThat(objectMapper.readTree(auditCaptor.getValue().getNewState()).path("content").asText())
                .isEqualTo("Question v1");
    }

    @Test
    @DisplayName("UT-TCH-007: updating a question records old_version, new_version and both states")
    void updateQuestionRecordsVersionTransitionAndAuditStates() throws Exception {
        Fixture fixture = fixture();
        Question question = question(fixture, "Question v1", 0);
        QuestionVersion currentVersion = currentVersion(question, 1);
        stubCommonUpdate(fixture, question, currentVersion);

        service.updateQuestion(
                question.getId(), fixture.user(), request(fixture.categoryId(), "Question v2"));

        ArgumentCaptor<QuestionVersion> versionCaptor = ArgumentCaptor.forClass(QuestionVersion.class);
        ArgumentCaptor<QuestionAuditLog> auditCaptor = ArgumentCaptor.forClass(QuestionAuditLog.class);
        verify(questionVersionRepository).save(versionCaptor.capture());
        verify(questionAuditLogRepository).save(auditCaptor.capture());

        QuestionAuditLog audit = auditCaptor.getValue();
        assertThat(versionCaptor.getValue().getVersionNo()).isEqualTo(2);
        assertThat(versionCaptor.getValue().getContent()).isEqualTo("Question v2");
        assertThat(audit.getAction()).isEqualTo("UPDATE");
        assertThat(audit.getOldVersion()).isEqualTo(1);
        assertThat(audit.getNewVersion()).isEqualTo(2);
        assertThat(objectMapper.readTree(audit.getOldState()).path("content").asText())
                .isEqualTo("Question v1");
        assertThat(objectMapper.readTree(audit.getNewState()).path("content").asText())
                .isEqualTo("Question v2");
    }

    @Test
    @DisplayName("IT-TCH-004: deleting a used question archives it and creates a new version")
    void deleteUsedQuestionArchivesAndAuditsVersionTransition() throws Exception {
        Fixture fixture = fixture();
        Question question = question(fixture, "Used question", 3);
        QuestionVersion currentVersion = currentVersion(question, 1);
        stubDelete(fixture, question, currentVersion);

        service.deleteQuestion(question.getId(), fixture.user());

        ArgumentCaptor<QuestionVersion> versionCaptor = ArgumentCaptor.forClass(QuestionVersion.class);
        ArgumentCaptor<QuestionAuditLog> auditCaptor = ArgumentCaptor.forClass(QuestionAuditLog.class);
        verify(questionVersionRepository).save(versionCaptor.capture());
        verify(questionAuditLogRepository).save(auditCaptor.capture());
        verify(questionRepository, never()).delete(question);

        QuestionAuditLog audit = auditCaptor.getValue();
        assertThat(question.getStatus()).isEqualTo("inactive");
        assertThat(versionCaptor.getValue().getVersionNo()).isEqualTo(2);
        assertThat(versionCaptor.getValue().getStatus()).isEqualTo("inactive");
        assertThat(audit.getAction()).isEqualTo("ARCHIVE");
        assertThat(audit.getOldVersion()).isEqualTo(1);
        assertThat(audit.getNewVersion()).isEqualTo(2);
        assertThat(objectMapper.readTree(audit.getOldState()).path("status").asText())
                .isEqualTo("active");
        assertThat(objectMapper.readTree(audit.getNewState()).path("status").asText())
                .isEqualTo("inactive");
    }

    @Test
    @DisplayName("IT-TCH-004: deleting an unused question keeps a DELETE audit snapshot")
    void deleteUnusedQuestionKeepsAuditSnapshot() throws Exception {
        Fixture fixture = fixture();
        Question question = question(fixture, "Unused question", 0);
        QuestionVersion currentVersion = currentVersion(question, 1);
        stubDelete(fixture, question, currentVersion);

        service.deleteQuestion(question.getId(), fixture.user());

        ArgumentCaptor<QuestionAuditLog> auditCaptor = ArgumentCaptor.forClass(QuestionAuditLog.class);
        verify(questionAuditLogRepository).save(auditCaptor.capture());
        verify(questionRepository).delete(question);
        verify(questionVersionRepository, never()).save(any(QuestionVersion.class));

        QuestionAuditLog audit = auditCaptor.getValue();
        assertThat(audit.getAction()).isEqualTo("DELETE");
        assertThat(audit.getOldVersion()).isEqualTo(1);
        assertThat(audit.getNewVersion()).isNull();
        assertThat(audit.getOldState()).contains("Unused question");
        assertThat(audit.getNewState()).isNull();
    }

    private void stubCommonCreate(Fixture fixture) {
        when(teacherAccessService.requireApprovedTeacher(fixture.user())).thenReturn(fixture.teacher());
        when(categoryRepository.findById(fixture.categoryId())).thenReturn(Optional.of(fixture.category()));
        when(questionRepository.existsActiveDuplicateContent(
                fixture.teacherId(), "Question v1", null)).thenReturn(false);
        when(questionRepository.save(any(Question.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(questionVersionRepository.save(any(QuestionVersion.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(questionAuditLogRepository.save(any(QuestionAuditLog.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    private void stubCommonUpdate(
            Fixture fixture, Question question, QuestionVersion currentVersion) {
        when(teacherAccessService.requireApprovedTeacher(fixture.user())).thenReturn(fixture.teacher());
        when(questionRepository.findByIdForUpdate(question.getId())).thenReturn(Optional.of(question));
        when(questionVersionRepository.findTopByQuestionIdOrderByVersionNoDesc(question.getId()))
                .thenReturn(Optional.of(currentVersion));
        when(categoryRepository.findById(fixture.categoryId())).thenReturn(Optional.of(fixture.category()));
        when(questionRepository.existsActiveDuplicateContent(
                fixture.teacherId(), "Question v2", question.getId())).thenReturn(false);
        lenient().when(questionRepository.save(question)).thenReturn(question);
        lenient().when(questionVersionRepository.save(any(QuestionVersion.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(questionAuditLogRepository.save(any(QuestionAuditLog.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    private void stubDelete(Fixture fixture, Question question, QuestionVersion currentVersion) {
        when(teacherAccessService.requireApprovedTeacher(fixture.user())).thenReturn(fixture.teacher());
        when(questionRepository.findByIdForUpdate(question.getId())).thenReturn(Optional.of(question));
        when(questionVersionRepository.findTopByQuestionIdOrderByVersionNoDesc(question.getId()))
                .thenReturn(Optional.of(currentVersion));
        lenient().when(questionRepository.save(question)).thenReturn(question);
        lenient().when(questionVersionRepository.save(any(QuestionVersion.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(questionAuditLogRepository.save(any(QuestionAuditLog.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    private Question question(Fixture fixture, String content, int usageCount) {
        Question question = Question.create(
                fixture.teacher(), null, fixture.category(), 8, null,
                content, "Explanation", 1.0, "[\"algebra\"]", null, "medium", "multiple_choice");
        question.addChoice(QuestionChoice.create(question, "A", true, 1, null));
        question.addChoice(QuestionChoice.create(question, "B", false, 2, null));
        ReflectionTestUtils.setField(question, "usageCount", usageCount);
        return question;
    }

    private QuestionVersion currentVersion(Question question, int versionNo) throws Exception {
        List<QuestionResponse.ChoiceResponse> choices = question.getChoices().stream()
                .map(choice -> new QuestionResponse.ChoiceResponse(
                        choice.getId(), choice.getContent(), choice.getIsCorrect(), choice.getPosition(), choice.getImageUrl()))
                .toList();
        return QuestionVersion.snapshot(
                question,
                versionNo,
                objectMapper.writeValueAsString(choices),
                "Current version");
    }

    private CreateQuestionRequest request(UUID categoryId, String content) {
        return new CreateQuestionRequest(
                categoryId,
                8,
                null,
                null,
                content,
                "Explanation",
                "medium",
                "multiple_choice",
                List.of(
                        new CreateQuestionRequest.ChoiceRequest("A", true, null),
                        new CreateQuestionRequest.ChoiceRequest("B", false, null)),
                1.0,
                List.of("algebra"),
                (JsonNode) null);
    }

    private Fixture fixture() {
        UUID teacherId = UUID.randomUUID();
        UUID categoryId = UUID.randomUUID();
        Profile teacher = Profile.createNew(teacherId, UserRole.TEACHER, "Teacher One");
        Category category = org.mockito.Mockito.mock(Category.class);
        when(category.getId()).thenReturn(categoryId);
        return new Fixture(
                teacherId,
                categoryId,
                teacher,
                category,
                new AuthenticatedUser(teacherId, "teacher@example.com", "teacher"));
    }

    private record Fixture(
            UUID teacherId,
            UUID categoryId,
            Profile teacher,
            Category category,
            AuthenticatedUser user) {}
}

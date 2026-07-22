package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.response.QuestionAuditLogResponse;
import com.beeacademy.backend.dto.response.QuestionVersionResponse;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.beeacademy.backend.service.QuestionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class QuestionAuditControllerTest {

    private final ObjectMapper objectMapper = new ObjectMapper()
            .findAndRegisterModules()
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    @Mock
    private QuestionService questionService;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("ST-TCH-004: teacher can retrieve question versions and SRS audit transitions")
    void teacherCanRetrieveVersionAndAuditHistory() throws Exception {
        UUID teacherId = UUID.randomUUID();
        UUID questionId = UUID.randomUUID();
        Instant createdAt = Instant.parse("2026-07-17T00:00:00Z");
        authenticateTeacher(teacherId);

        when(questionService.listQuestionVersions(eq(questionId), any(AuthenticatedUser.class)))
                .thenReturn(List.of(new QuestionVersionResponse(
                        UUID.randomUUID(),
                        2,
                        null,
                        UUID.randomUUID(),
                        8,
                        null,
                        "Question v2",
                        "Explanation",
                        1.0,
                        List.of("algebra"),
                        null,
                        "medium",
                        "multiple_choice",
                        "active",
                        objectMapper.readTree("[]"),
                        "Teacher updated question.",
                        createdAt)));
        when(questionService.listQuestionAuditLogs(eq(questionId), any(AuthenticatedUser.class)))
                .thenReturn(List.of(new QuestionAuditLogResponse(
                        UUID.randomUUID(),
                        teacherId,
                        questionId,
                        1,
                        2,
                        "UPDATE",
                        objectMapper.readTree("{\"content\":\"Question v1\"}"),
                        objectMapper.readTree("{\"content\":\"Question v2\"}"),
                        createdAt)));

        MockMvc mockMvc = MockMvcBuilders
                .standaloneSetup(new QuestionController(questionService))
                .setMessageConverters(new MappingJackson2HttpMessageConverter(objectMapper))
                .build();

        mockMvc.perform(get("/api/teacher/questions/{questionId}/versions", questionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].versionNo").value(2))
                .andExpect(jsonPath("$.data[0].content").value("Question v2"))
                .andExpect(jsonPath("$.data[0].status").value("active"));

        mockMvc.perform(get("/api/teacher/questions/{questionId}/audit-logs", questionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].teacherId").value(teacherId.toString()))
                .andExpect(jsonPath("$.data[0].questionId").value(questionId.toString()))
                .andExpect(jsonPath("$.data[0].oldVersion").value(1))
                .andExpect(jsonPath("$.data[0].newVersion").value(2))
                .andExpect(jsonPath("$.data[0].action").value("UPDATE"))
                .andExpect(jsonPath("$.data[0].oldState.content").value("Question v1"))
                .andExpect(jsonPath("$.data[0].newState.content").value("Question v2"))
                .andExpect(jsonPath("$.data[0].createdAt").value(createdAt.toString()));
    }

    private void authenticateTeacher(UUID teacherId) {
        AuthenticatedUser user = new AuthenticatedUser(teacherId, "teacher@example.com", "teacher");
        var authentication = new UsernamePasswordAuthenticationToken(
                user,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_teacher")));
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }
}

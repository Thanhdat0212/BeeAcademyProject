package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.request.CreateQuestionBankRequest;
import com.beeacademy.backend.dto.response.QuestionBankResponse;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.beeacademy.backend.service.QuestionBankService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class QuestionBankControllerTest {

    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Mock
    private QuestionBankService questionBankService;

    @InjectMocks
    private QuestionBankController controller;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("IT-TCH-003: POST /api/teacher/question-banks creates an active empty question bank")
    void createQuestionBankApiReturnsCreatedBank() throws Exception {
        UUID teacherId = UUID.randomUUID();
        UUID categoryId = UUID.randomUUID();
        UUID bankId = UUID.randomUUID();
        authenticateTeacher(teacherId);

        when(questionBankService.createQuestionBank(any(), any()))
                .thenReturn(new QuestionBankResponse(
                        bankId,
                        "Ngân hàng Toán lớp 8",
                        "Đại số cơ bản",
                        "active",
                        categoryId,
                        "Toán học",
                        8,
                        0L,
                        Instant.parse("2026-07-10T00:00:00Z"),
                        Instant.parse("2026-07-10T00:00:00Z")));

        mockMvc().perform(post("/api/teacher/question-banks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new CreateQuestionBankRequest(
                                        "Ngân hàng Toán lớp 8",
                                        categoryId,
                                        8,
                                        "Đại số cơ bản"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Tạo ngân hàng câu hỏi thành công"))
                .andExpect(jsonPath("$.data.id").value(bankId.toString()))
                .andExpect(jsonPath("$.data.status").value("active"))
                .andExpect(jsonPath("$.data.questionCount").value(0))
                .andExpect(jsonPath("$.data.categoryId").value(categoryId.toString()))
                .andExpect(jsonPath("$.data.grade").value(8));

        ArgumentCaptor<AuthenticatedUser> userCaptor = ArgumentCaptor.forClass(AuthenticatedUser.class);
        verify(questionBankService).createQuestionBank(userCaptor.capture(), any(CreateQuestionBankRequest.class));
        assertThat(userCaptor.getValue().userId()).isEqualTo(teacherId);
    }

    private MockMvc mockMvc() {
        return MockMvcBuilders.standaloneSetup(controller).build();
    }

    private void authenticateTeacher(UUID teacherId) {
        AuthenticatedUser user = new AuthenticatedUser(teacherId, "teacher@example.com", "teacher");
        var auth = new UsernamePasswordAuthenticationToken(
                user,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_teacher")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}

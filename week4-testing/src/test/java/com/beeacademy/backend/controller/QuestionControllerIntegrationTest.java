package com.beeacademy.backend.controller;

import com.beeacademy.backend.model.Category;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.UserRole;
import com.beeacademy.backend.repository.CategoryRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.QuestionRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration Test cho QuestionController.
 * Test toan bo stack: Security -> Controller -> Service -> Repository -> H2.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@DisplayName("QuestionController Integration Tests")
class QuestionControllerIntegrationTest {

    @Autowired private MockMvc            mockMvc;
    @Autowired private ProfileRepository  profileRepository;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private QuestionRepository questionRepository;

    private UUID     teacherId;
    private UUID     categoryId;

    @BeforeEach
    void setUp() {
        teacherId = UUID.randomUUID();

        Profile teacher = Profile.createNew(teacherId, UserRole.TEACHER, "Giáo viên Test");
        profileRepository.save(teacher);

        Category category = Category.create("toan-hoc-it" + UUID.randomUUID(), "Toán học IT");
        Category saved = categoryRepository.save(category);
        categoryId = saved.getId();
    }

    // =========================================================================
    // IT07 — GET /api/teacher/questions -> 200 + danh sach rong ban dau
    // =========================================================================
    @Test
    @DisplayName("IT07: listQuestions_ShouldReturn200_WhenTeacherAuthenticated")
    void listQuestions_ShouldReturn200_WhenTeacherAuthenticated() throws Exception {
        mockMvc.perform(get("/api/teacher/questions")
                .with(asTeacher())
                .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items").isArray());
    }

    // =========================================================================
    // IT08 — POST /api/teacher/questions tao cau hoi hop le -> 200
    // =========================================================================
    @Test
    @DisplayName("IT08: createQuestion_ShouldReturn200_WhenValidRequest")
    void createQuestion_ShouldReturn200_WhenValidRequest() throws Exception {
        String body = """
                {
                  "categoryId": "%s",
                  "grade": 7,
                  "content": "Câu hỏi integration test?",
                  "explanation": "Giải thích",
                  "difficulty": "easy",
                  "type": "multiple_choice",
                  "choices": [
                    {"content": "Đáp án A - đúng", "isCorrect": true},
                    {"content": "Đáp án B - sai",  "isCorrect": false},
                    {"content": "Đáp án C - sai",  "isCorrect": false}
                  ]
                }
                """.formatted(categoryId);

        mockMvc.perform(post("/api/teacher/questions")
                .with(asTeacher())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.difficulty").value("easy"))
                .andExpect(jsonPath("$.data.choices").isArray());
    }

    // =========================================================================
    // IT09 — POST tao cau hoi thieu content -> 400
    // =========================================================================
    @Test
    @DisplayName("IT09: createQuestion_ShouldReturn400_WhenContentBlank")
    void createQuestion_ShouldReturn400_WhenContentBlank() throws Exception {
        String body = """
                {
                  "categoryId": "%s",
                  "grade": 7,
                  "content": "",
                  "difficulty": "easy",
                  "type": "multiple_choice",
                  "choices": [
                    {"content": "A", "isCorrect": true},
                    {"content": "B", "isCorrect": false}
                  ]
                }
                """.formatted(categoryId);

        mockMvc.perform(post("/api/teacher/questions")
                .with(asTeacher())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
                .andExpect(status().isBadRequest());
    }

    // =========================================================================
    // IT10 — Goi API khong co auth -> 401/403
    // =========================================================================
    @Test
    @DisplayName("IT10: listQuestions_ShouldReturn401_WhenUnauthenticated")
    void listQuestions_ShouldReturn401_WhenUnauthenticated() throws Exception {
        mockMvc.perform(get("/api/teacher/questions"))
                .andExpect(status().is(org.hamcrest.Matchers.anyOf(
                        org.hamcrest.Matchers.is(401),
                        org.hamcrest.Matchers.is(403)
                )));
    }

    // =========================================================================
    // Helper: set AuthenticatedUser co role=teacher vao SecurityContext
    // =========================================================================
    private RequestPostProcessor asTeacher() {
        AuthenticatedUser teacherUser = new AuthenticatedUser(teacherId, "teacher@test.com", "teacher");
        return authentication(new UsernamePasswordAuthenticationToken(
                teacherUser, null,
                List.of(new SimpleGrantedAuthority("ROLE_teacher"))
        ));
    }
}

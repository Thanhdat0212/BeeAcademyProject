package com.beeacademy.backend.controller;

import com.beeacademy.backend.model.Category;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.UserRole;
import com.beeacademy.backend.repository.CategoryRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.ProfileRepository;
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
 * Integration Test cho AdminApprovalController.
 * - Khoi dong Spring Boot + H2
 * - Dung @Transactional de rollback sau moi test
 * - Dung RequestPostProcessor de set AuthenticatedUser vao SecurityContext
 *   (tranh dung @WithMockUser vi CurrentUser.required() can principal la AuthenticatedUser)
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@DisplayName("AdminApprovalController Integration Tests")
class AdminApprovalControllerIntegrationTest {

    @Autowired private MockMvc             mockMvc;
    @Autowired private CourseRepository    courseRepository;
    @Autowired private ProfileRepository   profileRepository;
    @Autowired private CategoryRepository  categoryRepository;

    private UUID     adminId;
    private UUID     teacherId;
    private UUID     courseId;

    @BeforeEach
    void setUp() {
        adminId   = UUID.randomUUID();
        teacherId = UUID.randomUUID();

        Profile admin   = Profile.createNew(adminId,   UserRole.ADMIN,   "Admin Bee");
        Profile teacher = Profile.createNew(teacherId, UserRole.TEACHER, "Giáo viên Bee");
        profileRepository.save(admin);
        profileRepository.save(teacher);

        Category category = Category.create("toan-hoc", "Toán học");
        categoryRepository.save(category);

        Course course = Course.createByTeacher(teacher, "Toán 7 Nâng Cao",
                "Mô tả", category, new int[]{7}, 299_000);
        course.submitForReview(); // DRAFT -> PENDING_REVIEW
        Course saved = courseRepository.save(course);
        courseId = saved.getId();
    }

    // =========================================================================
    // IT03 — GET /api/admin/courses/pending -> 200 + danh sach
    // =========================================================================
    @Test
    @DisplayName("IT03: getPendingCourses_ShouldReturn200_WhenAdminAuthenticated")
    void getPendingCourses_ShouldReturn200_WhenAdminAuthenticated() throws Exception {
        mockMvc.perform(get("/api/admin/courses/pending")
                .with(asAdmin())
                .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items").isArray());
    }

    // =========================================================================
    // IT04 — POST approve -> 200 + course chuyen sang PUBLISHED
    // =========================================================================
    @Test
    @DisplayName("IT04: approveCourse_ShouldReturn200_WhenPendingCourse")
    void approveCourse_ShouldReturn200_WhenPendingCourse() throws Exception {
        String body = """
                {"comment": "Nội dung tốt, phê duyệt"}
                """;

        mockMvc.perform(post("/api/admin/courses/" + courseId + "/approve")
                .with(asAdmin())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Đã duyệt và xuất bản khóa học thành công"));
    }

    // =========================================================================
    // IT05 — POST reject khong co comment -> 400 Bad Request
    // =========================================================================
    @Test
    @DisplayName("IT05: rejectCourse_ShouldReturn400_WhenCommentBlank")
    void rejectCourse_ShouldReturn400_WhenCommentBlank() throws Exception {
        String body = """
                {"comment": ""}
                """;

        mockMvc.perform(post("/api/admin/courses/" + courseId + "/reject")
                .with(asAdmin())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
                .andExpect(status().isBadRequest());
    }

    // =========================================================================
    // IT06 — Khong co auth -> 401/403
    // =========================================================================
    @Test
    @DisplayName("IT06: getPendingCourses_ShouldReturn401_WhenUnauthenticated")
    void getPendingCourses_ShouldReturn401_WhenUnauthenticated() throws Exception {
        mockMvc.perform(get("/api/admin/courses/pending"))
                .andExpect(status().is(org.hamcrest.Matchers.anyOf(
                        org.hamcrest.Matchers.is(401),
                        org.hamcrest.Matchers.is(403)
                )));
    }

    // =========================================================================
    // Helper: tao RequestPostProcessor voi AuthenticatedUser la principal
    // CurrentUser.required() doc principal tu SecurityContext -> can loai nay
    // =========================================================================
    private RequestPostProcessor asAdmin() {
        AuthenticatedUser adminUser = new AuthenticatedUser(adminId, "admin@beeacademy.vn", "admin");
        return authentication(new UsernamePasswordAuthenticationToken(
                adminUser, null,
                List.of(new SimpleGrantedAuthority("ROLE_admin"))
        ));
    }
}

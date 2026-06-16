package com.beeacademy.backend.model;

import com.beeacademy.backend.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit tests cho model entities — kiem tra business logic khong can Spring/Mockito.
 * Ten test: methodName_ShouldDoWhat_WhenCondition
 */
@DisplayName("Course Model Unit Tests")
class CourseModelTest {

    private Profile teacher;
    private Category category;

    @BeforeEach
    void setUp() {
        teacher  = Profile.createNew(UUID.randomUUID(), UserRole.TEACHER, "Giáo viên Test");
        category = Category.create("toan-hoc", "Toán học");
    }

    // =========================================================================
    // TC-M01 — createByTeacher: tao khoa hoc moi o trang thai DRAFT
    // =========================================================================
    @Test
    @DisplayName("TC-M01: createByTeacher_ShouldSetDraftStatus_WhenCreated")
    void createByTeacher_ShouldSetDraftStatus_WhenCreated() {
        Course course = Course.createByTeacher(teacher, "Toán 7", "Mô tả", category,
                new int[]{7}, 299_000);

        assertThat(course.getStatus()).isEqualTo(CourseStatus.DRAFT);
        assertThat(course.getTitle()).isEqualTo("Toán 7");
        assertThat(course.getEffectivePriceVnd()).isEqualTo(299_000);
        assertThat(course.getTeacher()).isEqualTo(teacher);
        assertThat(course.getCategory()).isEqualTo(category);
    }

    // =========================================================================
    // TC-M02 — submitForReview: DRAFT -> PENDING_REVIEW
    // =========================================================================
    @Test
    @DisplayName("TC-M02: submitForReview_ShouldChangeToPendingReview_WhenDraft")
    void submitForReview_ShouldChangeToPendingReview_WhenDraft() {
        Course course = Course.createByTeacher(teacher, "Toán 7", "Mô tả", category,
                new int[]{7}, 299_000);

        course.submitForReview();

        assertThat(course.getStatus()).isEqualTo(CourseStatus.PENDING_REVIEW);
    }

    // =========================================================================
    // TC-M03 — approve: PENDING_REVIEW -> PUBLISHED
    // =========================================================================
    @Test
    @DisplayName("TC-M03: approve_ShouldPublishCourse_WhenPendingReview")
    void approve_ShouldPublishCourse_WhenPendingReview() {
        Course course = Course.createByTeacher(teacher, "Toán 7", "Mô tả", category,
                new int[]{7}, 299_000);
        course.submitForReview();

        course.approve();

        assertThat(course.getStatus()).isEqualTo(CourseStatus.PUBLISHED);
    }

    // =========================================================================
    // TC-M04 — reject: PENDING_REVIEW -> REJECTED
    // =========================================================================
    @Test
    @DisplayName("TC-M04: reject_ShouldSetRejectedStatus_WhenPendingReview")
    void reject_ShouldSetRejectedStatus_WhenPendingReview() {
        Course course = Course.createByTeacher(teacher, "Toán 7", "Mô tả", category,
                new int[]{7}, 299_000);
        course.submitForReview();

        course.reject();

        assertThat(course.getStatus()).isEqualTo(CourseStatus.REJECTED);
    }

    // =========================================================================
    // TC-M05 — needsRevision: PENDING_REVIEW -> NEEDS_REVISION
    // =========================================================================
    @Test
    @DisplayName("TC-M05: needsRevision_ShouldSetNeedsRevisionStatus_WhenPendingReview")
    void needsRevision_ShouldSetNeedsRevisionStatus_WhenPendingReview() {
        Course course = Course.createByTeacher(teacher, "Toán 7", "Mô tả", category,
                new int[]{7}, 299_000);
        course.submitForReview();

        course.needsRevision();

        assertThat(course.getStatus()).isEqualTo(CourseStatus.NEEDS_REVISION);
    }

    // =========================================================================
    // TC-M06 — submitForReview khi khong phai DRAFT hoac REJECTED -> throw
    // =========================================================================
    @Test
    @DisplayName("TC-M06: submitForReview_ShouldThrow_WhenAlreadyPublished")
    void submitForReview_ShouldThrow_WhenAlreadyPublished() {
        Course course = Course.createByTeacher(teacher, "Toán 7", "Mô tả", category,
                new int[]{7}, 299_000);
        course.submitForReview();
        course.approve(); // now PUBLISHED

        assertThatThrownBy(course::submitForReview)
                .isInstanceOf(IllegalStateException.class);
    }

    // =========================================================================
    // TC-M07 — Profile.createNew: tao profile dung role va ten
    // =========================================================================
    @Test
    @DisplayName("TC-M07: createNew_ShouldSetCorrectRole_WhenTeacher")
    void createNew_ShouldSetCorrectRole_WhenTeacher() {
        UUID id = UUID.randomUUID();
        Profile profile = Profile.createNew(id, UserRole.TEACHER, "Nguyễn Văn A");

        assertThat(profile.getId()).isEqualTo(id);
        assertThat(profile.getRole()).isEqualTo(UserRole.TEACHER);
        assertThat(profile.getFullName()).isEqualTo("Nguyễn Văn A");
    }

    // =========================================================================
    // TC-M08 — Category.create: tao category dung slug va name
    // =========================================================================
    @Test
    @DisplayName("TC-M08: create_ShouldSetSlugAndName_WhenCreated")
    void create_ShouldSetSlugAndName_WhenCreated() {
        Category cat = Category.create("tieng-anh", "Tiếng Anh");

        assertThat(cat.getSlug()).isEqualTo("tieng-anh");
        assertThat(cat.getName()).isEqualTo("Tiếng Anh");
    }

    // =========================================================================
    // TC-M09 — REJECTED course co the submitForReview lai (resubmit)
    // =========================================================================
    @Test
    @DisplayName("TC-M09: submitForReview_ShouldWork_WhenRejected")
    void submitForReview_ShouldWork_WhenRejected() {
        Course course = Course.createByTeacher(teacher, "Toán 7 v2", "Mô tả", category,
                new int[]{7}, 299_000);
        course.submitForReview();
        course.reject();

        course.submitForReview();

        assertThat(course.getStatus()).isEqualTo(CourseStatus.PENDING_REVIEW);
    }

    // =========================================================================
    // TC-M10 — Course.getGrades: parse dung tu grades string
    // =========================================================================
    @Test
    @DisplayName("TC-M10: getGrades_ShouldParseLevels_WhenMultipleGrades")
    void getGrades_ShouldParseLevels_WhenMultipleGrades() {
        Course course = Course.createByTeacher(teacher, "KHTN 8-9", "Mô tả", category,
                new int[]{8, 9}, 399_000);

        int[] grades = course.getGrades();

        assertThat(grades).containsExactly(8, 9);
    }
}

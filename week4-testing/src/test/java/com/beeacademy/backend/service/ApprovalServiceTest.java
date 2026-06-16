package com.beeacademy.backend.service;

import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.ApprovalHistory;
import com.beeacademy.backend.model.Category;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseStatus;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.UserRole;
import com.beeacademy.backend.repository.ApprovalHistoryRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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
 * Unit Test cho ApprovalService.
 * Dung Mockito mock CourseRepository, ProfileRepository, ApprovalHistoryRepository.
 * Ten test: methodName_ShouldDoWhat_WhenCondition
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ApprovalService Unit Tests")
class ApprovalServiceTest {

    @Mock private CourseRepository          courseRepository;
    @Mock private ProfileRepository         profileRepository;
    @Mock private ApprovalHistoryRepository historyRepository;

    @InjectMocks
    private ApprovalService approvalService;

    private UUID adminId;
    private UUID courseId;
    private AuthenticatedUser adminUser;
    private Profile adminProfile;
    private Profile teacherProfile;
    private Category category;
    private Course pendingCourse;

    @BeforeEach
    void setUp() {
        adminId   = UUID.randomUUID();
        courseId  = UUID.randomUUID();

        adminUser     = new AuthenticatedUser(adminId, "admin@beeacademy.vn", "admin");
        adminProfile  = Profile.createNew(adminId, UserRole.ADMIN, "Admin User");
        teacherProfile = Profile.createNew(UUID.randomUUID(), UserRole.TEACHER, "Giáo viên");
        category = Category.create("toan-hoc", "Toán học");

        // Tao khoa hoc o trang thai PENDING_REVIEW
        pendingCourse = Course.createByTeacher(teacherProfile, "Toán Lớp 7",
                "Mô tả", category, new int[]{7}, 299_000);
        pendingCourse.submitForReview();
    }

    // =========================================================================
    // TC08 — approve: PENDING_REVIEW -> PUBLISHED
    // =========================================================================
    @Test
    @DisplayName("TC08: approve_ShouldPublishCourse_WhenPending")
    void approve_ShouldPublishCourse_WhenPending() {
        // Arrange
        when(courseRepository.findWithCategoryAndTeacherById(courseId))
                .thenReturn(Optional.of(pendingCourse));
        when(profileRepository.findById(adminId)).thenReturn(Optional.of(adminProfile));
        when(courseRepository.save(any())).thenReturn(pendingCourse);
        when(historyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // Act
        approvalService.approve(courseId, adminUser, "Đạt chất lượng");

        // Assert
        assertThat(pendingCourse.getStatus()).isEqualTo(CourseStatus.PUBLISHED);
        verify(courseRepository).save(pendingCourse);

        // Kiem tra history duoc ghi dung
        ArgumentCaptor<ApprovalHistory> historyCaptor = ArgumentCaptor.forClass(ApprovalHistory.class);
        verify(historyRepository).save(historyCaptor.capture());
        assertThat(historyCaptor.getValue().getAction()).isEqualTo("approved");
    }

    // =========================================================================
    // TC09 — reject: comment rong -> throw BusinessException
    // =========================================================================
    @Test
    @DisplayName("TC09: reject_ShouldThrow_WhenCommentBlank")
    void reject_ShouldThrow_WhenCommentBlank() {
        // Act & Assert — comment null
        assertThatThrownBy(() -> approvalService.reject(courseId, adminUser, null))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("lý do từ chối");

        // Act & Assert — comment chi co khoang trang
        assertThatThrownBy(() -> approvalService.reject(courseId, adminUser, "   "))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("lý do từ chối");

        // Khong duoc truy cap DB neu throw som
        verify(courseRepository, never()).findWithCategoryAndTeacherById(any());
    }

    // =========================================================================
    // TC10 — revise: ghi history dung action "needs_revision"
    // =========================================================================
    @Test
    @DisplayName("TC10: revise_ShouldSaveHistoryWithCorrectAction_WhenCommentProvided")
    void revise_ShouldSaveHistoryWithCorrectAction_WhenCommentProvided() {
        // Arrange
        when(courseRepository.findWithCategoryAndTeacherById(courseId))
                .thenReturn(Optional.of(pendingCourse));
        when(profileRepository.findById(adminId)).thenReturn(Optional.of(adminProfile));
        when(courseRepository.save(any())).thenReturn(pendingCourse);
        when(historyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // Act
        approvalService.revise(courseId, adminUser, "Cần bổ sung thêm ví dụ");

        // Assert
        assertThat(pendingCourse.getStatus()).isEqualTo(CourseStatus.NEEDS_REVISION);

        ArgumentCaptor<ApprovalHistory> captor = ArgumentCaptor.forClass(ApprovalHistory.class);
        verify(historyRepository).save(captor.capture());
        assertThat(captor.getValue().getAction()).isEqualTo("needs_revision");
        assertThat(captor.getValue().getComment()).isEqualTo("Cần bổ sung thêm ví dụ");
    }

    // =========================================================================
    // TC11 — approve: course khong o trang thai PENDING_REVIEW -> throw
    // =========================================================================
    @Test
    @DisplayName("TC11: approve_ShouldThrow_WhenCourseNotPending")
    void approve_ShouldThrow_WhenCourseNotPending() {
        // Arrange — khoa hoc o trang thai DRAFT (chua nop duyet)
        Course draftCourse = Course.createByTeacher(teacherProfile, "Khóa nháp",
                "Mô tả", category, new int[]{8}, 199_000);
        // status = DRAFT, chua goi submitForReview()

        when(courseRepository.findWithCategoryAndTeacherById(courseId))
                .thenReturn(Optional.of(draftCourse));

        // Act & Assert
        assertThatThrownBy(() -> approvalService.approve(courseId, adminUser, null))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("không ở trạng thái chờ duyệt");

        // Khoa hoc khong duoc save khi throw
        verify(courseRepository, never()).save(any());
        verify(historyRepository, never()).save(any());
    }

    // =========================================================================
    // TC12 — approve: courseId khong ton tai -> throw ResourceNotFoundException
    // =========================================================================
    @Test
    @DisplayName("TC12: approve_ShouldThrow_WhenCourseNotFound")
    void approve_ShouldThrow_WhenCourseNotFound() {
        when(courseRepository.findWithCategoryAndTeacherById(courseId))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> approvalService.approve(courseId, adminUser, "OK"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Course");
    }

    // =========================================================================
    // TC13 — getPendingCourses: tra ve PageResponse dung cau truc
    // =========================================================================
    @Test
    @DisplayName("TC13: getPendingCourses_ShouldReturnPageResponse_WhenCalled")
    void getPendingCourses_ShouldReturnPageResponse_WhenCalled() {
        // Arrange
        org.springframework.data.domain.Pageable pageable =
                org.springframework.data.domain.PageRequest.of(0, 10);
        org.springframework.data.domain.Page<Course> emptyPage =
                org.springframework.data.domain.Page.empty(pageable);

        when(courseRepository.findPendingReview(
                com.beeacademy.backend.model.CourseStatus.PENDING_REVIEW, pageable))
                .thenReturn(emptyPage);

        // Act
        var result = approvalService.getPendingCourses(pageable);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.items()).isEmpty();
    }

    // =========================================================================
    // TC14 — getHistory: tra ve list rong khi khoa hoc chua co lich su
    // =========================================================================
    @Test
    @DisplayName("TC14: getHistory_ShouldReturnEmptyList_WhenNoPriorActions")
    void getHistory_ShouldReturnEmptyList_WhenNoPriorActions() {
        when(historyRepository.findByCourseIdOrderByCreatedAtAsc(courseId))
                .thenReturn(List.of());

        var result = approvalService.getHistory(courseId);

        assertThat(result).isNotNull().isEmpty();
    }
}

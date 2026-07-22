package com.beeacademy.backend.service;

import com.beeacademy.backend.client.SupabaseStorageClient;
import com.beeacademy.backend.dto.request.CreateQaThreadRequest;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.QaThread;
import com.beeacademy.backend.model.UserRole;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.LessonRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.QaThreadRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class QaServiceTest {

    @Mock private QaThreadRepository qaThreadRepository;
    @Mock private ProfileRepository profileRepository;
    @Mock private CourseRepository courseRepository;
    @Mock private LessonRepository lessonRepository;
    @Mock private EnrollmentRepository enrollmentRepository;
    @Mock private UserNotificationService notificationService;
    @Mock private ParentTeacherMessageEmailService parentTeacherMessageEmailService;
    @Mock private SupabaseStorageClient storageClient;
    @Mock private TeacherAccessService teacherAccessService;

    @InjectMocks private QaService service;

    @Test
    void createQuestionStoresTitleAndNotifiesResponsibleTeacherImmediately() {
        UUID studentId = UUID.randomUUID();
        UUID teacherId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        Profile student = Profile.createNew(studentId, UserRole.STUDENT, "Học sinh A");
        Profile teacher = Profile.createNew(teacherId, UserRole.TEACHER, "Giáo viên B");
        Course course = mock(Course.class);
        when(course.getId()).thenReturn(courseId);
        when(course.getTitle()).thenReturn("Toán 8");
        when(course.getTeacher()).thenReturn(teacher);
        when(profileRepository.findById(studentId)).thenReturn(Optional.of(student));
        when(courseRepository.findWithCategoryAndTeacherById(courseId)).thenReturn(Optional.of(course));
        when(enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)).thenReturn(true);
        when(qaThreadRepository.saveAndFlush(any(QaThread.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.createStudentThread(
                student(studentId),
                new CreateQaThreadRequest(
                        courseId, null, "  Phép biến đổi bài 3  ",
                        "  Em chưa hiểu phép biến đổi này.  ", "private",
                        null, null, null, null));

        ArgumentCaptor<QaThread> threadCaptor = ArgumentCaptor.forClass(QaThread.class);
        verify(qaThreadRepository).saveAndFlush(threadCaptor.capture());
        assertThat(threadCaptor.getValue().getTitle()).isEqualTo("Phép biến đổi bài 3");
        assertThat(threadCaptor.getValue().getVisibility()).isEqualTo("private");
        assertThat(response.title()).isEqualTo("Phép biến đổi bài 3");
        assertThat(response.status()).isEqualTo("pending");
        verify(notificationService).notify(
                eq(teacherId),
                eq("qa_new_student_question"),
                eq("Câu hỏi mới từ học sinh"),
                contains("Phép biến đổi bài 3"),
                eq("/teacher/qa"));
    }

    @Test
    void publicListingReturnsOnlyRepositoryPublicThreadsForEnrolledStudent() {
        UUID studentId = UUID.randomUUID();
        UUID authorId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        Profile viewer = Profile.createNew(studentId, UserRole.STUDENT, "Viewer");
        Profile author = Profile.createNew(authorId, UserRole.STUDENT, "Author");
        Course course = mock(Course.class);
        when(course.getId()).thenReturn(courseId);
        when(course.getTitle()).thenReturn("Vật lý 9");
        QaThread publicThread = QaThread.createStudentQuestion(
                author, course, null, "Câu hỏi công khai", "Nội dung câu hỏi công khai",
                null, null, null, null, "public");
        when(profileRepository.findById(studentId)).thenReturn(Optional.of(viewer));
        when(courseRepository.findById(courseId)).thenReturn(Optional.of(course));
        when(enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)).thenReturn(true);
        when(qaThreadRepository.findPublicThreadsByCourseId(courseId)).thenReturn(List.of(publicThread));

        var result = service.listCoursePublicThreads(courseId, student(studentId));

        assertThat(result).singleElement().satisfies(thread -> {
            assertThat(thread.title()).isEqualTo("Câu hỏi công khai");
            assertThat(thread.visibility()).isEqualTo("public");
        });
    }

    @Test
    void studentCannotReadAnotherStudentsPrivateQuestion() {
        UUID viewerId = UUID.randomUUID();
        UUID authorId = UUID.randomUUID();
        Profile viewer = Profile.createNew(viewerId, UserRole.STUDENT, "Viewer");
        Profile author = Profile.createNew(authorId, UserRole.STUDENT, "Author");
        Course course = mock(Course.class);
        QaThread privateThread = QaThread.createStudentQuestion(
                author, course, null, "Câu hỏi riêng tư", "Nội dung câu hỏi riêng tư",
                null, null, null, null, "private");
        when(profileRepository.findById(viewerId)).thenReturn(Optional.of(viewer));
        when(qaThreadRepository.findDetailedById(privateThread.getId()))
                .thenReturn(Optional.of(privateThread));

        assertThatThrownBy(() -> service.getStudentThread(privateThread.getId(), student(viewerId)))
                .isInstanceOfSatisfying(BusinessException.class, exception -> {
                    assertThat(exception.getCode()).isEqualTo("FORBIDDEN");
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
                });
        verify(enrollmentRepository, never()).existsByStudentIdAndCourseId(any(), any());
    }

    @Test
    void adminCanReadPrivateQuestion() {
        UUID adminId = UUID.randomUUID();
        UUID authorId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        Profile admin = Profile.createNew(adminId, UserRole.ADMIN, "Admin");
        Profile author = Profile.createNew(authorId, UserRole.STUDENT, "Author");
        Course course = mock(Course.class);
        when(course.getId()).thenReturn(courseId);
        when(course.getTitle()).thenReturn("Hóa học 8");
        QaThread privateThread = QaThread.createStudentQuestion(
                author, course, null, "Câu hỏi riêng tư", "Nội dung câu hỏi riêng tư",
                null, null, null, null, "private");
        when(profileRepository.findById(adminId)).thenReturn(Optional.of(admin));
        when(qaThreadRepository.findDetailedById(privateThread.getId()))
                .thenReturn(Optional.of(privateThread));

        var response = service.getAdminThread(privateThread.getId(), admin(adminId));

        assertThat(response.visibility()).isEqualTo("private");
        assertThat(response.title()).isEqualTo("Câu hỏi riêng tư");
    }

    private AuthenticatedUser student(UUID id) {
        return new AuthenticatedUser(id, "student@example.com", "student");
    }

    private AuthenticatedUser admin(UUID id) {
        return new AuthenticatedUser(id, "admin@example.com", "admin");
    }
}

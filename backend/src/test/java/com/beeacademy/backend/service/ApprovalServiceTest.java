package com.beeacademy.backend.service;

import com.beeacademy.backend.client.SupabaseStorageClient;
import com.beeacademy.backend.dto.response.AdminDocumentUrlResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Chapter;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseDocument;
import com.beeacademy.backend.model.Lesson;
import com.beeacademy.backend.repository.ApprovalHistoryRepository;
import com.beeacademy.backend.repository.CourseDocumentRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ApprovalServiceTest {

    @Mock private CourseRepository courseRepository;
    @Mock private ProfileRepository profileRepository;
    @Mock private ApprovalHistoryRepository historyRepository;
    @Mock private UserNotificationService notificationService;
    @Mock private CourseDocumentRepository documentRepository;
    @Mock private SupabaseStorageClient storageClient;

    @InjectMocks private ApprovalService service;

    private final UUID courseId = UUID.randomUUID();

    /** Dựng chain document → lesson → chapter → course với courseId cố định. */
    private CourseDocument documentInCourse(UUID courseId, String storagePath,
                                            String storageBucket, String fileUrl) {
        Course course = Course.createByTeacher(null, "Toan 8", null, null, null,
                null, new int[] {8}, 100_000);
        ReflectionTestUtils.setField(course, "id", courseId);
        Chapter chapter = Chapter.createNew(course, "Chuong 1", null, 1);
        Lesson lesson = Lesson.createNew(chapter, "Bai 1", null, 1, false);
        return CourseDocument.create(lesson, "Tai lieu 1", fileUrl, storagePath,
                storageBucket, "pdf", 42L, 1);
    }

    @Test
    void getDocumentPreviewUrlSignsPrivateObjectWithShortTtl() {
        UUID documentId = UUID.randomUUID();
        CourseDocument document = documentInCourse(courseId,
                "documents/a/b.pdf", "course-documents", null);
        when(documentRepository.findById(documentId)).thenReturn(Optional.of(document));
        when(storageClient.generateSignedUrl("course-documents", "documents/a/b.pdf", 600))
                .thenReturn("https://signed.example/b.pdf");

        AdminDocumentUrlResponse response = service.getDocumentPreviewUrl(courseId, documentId);

        assertThat(response.url()).isEqualTo("https://signed.example/b.pdf");
        assertThat(response.expiresAt()).isNotNull();
    }

    @Test
    void getDocumentPreviewUrlSignsInLegacyBucketWhenRowStillPointsThere() {
        UUID documentId = UUID.randomUUID();
        CourseDocument document = documentInCourse(courseId,
                "documents/a/b.pdf", "course-docs", null);
        when(documentRepository.findById(documentId)).thenReturn(Optional.of(document));
        when(storageClient.generateSignedUrl("course-docs", "documents/a/b.pdf", 600))
                .thenReturn("https://signed.example/legacy.pdf");

        AdminDocumentUrlResponse response = service.getDocumentPreviewUrl(courseId, documentId);

        assertThat(response.url()).isEqualTo("https://signed.example/legacy.pdf");
    }

    @Test
    void getDocumentPreviewUrlFallsBackToLegacyPublicUrl() {
        UUID documentId = UUID.randomUUID();
        CourseDocument document = documentInCourse(courseId,
                null, null, "https://public.example/old.pdf");
        when(documentRepository.findById(documentId)).thenReturn(Optional.of(document));

        AdminDocumentUrlResponse response = service.getDocumentPreviewUrl(courseId, documentId);

        assertThat(response.url()).isEqualTo("https://public.example/old.pdf");
        assertThat(response.expiresAt()).isNull();
        verifyNoInteractions(storageClient);
    }

    @Test
    void getDocumentPreviewUrlRejectsDocumentFromAnotherCourse() {
        UUID documentId = UUID.randomUUID();
        CourseDocument document = documentInCourse(UUID.randomUUID(),
                "documents/a/b.pdf", "course-documents", null);
        when(documentRepository.findById(documentId)).thenReturn(Optional.of(document));

        assertThatThrownBy(() -> service.getDocumentPreviewUrl(courseId, documentId))
                .isInstanceOf(ResourceNotFoundException.class);
        verifyNoInteractions(storageClient);
    }

    @Test
    void getDocumentPreviewUrlFailsWhenDocumentHasNoPathAndNoUrl() {
        UUID documentId = UUID.randomUUID();
        CourseDocument document = documentInCourse(courseId, null, null, null);
        when(documentRepository.findById(documentId)).thenReturn(Optional.of(document));

        assertThatThrownBy(() -> service.getDocumentPreviewUrl(courseId, documentId))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).getCode())
                .isEqualTo("DOCUMENT_UNAVAILABLE");
    }
}

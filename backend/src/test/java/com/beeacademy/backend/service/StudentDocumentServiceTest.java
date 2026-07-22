package com.beeacademy.backend.service;

import com.beeacademy.backend.client.SupabaseStorageClient;
import com.beeacademy.backend.dto.response.DocumentDownloadResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.model.Chapter;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseDocument;
import com.beeacademy.backend.model.Lesson;
import com.beeacademy.backend.model.StudentDocumentDownload;
import com.beeacademy.backend.repository.CourseDocumentRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.StudentDocumentDownloadRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StudentDocumentServiceTest {

    @Mock private SupabaseStorageClient storageClient;
    @Mock private CourseDocumentRepository documentRepository;
    @Mock private EnrollmentRepository enrollmentRepository;
    @Mock private ProfileRepository profileRepository;
    @Mock private StudentDocumentDownloadRepository downloadRepository;

    @InjectMocks private StudentDocumentService service;

    @Test
    void createDownloadMigratesLegacyDocumentAndReturnsOneTimeLink() {
        UUID studentId = UUID.randomUUID();
        UUID courseId = UUID.randomUUID();
        UUID lessonId = UUID.randomUUID();
        UUID documentId = UUID.randomUUID();
        AuthenticatedUser me = new AuthenticatedUser(studentId, "student@example.com", "student");

        Course course = mock(Course.class);
        Chapter chapter = mock(Chapter.class);
        Lesson lesson = mock(Lesson.class);
        CourseDocument document = mock(CourseDocument.class);
        when(enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)).thenReturn(true);
        when(documentRepository.findById(documentId)).thenReturn(Optional.of(document));
        when(document.getLesson()).thenReturn(lesson);
        when(lesson.getId()).thenReturn(lessonId);
        when(lesson.getChapter()).thenReturn(chapter);
        when(chapter.getCourse()).thenReturn(course);
        when(course.getId()).thenReturn(courseId);
        when(document.getStoragePath()).thenReturn("lesson/slide.pptx");
        when(document.getStorageBucket()).thenReturn("course-docs");
        when(document.getId()).thenReturn(documentId);
        when(document.getFileType()).thenReturn("pptx");
        when(storageClient.download("course-docs", "lesson/slide.pptx"))
                .thenReturn(new byte[] {4, 5, 6});

        DocumentDownloadResponse result = service.createDownload(courseId, lessonId, documentId, me);

        assertThat(result.downloadUrl()).startsWith("/api/document-downloads/");
        assertThat(result.watermarked()).isFalse();
        assertThat(result.oneTime()).isTrue();
        verify(storageClient).download("course-docs", "lesson/slide.pptx");
        verify(storageClient).upload(eq("course-documents"),
                org.mockito.ArgumentMatchers.startsWith("documents/"),
                eq("application/vnd.openxmlformats-officedocument.presentationml.presentation"),
                eq(new byte[] {4, 5, 6}));
        verify(document).moveToPrivateStorage(eq("course-documents"),
                org.mockito.ArgumentMatchers.startsWith("documents/"));
        verify(downloadRepository).save(any(StudentDocumentDownload.class));
    }

    @Test
    void consumeDownloadStreamsPrivateObjectOnlyAfterAtomicTokenConsumption() {
        UUID documentId = UUID.randomUUID();
        String tokenHash = hash("token");
        StudentDocumentDownload download = StudentDocumentDownload.create(
                UUID.randomUUID(), documentId, Instant.now(), Instant.now().plusSeconds(300),
                null, tokenHash);
        CourseDocument document = CourseDocument.create(
                null, "Bai giang 1", null, "documents/a/lesson.docx", "course-documents",
                "docx", 42L, 1);

        when(downloadRepository.consumeActiveToken(eq(tokenHash), any(Instant.class))).thenReturn(1);
        when(downloadRepository.findByTokenHash(tokenHash)).thenReturn(Optional.of(download));
        when(documentRepository.findById(documentId)).thenReturn(Optional.of(document));
        when(storageClient.download("course-documents", "documents/a/lesson.docx"))
                .thenReturn(new byte[] {1, 2, 3});

        StudentDocumentService.DownloadedDocument result = service.consumeDownload("token");

        assertThat(result.bytes()).containsExactly(1, 2, 3);
        assertThat(result.filename()).isEqualTo("Bai giang 1.docx");
        assertThat(result.contentType())
                .isEqualTo("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    }

    @Test
    void consumeDownloadStreamsLegacyBucketWithoutPrivateMigration() {
        UUID documentId = UUID.randomUUID();
        String tokenHash = hash("legacy-token");
        StudentDocumentDownload download = StudentDocumentDownload.create(
                UUID.randomUUID(), documentId, Instant.now(), Instant.now().plusSeconds(300),
                null, tokenHash);
        CourseDocument document = CourseDocument.create(
                null, "Slide lich su", null, "lesson/slide.pptx", "course-docs",
                "pptx", 206_000L, 1);

        when(downloadRepository.consumeActiveToken(eq(tokenHash), any(Instant.class))).thenReturn(1);
        when(downloadRepository.findByTokenHash(tokenHash)).thenReturn(Optional.of(download));
        when(documentRepository.findById(documentId)).thenReturn(Optional.of(document));
        when(storageClient.download("course-docs", "lesson/slide.pptx"))
                .thenReturn(new byte[] {4, 5, 6});

        StudentDocumentService.DownloadedDocument result = service.consumeDownload("legacy-token");

        assertThat(result.bytes()).containsExactly(4, 5, 6);
        assertThat(result.filename()).isEqualTo("Slide lich su.pptx");
        assertThat(result.contentType())
                .isEqualTo("application/vnd.openxmlformats-officedocument.presentationml.presentation");
    }

    @Test
    void consumeDownloadRejectsReplayOrExpiredToken() {
        when(downloadRepository.consumeActiveToken(any(), any(Instant.class))).thenReturn(0);

        assertThatThrownBy(() -> service.consumeDownload("already-used"))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).getCode())
                .isEqualTo("DOCUMENT_DOWNLOAD_LINK_INVALID");
    }

    private String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }
}

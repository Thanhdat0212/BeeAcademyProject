package com.beeacademy.backend.service;

import com.beeacademy.backend.client.SupabaseStorageClient;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.model.CourseDocument;
import com.beeacademy.backend.model.StudentDocumentDownload;
import com.beeacademy.backend.repository.CourseDocumentRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.StudentDocumentDownloadRepository;
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

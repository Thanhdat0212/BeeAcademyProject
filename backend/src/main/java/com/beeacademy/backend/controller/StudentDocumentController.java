package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.DocumentDownloadResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.StudentDocumentService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/student/courses/{courseId}/lessons/{lessonId}/documents")
@RequiredArgsConstructor
@PreAuthorize("hasRole('student')")
public class StudentDocumentController {

    private final StudentDocumentService documentService;

    @GetMapping("/{documentId}/download")
    public ApiResponse<DocumentDownloadResponse> download(
            @PathVariable UUID courseId,
            @PathVariable UUID lessonId,
            @PathVariable UUID documentId) {
        return ApiResponse.ok(documentService.createDownload(
                courseId, lessonId, documentId, CurrentUser.required()));
    }
}

/** Public only by an unguessable, one-time token; never exposes Supabase signed URLs. */
@RestController
@RequiredArgsConstructor
class OneTimeStudentDocumentDownloadController {

    private final StudentDocumentService documentService;

    @GetMapping("/api/document-downloads/{token}")
    public ResponseEntity<ByteArrayResource> consume(@PathVariable String token) {
        StudentDocumentService.DownloadedDocument document = documentService.consumeDownload(token);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(document.contentType()))
                .cacheControl(CacheControl.noStore().cachePrivate())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(document.filename(), StandardCharsets.UTF_8).build().toString())
                .contentLength(document.bytes().length)
                .body(new ByteArrayResource(document.bytes()));
    }
}

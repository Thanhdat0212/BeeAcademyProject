package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.dto.response.CertificateResponse;
import com.beeacademy.backend.dto.response.CertificateVerificationResponse;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.CertificateService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class CertificateController {

    private final CertificateService certificateService;

    @GetMapping("/api/certificates/verify/{verificationCode}")
    public ApiResponse<CertificateVerificationResponse> verify(
            @PathVariable String verificationCode) {
        return ApiResponse.ok(certificateService.verify(verificationCode));
    }

    @GetMapping("/api/student/certificates")
    @PreAuthorize("hasRole('student')")
    public ApiResponse<List<CertificateResponse>> listMyCertificates() {
        return ApiResponse.ok(certificateService.listMyCertificates(CurrentUser.required()));
    }

    @GetMapping("/api/student/certificates/{certificateId}")
    @PreAuthorize("hasRole('student')")
    public ApiResponse<CertificateResponse> getMyCertificate(
            @PathVariable UUID certificateId) {
        return ApiResponse.ok(certificateService.getMyCertificate(certificateId, CurrentUser.required()));
    }

    @PostMapping("/api/student/courses/{courseId}/certificate")
    @PreAuthorize("hasRole('student')")
    public ApiResponse<CertificateResponse> requestIssue(
            @PathVariable UUID courseId) {
        return ApiResponse.ok(
                certificateService.requestIssue(courseId, CurrentUser.required()),
                "Da cap chung chi khoa hoc");
    }
}

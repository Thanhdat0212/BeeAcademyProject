package com.beeacademy.backend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * DTO đại diện cho thông tin tóm tắt của học sinh (con) đã liên kết.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LinkedStudentResponse {

    private UUID id;
    private String name;
    private String avatarUrl;
    private String code;
    private String grade;
    private String linkStatus;
    private UUID unlinkRequestedById;
    private String unlinkRequestedByRole;
    private Instant unlinkRequestedAt;
}

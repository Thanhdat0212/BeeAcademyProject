package com.beeacademy.backend.dto.response;

import java.time.Instant;
import java.util.UUID;

public record StudentParentLinkInvitationResponse(
        UUID parentId,
        String parentName,
        String parentEmail,
        String avatarUrl,
        String status,
        Instant invitedAt,
        Instant respondedAt
) {
}

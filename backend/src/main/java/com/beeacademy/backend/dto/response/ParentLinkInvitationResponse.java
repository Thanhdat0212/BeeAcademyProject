package com.beeacademy.backend.dto.response;

import java.time.Instant;
import java.util.UUID;

public record ParentLinkInvitationResponse(
        UUID studentId,
        String studentName,
        String studentEmail,
        String avatarUrl,
        String grade,
        String relationship,
        String note,
        String status,
        Instant invitedAt,
        Instant expiresAt,
        boolean expired,
        Instant respondedAt,
        UUID unlinkRequestedById,
        String unlinkRequestedByRole,
        Instant unlinkRequestedAt
) {
}

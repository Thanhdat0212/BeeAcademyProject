package com.beeacademy.backend.dto.response;

import java.time.Instant;
import java.util.UUID;

public record ParentLinkInvitationResponse(
        UUID studentId,
        String studentName,
        String studentEmail,
        String avatarUrl,
        String grade,
        String status,
        Instant invitedAt,
        Instant respondedAt,
        UUID unlinkRequestedById,
        String unlinkRequestedByRole,
        Instant unlinkRequestedAt
) {
}

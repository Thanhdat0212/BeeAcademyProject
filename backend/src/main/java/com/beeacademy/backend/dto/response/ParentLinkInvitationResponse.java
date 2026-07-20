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
        Instant unlinkRequestedAt,
        boolean acceptedForProcessing,
        String neutralMessage
) {
    public static ParentLinkInvitationResponse neutral(String studentEmail, String message) {
        return new ParentLinkInvitationResponse(
                null,
                "",
                studentEmail,
                null,
                "",
                "",
                null,
                "pending",
                null,
                null,
                false,
                null,
                null,
                null,
                null,
                false,
                message);
    }
}

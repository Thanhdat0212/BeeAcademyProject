package com.beeacademy.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.ColumnTransformer;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "parent_student_links")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class ParentStudentLink {

    @EmbeddedId
    private Id id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("parentId")
    @JoinColumn(name = "parent_id", nullable = false)
    private Profile parent;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("studentId")
    @JoinColumn(name = "student_id", nullable = false)
    private Profile student;

    @Convert(converter = ParentStudentLinkStatusConverter.class)
    @ColumnTransformer(read = "status::text", write = "?::parent_link_status")
    @Column(name = "status", nullable = false)
    @Builder.Default
    private ParentStudentLinkStatus status = ParentStudentLinkStatus.ACCEPTED;

    @Column(name = "invited_at", nullable = false)
    private Instant invitedAt;

    @Column(name = "responded_at")
    private Instant respondedAt;

    @Column(name = "relationship", nullable = false, length = 30)
    @Builder.Default
    private String relationship = "guardian";

    @Column(name = "note", length = 500)
    private String note;

    @Column(name = "unlink_requested_by")
    private UUID unlinkRequestedBy;

    @Column(name = "unlink_requested_at")
    private Instant unlinkRequestedAt;

    @Embeddable
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Id implements Serializable {

        private static final long serialVersionUID = 1L;

        @Column(name = "parent_id")
        private UUID parentId;

        @Column(name = "student_id")
        private UUID studentId;
    }

    public static ParentStudentLink createAcceptedLink(Profile parent, Profile student) {
        if (parent == null || student == null) {
            throw new IllegalArgumentException("Parent and student profile must not be null.");
        }

        Instant now = Instant.now();
        return ParentStudentLink.builder()
                .id(new Id(parent.getId(), student.getId()))
                .parent(parent)
                .student(student)
                .status(ParentStudentLinkStatus.ACCEPTED)
                .invitedAt(now)
                .respondedAt(now)
                .build();
    }

    public static ParentStudentLink createPendingInvitation(Profile parent, Profile student) {
        return createPendingInvitation(parent, student, "guardian", null);
    }

    public static ParentStudentLink createPendingInvitation(
            Profile parent,
            Profile student,
            String relationship,
            String note) {
        if (parent == null || student == null) {
            throw new IllegalArgumentException("Parent and student profile must not be null.");
        }

        Instant now = Instant.now();
        return ParentStudentLink.builder()
                .id(new Id(parent.getId(), student.getId()))
                .parent(parent)
                .student(student)
                .status(ParentStudentLinkStatus.PENDING)
                .invitedAt(now)
                .respondedAt(null)
                .relationship(normalizeRelationship(relationship))
                .note(normalizeNote(note))
                .build();
    }

    public void markPending() {
        markPending(this.relationship, this.note);
    }

    public void markPending(String relationship, String note) {
        this.status = ParentStudentLinkStatus.PENDING;
        this.invitedAt = Instant.now();
        this.respondedAt = null;
        this.relationship = normalizeRelationship(relationship);
        this.note = normalizeNote(note);
        this.unlinkRequestedBy = null;
        this.unlinkRequestedAt = null;
    }

    public void accept() {
        this.status = ParentStudentLinkStatus.ACCEPTED;
        this.respondedAt = Instant.now();
        this.unlinkRequestedBy = null;
        this.unlinkRequestedAt = null;
    }

    public void reject() {
        this.status = ParentStudentLinkStatus.REJECTED;
        this.respondedAt = Instant.now();
        this.unlinkRequestedBy = null;
        this.unlinkRequestedAt = null;
    }

    public boolean hasPendingUnlinkRequest() {
        return this.unlinkRequestedBy != null;
    }

    public boolean isUnlinkRequestedBy(UUID userId) {
        return userId != null && userId.equals(this.unlinkRequestedBy);
    }

    public void requestUnlink(UUID requesterId) {
        if (requesterId == null) {
            throw new IllegalArgumentException("Requester id must not be null.");
        }
        this.unlinkRequestedBy = requesterId;
        this.unlinkRequestedAt = Instant.now();
    }

    public void revoke() {
        this.status = ParentStudentLinkStatus.REJECTED;
        this.respondedAt = Instant.now();
    }

    private static String normalizeRelationship(String relationship) {
        if (relationship == null || relationship.isBlank()) {
            return "guardian";
        }
        return relationship.trim().toLowerCase();
    }

    private static String normalizeNote(String note) {
        if (note == null || note.isBlank()) {
            return null;
        }
        String normalized = note.trim();
        return normalized.length() <= 500 ? normalized : normalized.substring(0, 500);
    }
}

package com.beeacademy.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "profiles")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder(access = AccessLevel.PRIVATE)
public class Profile {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    // H2-adapted: bo @ColumnTransformer (PostgreSQL cast syntax), dung @Convert thuan tuy
    @Convert(converter = UserRoleConverter.class)
    @Column(name = "role", nullable = false)
    private UserRole role;

    @Column(name = "full_name")
    private String fullName;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @Column(name = "phone")
    private String phone;

    @Column(name = "bio")
    private String bio;

    @Column(name = "twitter_url")
    private String twitterUrl;

    @Column(name = "facebook_url")
    private String facebookUrl;

    @Column(name = "linkedin_url")
    private String linkedinUrl;

    @Column(name = "is_blocked", nullable = false)
    private boolean isBlocked = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public static Profile createNew(UUID authUserId, UserRole role, String fullName) {
        if (authUserId == null) throw new IllegalArgumentException("authUserId không được null");
        if (role == null) throw new IllegalArgumentException("role không được null");
        return Profile.builder()
                .id(authUserId)
                .role(role)
                .fullName(fullName)
                .build();
    }

    public void updatePersonalInfo(String fullName, String phone, String bio,
                                   String twitterUrl, String facebookUrl, String linkedinUrl) {
        if (fullName != null) {
            String trimmed = fullName.trim();
            if (trimmed.isEmpty()) throw new IllegalArgumentException("fullName không được trống");
            this.fullName = trimmed;
        }
        if (phone != null) this.phone = phone.trim();
        if (bio != null) this.bio = bio;
        if (twitterUrl != null) this.twitterUrl = twitterUrl;
        if (facebookUrl != null) this.facebookUrl = facebookUrl;
        if (linkedinUrl != null) this.linkedinUrl = linkedinUrl;
    }

    public void changeAvatar(String newAvatarUrl) { this.avatarUrl = newAvatarUrl; }
    public void block()   { this.isBlocked = true; }
    public void unblock() { this.isBlocked = false; }
    public void changeRole(UserRole newRole) { this.role = newRole; }
}

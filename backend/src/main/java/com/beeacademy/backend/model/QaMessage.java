package com.beeacademy.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "qa_messages")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class QaMessage {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "thread_id", nullable = false)
    private QaThread thread;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id", nullable = false)
    private Profile author;

    @Convert(converter = UserRoleConverter.class)
    @ColumnTransformer(read = "author_role::text", write = "?::user_role")
    @Column(name = "author_role", nullable = false)
    private UserRole authorRole;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    static QaMessage create(QaThread thread, Profile author, String content) {
        QaMessage message = new QaMessage();
        message.id = UUID.randomUUID();
        message.thread = thread;
        message.author = author;
        message.authorRole = author.getRole();
        message.content = content.trim();
        return message;
    }
}

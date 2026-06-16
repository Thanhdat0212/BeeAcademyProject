package com.beeacademy.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "chapters")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Chapter {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "course_id", nullable = false)
    @JsonIgnore
    private Course course;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "description")
    private String description;

    @Column(name = "position", nullable = false)
    private Integer position;

    @OneToMany(mappedBy = "chapter", fetch = FetchType.LAZY,
               cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    private List<Lesson> lessons = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public List<Lesson> getLessons() {
        return Collections.unmodifiableList(lessons);
    }

    public static Chapter createNew(Course course, String title, String description, Integer position) {
        Chapter c = new Chapter();
        c.id = UUID.randomUUID();
        c.course = course;
        c.title = title;
        c.description = description;
        c.position = position;
        return c;
    }

    public void update(String title, String description, Integer position) {
        if (title != null && !title.isBlank()) this.title = title.trim();
        if (description != null) this.description = description;
        if (position != null && position > 0) this.position = position;
    }
}

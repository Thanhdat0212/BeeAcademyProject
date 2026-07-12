package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.StudentLessonNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StudentLessonNoteRepository extends JpaRepository<StudentLessonNote, UUID> {

    List<StudentLessonNote> findByStudent_IdAndLesson_IdOrderByTimeSecAscCreatedAtAsc(
            UUID studentId, UUID lessonId);

    Optional<StudentLessonNote> findByIdAndStudent_IdAndLesson_Id(
            UUID id, UUID studentId, UUID lessonId);
}

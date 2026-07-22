package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.QuestionVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;
import java.util.List;
import java.util.Optional;

public interface QuestionVersionRepository extends JpaRepository<QuestionVersion, UUID> {

    long countByQuestionId(UUID questionId);

    Optional<QuestionVersion> findTopByQuestionIdOrderByVersionNoDesc(UUID questionId);

    List<QuestionVersion> findByQuestionIdOrderByVersionNoDesc(UUID questionId);
}

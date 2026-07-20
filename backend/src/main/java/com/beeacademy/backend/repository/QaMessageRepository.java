package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.QaMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.UUID;

@Repository
public interface QaMessageRepository extends JpaRepository<QaMessage, UUID> {

    long deleteByRetentionUntilBefore(Instant cutoff);
}

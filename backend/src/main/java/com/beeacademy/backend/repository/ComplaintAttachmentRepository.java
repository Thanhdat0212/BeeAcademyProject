package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.ComplaintAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ComplaintAttachmentRepository extends JpaRepository<ComplaintAttachment, UUID> {
}

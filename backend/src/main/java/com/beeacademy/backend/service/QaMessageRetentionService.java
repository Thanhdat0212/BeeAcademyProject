package com.beeacademy.backend.service;

import com.beeacademy.backend.repository.QaMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Slf4j
@Service
@RequiredArgsConstructor
public class QaMessageRetentionService {

    private final QaMessageRepository qaMessageRepository;

    @Scheduled(cron = "0 30 2 * * *")
    @Transactional
    public void purgeExpiredMessages() {
        long deleted = qaMessageRepository.deleteByRetentionUntilBefore(Instant.now());
        if (deleted > 0) {
            log.info("Purged {} QA/parent-teacher messages past retention policy", deleted);
        }
    }
}

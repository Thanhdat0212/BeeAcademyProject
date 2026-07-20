package com.beeacademy.backend.service;

import com.beeacademy.backend.repository.QaMessageRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class QaMessageRetentionServiceTest {

    @Mock
    private QaMessageRepository qaMessageRepository;

    @InjectMocks
    private QaMessageRetentionService service;

    @Test
    void purgeExpiredMessagesDeletesMessagesPastRetentionCutoff() {
        Instant before = Instant.now();
        when(qaMessageRepository.deleteByRetentionUntilBefore(org.mockito.ArgumentMatchers.any()))
                .thenReturn(3L);

        service.purgeExpiredMessages();

        ArgumentCaptor<Instant> cutoffCaptor = ArgumentCaptor.forClass(Instant.class);
        verify(qaMessageRepository).deleteByRetentionUntilBefore(cutoffCaptor.capture());
        assertThat(cutoffCaptor.getValue()).isBetween(before, Instant.now());
    }
}

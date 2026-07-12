package com.beeacademy.backend.service;

import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.List;

/** Bo loc tu khoa co ban: review bi nghi ngo se cho Admin duyet truoc khi public. */
@Service
public class ReviewContentModerationService {

    private static final List<String> PROHIBITED_TERMS = List.of(
            "dit me", "dit may", "do ngu", "ngu nhu", "fuck", "shit", "bitch", "dmm");

    public boolean requiresModeration(String comment) {
        if (comment == null || comment.isBlank()) return false;
        String normalized = Normalizer.normalize(comment.replace('đ', 'd').replace('Đ', 'D'), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase()
                .replaceAll("[^a-z0-9]+", " ")
                .trim();
        return PROHIBITED_TERMS.stream().anyMatch(normalized::contains);
    }
}

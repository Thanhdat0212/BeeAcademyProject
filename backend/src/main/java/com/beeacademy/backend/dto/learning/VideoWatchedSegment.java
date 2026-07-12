package com.beeacademy.backend.dto.learning;

/** Một đoạn nội dung video đã được xem thực tế, tính theo giây. */
public record VideoWatchedSegment(int startSec, int endSec) {
}

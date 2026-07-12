package com.beeacademy.backend.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import com.beeacademy.backend.dto.learning.VideoWatchedSegment;

import java.util.List;

public record SaveStudentVideoProgressRequest(
        @NotNull @Min(0) Integer positionSec,
        @NotNull @Min(0) Integer durationSec,
        List<VideoWatchedSegment> watchedSegments
) {
}

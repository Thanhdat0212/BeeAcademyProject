package com.beeacademy.backend.dto.response;

/**
 * Số liệu nhanh cho header inbox khiếu nại (UC38).
 * {@code closed} gộp cả resolved + rejected (đều là thread đã đóng).
 */
public record ComplaintStatsResponse(
        long pending,
        long inProgress,
        long closed,
        long total
) {
}

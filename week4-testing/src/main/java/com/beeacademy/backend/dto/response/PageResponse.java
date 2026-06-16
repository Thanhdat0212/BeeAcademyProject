package com.beeacademy.backend.dto.response;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

public record PageResponse<T>(
        List<T> items,
        int page,
        int size,
        long totalItems,
        int totalPages,
        boolean hasNext
) {
    public static <E, D> PageResponse<D> of(Page<E> page, Function<E, D> mapper) {
        List<D> items = page.getContent().stream().map(mapper).toList();
        return new PageResponse<>(
                items, page.getNumber(), page.getSize(),
                page.getTotalElements(), page.getTotalPages(), page.hasNext()
        );
    }
}

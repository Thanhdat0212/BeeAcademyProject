package com.beeacademy.backend.dto.response;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

/**
 * Wrapper response chuẩn cho danh sách có phân trang.
 *
 * <p>Tại sao KHÔNG trả thẳng {@code Page<T>} của Spring:
 * <ul>
 *   <li>Spring {@code PageImpl} có shape JSON không ổn định (cảnh báo
 *       trong log mỗi lần serialize, có thể đổi giữa các version).</li>
 *   <li>Chứa nhiều field thừa cho frontend (sort, pageable, …).</li>
 * </ul>
 *
 * <p>Shape JSON trả về:
 * <pre>
 * {
 *   "items":      [...],
 *   "page":       0,
 *   "size":       20,
 *   "totalItems": 153,
 *   "totalPages": 8,
 *   "hasNext":    true
 * }
 * </pre>
 *
 * @param <T> kiểu của item (thường là DTO response)
 */
public record PageResponse<T>(
        List<T> items,
        int page,
        int size,
        long totalItems,
        int totalPages,
        boolean hasNext
) {

    /**
     * Tạo PageResponse từ Spring {@link Page} + hàm map entity → DTO.
     *
     * <p>Cách dùng:
     * <pre>
     *   Page&lt;Course&gt; entityPage = repository.findAll(spec, pageable);
     *   return PageResponse.of(entityPage, CourseSummaryResponse::fromEntity);
     * </pre>
     *
     * @param page   trang entity từ repository
     * @param mapper hàm chuyển entity → DTO
     */
    public static <E, D> PageResponse<D> of(Page<E> page, Function<E, D> mapper) {
        List<D> items = page.getContent().stream().map(mapper).toList();
        return new PageResponse<>(
                items,
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.hasNext()
        );
    }
}

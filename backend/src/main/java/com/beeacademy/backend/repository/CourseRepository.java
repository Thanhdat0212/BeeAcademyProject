package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.Course;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Truy vấn bảng {@code courses}.
 *
 * <p>Kế thừa 2 interface:
 * <ul>
 *   <li>{@link JpaRepository} - CRUD cơ bản.</li>
 *   <li>{@link JpaSpecificationExecutor} - hỗ trợ dynamic query qua
 *       {@link org.springframework.data.jpa.domain.Specification}, dùng
 *       cho endpoint {@code GET /api/courses} với filter optional
 *       (subject/grade/q).</li>
 * </ul>
 *
 * <p>Bằng cách dùng Specifications thay vì viết JPQL/native query nhiều
 * version:
 * <ul>
 *   <li>Composable: combine bao nhiêu filter cũng được qua {@code .and()}.</li>
 *   <li>Type-safe: dùng Criteria API, lỗi sai field detect lúc compile.</li>
 *   <li>Dễ test riêng từng spec.</li>
 * </ul>
 */
@Repository
public interface CourseRepository extends JpaRepository<Course, UUID>,
                                          JpaSpecificationExecutor<Course> {

    /**
     * Lookup theo slug (URL-friendly). UNIQUE constraint trên DB đảm bảo
     * trả về tối đa 1 row.
     */
    Optional<Course> findBySlug(String slug);

    /**
     * Lookup chi tiết khoá học kèm category + teacher (UC07).
     *
     * <p>{@code @EntityGraph} chỉ định JPA dùng JOIN FETCH cho category &
     * teacher → giảm N+1 query (không phải lazy load thêm 2 round-trip
     * sau khi đã có Course).
     *
     * <p>{@code chapters} và {@code chapters.lessons} KHÔNG join ở đây để
     * không phình kết quả - service sẽ fetch riêng (xem
     * {@code findChaptersWithLessons}).
     */
    @EntityGraph(attributePaths = {"category", "teacher"})
    Optional<Course> findWithCategoryAndTeacherById(UUID id);

    /** Cùng logic nhưng theo slug. */
    @EntityGraph(attributePaths = {"category", "teacher"})
    Optional<Course> findWithCategoryAndTeacherBySlug(String slug);
}

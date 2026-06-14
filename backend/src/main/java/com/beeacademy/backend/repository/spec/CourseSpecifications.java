package com.beeacademy.backend.repository.spec;

import com.beeacademy.backend.model.Category;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseStatus;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

/**
 * Factory cho {@link Specification} dùng trong endpoint
 * {@code GET /api/courses}.
 *
 * <p>Mỗi static method trả về 1 spec độc lập. Service compose chúng bằng
 * {@code .and()} để build query cuối cùng:
 * <pre>
 *   Specification&lt;Course&gt; spec = where(onlyPublished())
 *           .and(matchCategorySlug(subject))
 *           .and(matchGrade(grade))
 *           .and(matchKeyword(q));
 *   Page&lt;Course&gt; page = courseRepository.findAll(spec, pageable);
 * </pre>
 *
 * <p>Triết lý: spec trả về {@code null} khi filter rỗng → Spring Data
 * JPA tự bỏ qua, không thêm WHERE clause thừa.
 *
 * <p>Class utility - private constructor để không cho instantiate.
 */
public final class CourseSpecifications {

    private CourseSpecifications() {
    }

    /**
     * Chỉ lấy khoá học đã PUBLISHED (ẩn draft/pending/archived khỏi public).
     *
     * <p>Spec này KHÔNG bao giờ null - luôn áp dụng cho mọi query public.
     *
     * <p><b>Tại sao dùng toDbValue() thay vì truyền enum trực tiếp?</b><br>
     * Field {@code status} có cả {@code @Convert} lẫn {@code @ColumnTransformer(write="?::course_status")}.
     * Khi Hibernate 6 build Criteria predicate với enum object, nó gọi {@code .name()} → {@code "PUBLISHED"}
     * (uppercase), rồi SQL trở thành {@code status = 'PUBLISHED'::course_status}.
     * Postgres enum {@code course_status} lưu lowercase ({@code "published"}) nên ném lỗi:
     * {@code invalid input value for enum course_status: "PUBLISHED"}.
     * <br>
     * Giải pháp: truyền chuỗi {@code "published"} trực tiếp (qua {@code toDbValue()}).
     * Hibernate bind chuỗi literal → SQL: {@code status = 'published'::course_status} → khớp Postgres.
     */
    public static Specification<Course> onlyPublished() {
        return (root, query, cb) -> cb.equal(
                root.get("status"),
                CourseStatus.PUBLISHED.toDbValue()   // "published" — lowercase khớp Postgres enum
        );
    }

    /**
     * Filter theo slug danh mục (vd: "toan-hoc"). Join sang bảng categories.
     *
     * @return null nếu slug rỗng → bỏ qua filter
     */
    public static Specification<Course> matchCategorySlug(String categorySlug) {
        if (!StringUtils.hasText(categorySlug)) return null;
        return (root, query, cb) -> {
            // Join với Category để so sánh slug. Inner join vì NULL category sẽ
            // bị loại tự nhiên (course không có category không match filter này).
            return cb.equal(root.<Category>get("category").get("slug"), categorySlug);
        };
    }

    /**
     * Filter theo lớp - khoá học nào có {@code grade} trong mảng {@code grades}.
     *
     * <p>Postgres operator: {@code grades @> ARRAY[?]} (contains). Dùng
     * native function qua {@code cb.function} vì Criteria API chuẩn JPA
     * không có operator này.
     *
     * @param grade số lớp (6-9), null hoặc 0 = bỏ qua filter
     */
    public static Specification<Course> matchGrade(Integer grade) {
        if (grade == null || grade <= 0) return null;
        return (root, query, cb) -> {
            // SQL Postgres tương đương: WHERE 6 = ANY(grades)
            // Dùng function "array_position" để tận dụng index GIN sau này.
            // Cú pháp: array_position(grades, ?) IS NOT NULL
            Expression<Integer> pos = cb.function(
                    "array_position", Integer.class,
                    root.get("grades"), cb.literal(grade));
            return cb.isNotNull(pos);
        };
    }

    /**
     * Tìm kiếm fulltext đơn giản theo title/description (ILIKE).
     *
     * <p>Hiện dùng ILIKE %keyword% - phù hợp cho 10 nghìn rows. Khi scale
     * lớn cần đổi sang tsvector + GIN index ở DB.
     *
     * @param keyword chuỗi tìm kiếm (case-insensitive, partial match)
     * @return null nếu keyword rỗng
     */
    public static Specification<Course> matchKeyword(String keyword) {
        if (!StringUtils.hasText(keyword)) return null;
        // Lowercase + escape LIKE wildcards để tránh user inject % _ làm slow query
        String escaped = keyword.trim()
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_")
                .toLowerCase();
        String pattern = "%" + escaped + "%";

        return (root, query, cb) -> cb.or(
                cb.like(cb.lower(root.get("title")), pattern, '\\'),
                cb.like(cb.lower(root.get("description")), pattern, '\\')
        );
    }

    /**
     * Filter chỉ lấy khoá học featured (hiển thị trên trang chủ).
     */
    public static Specification<Course> onlyFeatured(Boolean featured) {
        if (featured == null || !featured) return null;
        return (root, query, cb) -> cb.isTrue(root.get("is_featured"));
    }
}

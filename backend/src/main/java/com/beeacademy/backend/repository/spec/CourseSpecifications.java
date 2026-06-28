package com.beeacademy.backend.repository.spec;

import com.beeacademy.backend.model.Category;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseStatus;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

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

    private static final String SEARCH_TRANSLATE_FROM =
            "áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩị" +
            "óòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ";
    private static final String SEARCH_TRANSLATE_TO =
            "aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiii" +
            "ooooooooooooooooouuuuuuuuuuuyyyyyd";
    private static final int MAX_SEARCH_TOKENS = 6;

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
                CourseStatus.PUBLISHED.toDbValue()
        );
    }

    /**
     * Filter theo slug danh mục (vd: "toan-hoc"). Join sang bảng categories.
     *
     * @return null nếu slug rỗng → bỏ qua filter
     */
    public static Specification<Course> matchCategorySlug(String categorySlug) {
        if (!StringUtils.hasText(categorySlug)) return null;
        return (root, query, cb) -> cb.equal(root.<Category>get("category").get("slug"), categorySlug);
    }

    /**
     * Filter theo lớp - khoá học nào có {@code grade} trong mảng {@code grades}.
     *
     * @param grade số lớp (6-9), null hoặc 0 = bỏ qua filter
     */
    public static Specification<Course> matchGrade(Integer grade) {
        if (grade == null || grade <= 0) return null;
        return (root, query, cb) -> matchGradePredicate(root, cb, grade);
    }

    /**
     * Tìm kiếm mềm theo nhiều trường:
     * title, description, slug, category, teacher.
     *
     * <p>Chuỗi tìm kiếm được:
     * <ul>
     *   <li>lowercase</li>
     *   <li>bỏ dấu tiếng Việt</li>
     *   <li>tách thành từng token theo khoảng trắng/ký tự đặc biệt</li>
     * </ul>
     *
     * <p>Mỗi token phải match ít nhất 1 trường, nên query như
     * {@code "toan co ban 8"} vẫn match được nếu từ khoá nằm rải ở title,
     * category và grade.
     */
    public static Specification<Course> matchKeyword(String keyword) {
        if (!StringUtils.hasText(keyword)) return null;

        List<String> tokens = tokenizeKeyword(keyword);
        if (tokens.isEmpty()) return null;

        return (root, query, cb) -> {
            var category = root.join("category", JoinType.LEFT);
            var teacher = root.join("teacher", JoinType.LEFT);

            Expression<String> normalizedTitle = normalizeForSearch(cb, root.get("title"));
            Expression<String> normalizedDescription = normalizeForSearch(cb, root.get("description"));
            Expression<String> normalizedSlug = normalizeForSearch(cb, root.get("slug"));
            Expression<String> normalizedCategoryName = normalizeForSearch(cb, category.get("name"));
            Expression<String> normalizedCategorySlug = normalizeForSearch(cb, category.get("slug"));
            Expression<String> normalizedTeacherName = normalizeForSearch(cb, teacher.get("fullName"));

            List<Predicate> tokenPredicates = new ArrayList<>(tokens.size());
            for (String token : tokens) {
                String pattern = "%" + escapeLikeToken(token) + "%";
                List<Predicate> fieldPredicates = new ArrayList<>();
                fieldPredicates.add(cb.like(normalizedTitle, pattern, '\\'));
                fieldPredicates.add(cb.like(normalizedCategoryName, pattern, '\\'));
                fieldPredicates.add(cb.like(normalizedCategorySlug, pattern, '\\'));

                if (!isSingleCharacterToken(token)) {
                    fieldPredicates.add(cb.like(normalizedDescription, pattern, '\\'));
                    fieldPredicates.add(cb.like(normalizedSlug, pattern, '\\'));
                    fieldPredicates.add(cb.like(normalizedTeacherName, pattern, '\\'));
                }

                Integer gradeToken = parseGradeToken(token);
                if (gradeToken != null) {
                    fieldPredicates.add(matchGradePredicate(root, cb, gradeToken));
                }

                tokenPredicates.add(cb.or(fieldPredicates.toArray(Predicate[]::new)));
            }

            return cb.and(tokenPredicates.toArray(Predicate[]::new));
        };
    }

    /**
     * Filter chỉ lấy khoá học featured (hiển thị trên trang chủ).
     */
    public static Specification<Course> onlyFeatured(Boolean featured) {
        if (featured == null || !featured) return null;
        return (root, query, cb) -> cb.isTrue(root.get("isFeatured"));
    }

    private static List<String> tokenizeKeyword(String keyword) {
        String normalized = Normalizer.normalize(keyword.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('đ', 'd')
                .replaceAll("[^a-z0-9]+", " ")
                .trim();

        if (!StringUtils.hasText(normalized)) return List.of();

        String[] parts = normalized.split("\\s+");
        List<String> tokens = new ArrayList<>(Math.min(parts.length, MAX_SEARCH_TOKENS));
        for (String part : parts) {
            if (!StringUtils.hasText(part)) continue;
            tokens.add(part);
            if (tokens.size() == MAX_SEARCH_TOKENS) break;
        }
        return tokens;
    }

    private static Expression<String> normalizeForSearch(CriteriaBuilder cb, Expression<String> field) {
        CriteriaBuilder.Coalesce<String> safeField = cb.coalesce();
        safeField.value(field);
        safeField.value("");
        Expression<String> lowered = cb.lower(safeField);
        return cb.function(
                "translate",
                String.class,
                lowered,
                cb.literal(SEARCH_TRANSLATE_FROM),
                cb.literal(SEARCH_TRANSLATE_TO)
        );
    }

    private static String escapeLikeToken(String token) {
        return token.replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
    }

    private static boolean isSingleCharacterToken(String token) {
        return token.length() == 1;
    }

    private static Integer parseGradeToken(String token) {
        try {
            int grade = Integer.parseInt(token);
            return grade >= 6 && grade <= 9 ? grade : null;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static Predicate matchGradePredicate(Root<Course> root, CriteriaBuilder cb, int grade) {
        Expression<Integer> pos = cb.function(
                "array_position", Integer.class,
                root.get("grades"), cb.literal(grade)
        );
        return cb.isNotNull(pos);
    }
}

package com.beeacademy.backend.repository.spec;

import com.beeacademy.backend.model.Category;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseReview;
import com.beeacademy.backend.model.CourseStatus;
import com.beeacademy.backend.model.Enrollment;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.CriteriaQuery;
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

    /** Lọc theo giá thực tế (sale price nếu có, ngược lại là giá gốc). */
    public static Specification<Course> matchEffectivePrice(Integer minPrice, Integer maxPrice) {
        if (minPrice == null && maxPrice == null) return null;
        return (root, query, cb) -> {
            Expression<Integer> effectivePrice = cb.<Integer>coalesce()
                    .value(root.get("salePriceVnd"))
                    .value(root.get("priceVnd"));
            List<Predicate> predicates = new ArrayList<>(2);
            if (minPrice != null && minPrice >= 0) {
                predicates.add(cb.greaterThanOrEqualTo(effectivePrice, minPrice));
            }
            if (maxPrice != null && maxPrice >= 0) {
                predicates.add(cb.lessThanOrEqualTo(effectivePrice, maxPrice));
            }
            return predicates.isEmpty() ? cb.conjunction()
                    : cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    /** Lọc khóa học có điểm đánh giá trung bình từ minRating trở lên. */
    public static Specification<Course> matchMinimumRating(Double minRating) {
        if (minRating == null || minRating <= 0) return null;
        return (root, query, cb) -> cb.greaterThanOrEqualTo(
                averageRating(query, cb, root), minRating);
    }

    /** Sắp xếp UC06 bằng subquery DB, không phụ thuộc @Formula của Hibernate. */
    public static Specification<Course> orderBySort(String sort) {
        return (root, query, cb) -> {
            if (isCountQuery(query)) return cb.conjunction();

            switch (sort) {
                case "price_asc" -> query.orderBy(cb.asc(effectivePrice(root, cb)));
                case "price_desc" -> query.orderBy(cb.desc(effectivePrice(root, cb)));
                case "rating", "rating_desc" -> query.orderBy(
                        cb.desc(averageRating(query, cb, root)),
                        cb.desc(root.get("createdAt")));
                case "best_selling", "bestselling" -> query.orderBy(
                        cb.desc(studentCount(query, cb, root)),
                        cb.desc(root.get("createdAt")));
                case "relevance", "newest", "createdAt" -> query.orderBy(
                        cb.desc(root.get("createdAt")));
                default -> query.orderBy(cb.desc(root.get("createdAt")));
            }
            return cb.conjunction();
        };
    }

    /**
     * Xếp kết quả phù hợp nhất lên trước khi có từ khóa tìm kiếm.
     * Điểm ưu tiên: tiêu đề > danh mục/giáo viên > mô tả/slug.
     */
    public static Specification<Course> orderByKeywordRelevance(String keyword) {
        if (!StringUtils.hasText(keyword)) return null;
        List<String> tokens = tokenizeKeyword(keyword);
        if (tokens.isEmpty()) return null;

        return (root, query, cb) -> {
            if (isCountQuery(query)) return cb.conjunction();

            var category = root.join("category", JoinType.LEFT);
            var teacher = root.join("teacher", JoinType.LEFT);
            Expression<String> title = normalizeForSearch(cb, root.get("title"));
            Expression<String> description = normalizeForSearch(cb, root.get("description"));
            Expression<String> slug = normalizeForSearch(cb, root.get("slug"));
            Expression<String> categoryName = normalizeForSearch(cb, category.get("name"));
            Expression<String> categorySlug = normalizeForSearch(cb, category.get("slug"));
            Expression<String> teacherName = normalizeForSearch(cb, teacher.get("fullName"));

            Expression<Integer> score = cb.literal(0);
            for (String token : tokens) {
                String pattern = "%" + escapeLikeToken(token) + "%";
                score = cb.sum(score, weightedMatch(cb, title, pattern, 6));
                score = cb.sum(score, weightedMatch(cb, categoryName, pattern, 4));
                score = cb.sum(score, weightedMatch(cb, categorySlug, pattern, 3));
                score = cb.sum(score, weightedMatch(cb, teacherName, pattern, 3));
                score = cb.sum(score, weightedMatch(cb, description, pattern, 2));
                score = cb.sum(score, weightedMatch(cb, slug, pattern, 1));
                Integer gradeToken = parseGradeToken(token);
                if (gradeToken != null) {
                    score = cb.sum(score, weightedPredicate(
                            cb, matchGradePredicate(root, cb, gradeToken), 4));
                }
            }
            query.orderBy(cb.desc(score), cb.desc(root.get("createdAt")));
            return cb.conjunction();
        };
    }

    private static Expression<Integer> weightedMatch(CriteriaBuilder cb,
                                                       Expression<String> field,
                                                       String pattern,
                                                       int weight) {
        return cb.<Integer>selectCase()
                .when(cb.like(field, pattern, '\\'), weight)
                .otherwise(0);
    }

    private static Expression<Integer> weightedPredicate(CriteriaBuilder cb,
                                                           Predicate predicate,
                                                           int weight) {
        return cb.<Integer>selectCase().when(predicate, weight).otherwise(0);
    }

    private static Expression<Integer> effectivePrice(Root<Course> root, CriteriaBuilder cb) {
        return cb.<Integer>coalesce()
                .value(root.get("salePriceVnd"))
                .value(root.get("priceVnd"));
    }

    private static Expression<Double> averageRating(CriteriaQuery<?> query,
                                                     CriteriaBuilder cb,
                                                     Root<Course> root) {
        var subquery = query.subquery(Double.class);
        var review = subquery.from(CourseReview.class);
        subquery.select(cb.avg(review.get("rating")));
        subquery.where(cb.equal(review.get("course").get("id"), root.get("id")));
        return cb.<Double>coalesce().value(subquery).value(0.0);
    }

    private static Expression<Long> studentCount(CriteriaQuery<?> query,
                                                  CriteriaBuilder cb,
                                                  Root<Course> root) {
        var subquery = query.subquery(Long.class);
        var enrollment = subquery.from(Enrollment.class);
        subquery.select(cb.count(enrollment));
        subquery.where(cb.equal(enrollment.get("courseId"), root.get("id")));
        return subquery;
    }

    private static boolean isCountQuery(CriteriaQuery<?> query) {
        Class<?> resultType = query.getResultType();
        return resultType == Long.class || resultType == long.class
                || resultType == Integer.class || resultType == int.class;
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

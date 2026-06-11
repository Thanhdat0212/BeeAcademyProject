package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import org.springframework.data.jpa.repository.Modifying;

import java.util.List;
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

    /**
     * Danh sách khóa học chờ Admin duyệt (PENDING_REVIEW).
     * countQuery riêng để tránh JOIN FETCH invalid trong COUNT query.
     */
    @Query(value = "SELECT c FROM Course c JOIN FETCH c.category JOIN FETCH c.teacher WHERE c.status = :status",
           countQuery = "SELECT COUNT(c) FROM Course c WHERE c.status = :status")
    Page<Course> findPendingReview(@Param("status") CourseStatus status, Pageable pageable);

    /**
     * Danh sách khoá học học sinh đã enroll, JOIN FETCH category + teacher.
     * Dùng JPQL subquery qua enrollment.courseId (UUID field, không phải JPA relation).
     * Sắp xếp theo createdAt DESC cho nhất quán với search results.
     */
    @EntityGraph(attributePaths = {"category", "teacher"})
    @Query("SELECT c FROM Course c WHERE c.id IN " +
           "(SELECT e.courseId FROM Enrollment e WHERE e.studentId = :studentId) " +
           "ORDER BY c.createdAt DESC")
    List<Course> findEnrolledByStudentId(@Param("studentId") UUID studentId);

    /**
     * Cập nhật denormalized counters sau khi thêm/xóa chapter hoặc lesson.
     * Gọi từ TeacherCourseService thay vì dùng trigger DB.
     */
    @Modifying
    @Query("UPDATE Course c SET c.totalChapters = :chapterCount, c.totalLessons = :lessonCount WHERE c.id = :courseId")
    void updateCounts(@Param("courseId") UUID courseId,
                      @Param("chapterCount") int chapterCount,
                      @Param("lessonCount") int lessonCount);
}

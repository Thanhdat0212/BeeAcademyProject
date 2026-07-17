package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.Enrollment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Truy vấn bảng {@code enrollments}.
 *
 * <p>Luồng sử dụng chính (Module 2 — xem video):
 * <ol>
 *   <li>User gọi {@code GET /api/courses/{id}}.</li>
 *   <li>{@code CourseController} lấy JWT → {@code AuthenticatedUser me}.</li>
 *   <li>{@code CourseService.canUserAccessAllVideos()} gọi
 *       {@link #existsByUserIdAndCourseId} để kiểm tra quyền.</li>
 *   <li>Nếu đã enroll → trả {@code videoUrl} đầy đủ; chưa → trả null.</li>
 * </ol>
 *
 * <p>Luồng sử dụng trong tương lai (Module 3 — thanh toán):
 * Sau khi VNPay/MoMo callback thành công, service tạo {@link Enrollment}
 * mới qua {@code save()} rồi gọi lại endpoint course để lấy video URL.
 */
@Repository
public interface EnrollmentRepository extends JpaRepository<Enrollment, UUID> {

    /**
     * Kiểm tra học sinh đã mua khoá học chưa. Không cần load entity —
     * Spring Data tự sinh {@code SELECT COUNT(*) > 0} thay vì {@code SELECT *}.
     *
     * @param userId   UUID của học sinh (từ JWT claim)
     * @param courseId UUID của khoá học
     * @return true nếu đã có enrollment, false nếu chưa mua
     */
    /** Kiểm tra học sinh đã enroll khóa học chưa. Cột DB: student_id */
    boolean existsByStudentIdAndCourseId(UUID studentId, UUID courseId);

    /** Tất cả khóa học đã enroll của một học sinh. */
    List<Enrollment> findByStudentId(UUID studentId);

    /** Enrollment mới mua trước để làm fallback khi khóa chưa có hoạt động học. */
    List<Enrollment> findByStudentIdOrderByEnrolledAtDesc(UUID studentId);

    Optional<Enrollment> findByStudentIdAndCourseId(UUID studentId, UUID courseId);

    /** Tất cả enrollment thuộc một nhóm khóa học. */
    List<Enrollment> findByCourseIdIn(List<UUID> courseIds);

    /** Đếm số khóa học đã enroll của học sinh. */
    int countByStudentId(UUID studentId);

    @Query("SELECT e.courseId, COUNT(e) FROM Enrollment e WHERE e.courseId IN :courseIds GROUP BY e.courseId")
    List<Object[]> countGroupedByCourseId(@Param("courseIds") List<UUID> courseIds);

    @Query("SELECT COUNT(DISTINCT e.studentId) FROM Enrollment e WHERE e.courseId IN :courseIds")
    long countUniqueStudentsByCourseIds(@Param("courseIds") List<UUID> courseIds);

    /** Đếm số học sinh đã mua/ghi danh một khóa học. */
    int countByCourseId(UUID courseId);

    // ── Time-series lượt đăng ký theo tháng (Reports — UC37) ────────────

    /**
     * Lượt đăng ký theo tháng của một nhóm khóa học (dùng cho GV). Mỗi row:
     * [String month("yyyy-MM"), Long count]. {@code to_char} của Postgres
     * bucket theo {@code enrolled_at}; GROUP BY 1 = theo cột output đầu tiên.
     */
    @Query(value = "SELECT to_char(enrolled_at, 'YYYY-MM') AS m, COUNT(*) " +
                   "FROM enrollments WHERE course_id IN :courseIds " +
                   "GROUP BY 1 ORDER BY 1", nativeQuery = true)
    List<Object[]> enrollmentTrendByCourseIds(@Param("courseIds") List<UUID> courseIds);

    /** Lượt đăng ký toàn hệ thống theo tháng (Admin) — cùng shape row. */
    @Query(value = "SELECT to_char(enrolled_at, 'YYYY-MM') AS m, COUNT(*) " +
                   "FROM enrollments GROUP BY 1 ORDER BY 1", nativeQuery = true)
    List<Object[]> enrollmentTrendAll();
}

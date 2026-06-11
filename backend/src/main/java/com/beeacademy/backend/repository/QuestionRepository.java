package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.Question;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Truy vấn bảng {@code questions}.
 *
 * <p>Hai nhóm query chính:
 * <ul>
 *   <li>Phía giáo viên: CRUD câu hỏi + thống kê ngân hàng.</li>
 *   <li>Phía quiz service: lấy pool câu theo chapter + difficulty để randomize.</li>
 * </ul>
 */
@Repository
public interface QuestionRepository extends JpaRepository<Question, UUID> {

    // ─── Teacher side ────────────────────────────────────────────────────────
    //
    // Các query dưới đây JOIN FETCH category và chapter để tránh N+1 khi
    // fromEntity() đọc category.getName() và chapter.getTitle().
    //
    // Lưu ý về countQuery: Spring Data JPA không thể tự suy ra COUNT query
    // đúng khi có JOIN FETCH → phải khai báo tường minh. COUNT query không
    // cần JOIN FETCH vì không access các field đó.
    //
    // choices KHÔNG JOIN FETCH ở đây vì đây là paginated query — Hibernate sẽ
    // cảnh báo HHH90003004 và load toàn bộ in-memory thay vì dùng LIMIT/OFFSET.
    // Thay vào đó dùng @BatchSize(50) trên field choices trong Question entity.

    @Query(value = "SELECT q FROM Question q " +
                   "LEFT JOIN FETCH q.category LEFT JOIN FETCH q.chapter " +
                   "WHERE q.teacher.id = :teacherId AND q.chapter.id = :chapterId " +
                   "AND q.difficulty = :difficulty AND q.status = :status",
           countQuery = "SELECT COUNT(q) FROM Question q " +
                        "WHERE q.teacher.id = :teacherId AND q.chapter.id = :chapterId " +
                        "AND q.difficulty = :difficulty AND q.status = :status")
    Page<Question> findByTeacherIdAndChapterIdAndDifficultyAndStatus(
            @Param("teacherId") UUID teacherId,
            @Param("chapterId") UUID chapterId,
            @Param("difficulty") String difficulty,
            @Param("status") String status,
            Pageable pageable);

    @Query(value = "SELECT q FROM Question q " +
                   "LEFT JOIN FETCH q.category LEFT JOIN FETCH q.chapter " +
                   "WHERE q.teacher.id = :teacherId AND q.chapter.id = :chapterId " +
                   "AND q.status = :status",
           countQuery = "SELECT COUNT(q) FROM Question q " +
                        "WHERE q.teacher.id = :teacherId AND q.chapter.id = :chapterId " +
                        "AND q.status = :status")
    Page<Question> findByTeacherIdAndChapterIdAndStatus(
            @Param("teacherId") UUID teacherId,
            @Param("chapterId") UUID chapterId,
            @Param("status") String status,
            Pageable pageable);

    @Query(value = "SELECT q FROM Question q " +
                   "LEFT JOIN FETCH q.category LEFT JOIN FETCH q.chapter " +
                   "WHERE q.teacher.id = :teacherId AND q.difficulty = :difficulty " +
                   "AND q.status = :status",
           countQuery = "SELECT COUNT(q) FROM Question q " +
                        "WHERE q.teacher.id = :teacherId AND q.difficulty = :difficulty " +
                        "AND q.status = :status")
    Page<Question> findByTeacherIdAndDifficultyAndStatus(
            @Param("teacherId") UUID teacherId,
            @Param("difficulty") String difficulty,
            @Param("status") String status,
            Pageable pageable);

    @Query(value = "SELECT q FROM Question q " +
                   "LEFT JOIN FETCH q.category LEFT JOIN FETCH q.chapter " +
                   "WHERE q.teacher.id = :teacherId AND q.status = :status",
           countQuery = "SELECT COUNT(q) FROM Question q " +
                        "WHERE q.teacher.id = :teacherId AND q.status = :status")
    Page<Question> findByTeacherIdAndStatus(
            @Param("teacherId") UUID teacherId,
            @Param("status") String status,
            Pageable pageable);

    // ─── Quiz side ───────────────────────────────────────────────────────────

    /**
     * Lấy pool câu theo chapter + difficulty + status=active để randomize.
     * Không phân trang — lấy hết rồi shuffle trong Java.
     */
    @Query("SELECT q FROM Question q WHERE q.chapter.id = :chapterId " +
           "AND q.difficulty = :difficulty AND q.status = 'active'")
    List<Question> findActiveByChapterAndDifficulty(
            @Param("chapterId") UUID chapterId,
            @Param("difficulty") String difficulty);

    // ─── Stats ───────────────────────────────────────────────────────────────

    /**
     * Đếm số câu active theo chapter và difficulty.
     * Dùng để hiển thị "Ngân hàng có X câu Dễ / Y câu Trung bình / Z câu Khó".
     */
    @Query("SELECT q.difficulty, COUNT(q) FROM Question q " +
           "WHERE q.chapter.id = :chapterId AND q.status = 'active' " +
           "GROUP BY q.difficulty")
    List<Object[]> countActiveByDifficultyForChapter(@Param("chapterId") UUID chapterId);

    // ─── Batch update usageCount ─────────────────────────────────────────────

    /**
     * Tăng usage_count cho nhiều câu cùng lúc sau khi student nộp bài.
     * Dùng batch UPDATE thay vì N lần save() riêng lẻ.
     */
    @Modifying
    @Query("UPDATE Question q SET q.usageCount = q.usageCount + 1 WHERE q.id IN :ids")
    void incrementUsageCount(@Param("ids") List<UUID> ids);
}

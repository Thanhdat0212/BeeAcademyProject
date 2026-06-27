package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.QuizAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Truy vấn bảng {@code quiz_attempts}.
 *
 * <p>Hai luồng sử dụng:
 * <ul>
 *   <li>Student: đếm số lần đã làm để kiểm tra maxAttempts.</li>
 *   <li>Teacher: thống kê điểm số cho từng quiz config.</li>
 * </ul>
 */
@Repository
public interface QuizAttemptRepository extends JpaRepository<QuizAttempt, UUID> {

    /** Đếm số lần một student đã làm một quiz config (gồm cả chưa nộp). */
    int countByStudentIdAndQuizConfigId(UUID studentId, UUID quizConfigId);

    /**
     * Đếm số lần đã NỘP (submittedAt != null) — dùng khi kiểm tra maxAttempts.
     * Attempt chưa nộp (vd: student tắt browser giữa chừng) KHÔNG tính vào giới hạn,
     * tránh student mất lượt do lỗi kỹ thuật ngoài ý muốn.
     */
    int countByStudentIdAndQuizConfigIdAndSubmittedAtIsNotNull(UUID studentId, UUID quizConfigId);

    boolean existsByStudentIdAndQuizConfigIdAndPassedTrue(UUID studentId, UUID quizConfigId);

    /** Lịch sử làm bài của student cho một config, mới nhất lên đầu. */
    List<QuizAttempt> findByStudentIdAndQuizConfigIdOrderByAttemptNumberDesc(
            UUID studentId, UUID quizConfigId);

    /** Tất cả attempts của một quiz config (để thống kê cho GV). */
    List<QuizAttempt> findByQuizConfigIdAndSubmittedAtIsNotNull(UUID quizConfigId);

    /** Tìm attempt theo id + student (verify ownership trước khi submit). */
    Optional<QuizAttempt> findByIdAndStudentId(UUID id, UUID studentId);

    /** Lần làm quiz gần nhất đã nộp của một học sinh (cho Parent overview). */
    Optional<QuizAttempt> findFirstByStudentIdAndSubmittedAtIsNotNullOrderBySubmittedAtDesc(UUID studentId);

    @Query("""
           SELECT attempt
           FROM QuizAttempt attempt
           JOIN FETCH attempt.quizConfig config
           JOIN FETCH config.chapter chapter
           JOIN FETCH chapter.course course
           WHERE attempt.student.id = :studentId
             AND course.id IN :courseIds
             AND attempt.submittedAt IS NOT NULL
           ORDER BY attempt.submittedAt DESC
           """)
    List<QuizAttempt> findSubmittedByStudentAndCourseIds(
            @Param("studentId") UUID studentId,
            @Param("courseIds") Collection<UUID> courseIds);
}

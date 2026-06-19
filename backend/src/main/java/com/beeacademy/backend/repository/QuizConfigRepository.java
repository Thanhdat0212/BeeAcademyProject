package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.QuizConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Truy vấn bảng {@code quiz_configs}.
 * UNIQUE constraint chapter_id đảm bảo findByChapterId trả tối đa 1 kết quả.
 */
@Repository
public interface QuizConfigRepository extends JpaRepository<QuizConfig, UUID> {

    Optional<QuizConfig> findByChapterId(UUID chapterId);

    List<QuizConfig> findByChapterIdIn(Collection<UUID> chapterIds);

    boolean existsByChapterId(UUID chapterId);

    /**
     * Trả về tập chapterId đã có quiz config trong danh sách đầu vào.
     *
     * <p>Dùng để đánh dấu {@code hasQuizConfig} trên từng chương khi build
     * {@code CourseDetailResponse} — tránh N+1 query cho mỗi chapter riêng lẻ.
     *
     * @param chapterIds tập chapterId cần kiểm tra
     * @return subset của chapterIds đã có quiz config
     */
    @Query("SELECT q.chapter.id FROM QuizConfig q WHERE q.chapter.id IN :chapterIds")
    Set<UUID> findConfiguredChapterIds(@Param("chapterIds") Collection<UUID> chapterIds);
}

package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Truy vấn bảng {@code categories}.
 *
 * <p>Override mặc định {@code findAll()} bằng method có sort sẵn theo
 * {@code display_order} - để controller không cần truyền Sort thủ công.
 */
@Repository
public interface CategoryRepository extends JpaRepository<Category, UUID> {

    /** Lookup category theo slug (vd: "toan-hoc") - dùng để filter URL-friendly. */
    Optional<Category> findBySlug(String slug);

    /** Lấy tất cả, sắp xếp theo display_order ASC cho UI. */
    List<Category> findAllByOrderByDisplayOrderAsc();
}

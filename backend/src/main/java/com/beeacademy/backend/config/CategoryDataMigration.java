package com.beeacademy.backend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Đồng bộ các danh mục môn học bắt buộc mà mọi luồng khóa học/câu hỏi cùng dùng.
 *
 * <p>Các file trong {@code backend/db/migrations} hiện không được Spring Boot tự
 * chạy, vì vậy migration tương thích này bảo đảm môi trường đang triển khai cũng
 * nhận được môn mới sau khi backend khởi động lại. Câu lệnh upsert là idempotent.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CategoryDataMigration implements ApplicationRunner {

    static final String TECHNOLOGY_SLUG = "cong-nghe";
    static final String TECHNOLOGY_NAME = "Công nghệ";

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        Boolean hasCategoriesTable = jdbcTemplate.queryForObject("""
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'categories'
                )
                """, Boolean.class);

        if (!Boolean.TRUE.equals(hasCategoriesTable)) {
            return;
        }

        int affectedRows = jdbcTemplate.update("""
                INSERT INTO public.categories (id, slug, name, icon, display_order)
                VALUES (
                    CAST('a8a5c1ad-52e4-4f60-9b51-47fabed9ae41' AS UUID),
                    'cong-nghe',
                    'Công nghệ',
                    '⚙️',
                    COALESCE((SELECT MAX(display_order) + 1 FROM public.categories), 1)
                )
                ON CONFLICT (slug) DO UPDATE
                SET name = EXCLUDED.name,
                    icon = EXCLUDED.icon
                """);

        log.info("Category data migration completed: slug={}, affectedRows={}",
                TECHNOLOGY_SLUG, affectedRows);
    }
}


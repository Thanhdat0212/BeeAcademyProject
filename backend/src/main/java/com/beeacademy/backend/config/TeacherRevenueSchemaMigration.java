package com.beeacademy.backend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Idempotent compatibility migration for teacher revenue/payout schema.
 *
 * <p>The project keeps Hibernate ddl-auto disabled and SQL files under
 * {@code backend/db/migrations} are not executed automatically by Spring Boot.
 * This keeps existing dev/Supabase databases compatible with the current
 * {@code PayoutPeriod} entity.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TeacherRevenueSchemaMigration implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        Boolean hasPayoutPeriodsTable = jdbcTemplate.queryForObject("""
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_name = 'payout_periods'
                )
                """, Boolean.class);

        if (!Boolean.TRUE.equals(hasPayoutPeriodsTable)) {
            return;
        }

        ensureUncAttachmentUrlColumn();
        ensureTeacherStatusMonthIndex();
    }

    private void ensureUncAttachmentUrlColumn() {
        Boolean hasColumn = jdbcTemplate.queryForObject("""
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'payout_periods'
                      AND column_name = 'unc_attachment_url'
                )
                """, Boolean.class);

        if (Boolean.TRUE.equals(hasColumn)) {
            return;
        }

        log.info("Applying compatibility migration: add payout_periods.unc_attachment_url");
        jdbcTemplate.execute("""
                ALTER TABLE public.payout_periods
                ADD COLUMN unc_attachment_url VARCHAR(1000)
                """);
    }

    private void ensureTeacherStatusMonthIndex() {
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_payout_periods_teacher_status_month
                ON public.payout_periods (teacher_id, status, month_year DESC)
                """);
    }
}

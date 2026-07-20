package com.beeacademy.backend.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ProfileSchemaMigration implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        Boolean hasProfilesTable = jdbcTemplate.queryForObject("""
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'profiles'
                )
                """, Boolean.class);

        if (!Boolean.TRUE.equals(hasProfilesTable)) {
            return;
        }

        jdbcTemplate.execute("""
                ALTER TABLE public.profiles
                ADD COLUMN IF NOT EXISTS teacher_approval_status VARCHAR(24) NOT NULL DEFAULT 'approved'
                """);
        jdbcTemplate.execute("""
                ALTER TABLE public.profiles
                ADD COLUMN IF NOT EXISTS date_of_birth DATE,
                ADD COLUMN IF NOT EXISTS parent_privacy_enabled BOOLEAN NOT NULL DEFAULT TRUE
                """);
        jdbcTemplate.execute("""
                ALTER TABLE public.profiles
                DROP CONSTRAINT IF EXISTS chk_profiles_teacher_approval_status
                """);
        jdbcTemplate.execute("""
                ALTER TABLE public.profiles
                ADD CONSTRAINT chk_profiles_teacher_approval_status
                CHECK (teacher_approval_status IN ('pending', 'approved', 'rejected'))
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_profiles_teacher_approval_status
                ON public.profiles (role, teacher_approval_status)
                WHERE role = 'teacher'
                """);
    }
}

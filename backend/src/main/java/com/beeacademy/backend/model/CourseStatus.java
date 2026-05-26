package com.beeacademy.backend.model;

/**
 * Trạng thái vòng đời khoá học, ánh xạ 1-1 với enum Postgres
 * {@code course_status}.
 *
 * <p>Verified Supabase: {@code {draft, pending_review, approved, rejected,
 * needs_revision, published, archived}}.
 *
 * <p>Luồng nghiệp vụ:
 * <pre>
 *   draft → pending_review → approved → published → archived
 *                          ↘ rejected
 *                          ↘ needs_revision → (chỉnh sửa) → pending_review
 * </pre>
 */
public enum CourseStatus {

    DRAFT,
    PENDING_REVIEW,
    APPROVED,
    REJECTED,
    NEEDS_REVISION,
    PUBLISHED,
    ARCHIVED;

    /** Chỉ khoá học PUBLISHED mới hiển thị công khai cho học sinh. */
    public boolean isPubliclyVisible() {
        return this == PUBLISHED;
    }

    /** Tên viết thường để match enum Postgres. */
    public String toDbValue() {
        return name().toLowerCase();
    }
}

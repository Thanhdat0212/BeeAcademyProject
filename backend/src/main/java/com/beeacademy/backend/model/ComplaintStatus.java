package com.beeacademy.backend.model;

/**
 * Trạng thái xử lý một khiếu nại (UC11 / UC38).
 *
 * <p>Lưu dưới dạng VARCHAR thường ({@code pending}, ...) trên Postgres — khớp
 * với CHECK constraint trong {@code supabase_migration_complaints.sql} và với
 * giá trị frontend gửi lên. Map qua {@link ComplaintStatusConverter}.
 */
public enum ComplaintStatus {
    PENDING("pending"),
    IN_PROGRESS("in_progress"),
    RESOLVED("resolved"),
    REJECTED("rejected");

    private final String dbValue;

    ComplaintStatus(String dbValue) {
        this.dbValue = dbValue;
    }

    public String toDbValue() {
        return dbValue;
    }

    /** Thread đã đóng (không cho gửi thêm tin) khi đã giải quyết hoặc bị từ chối. */
    public boolean isClosed() {
        return this == RESOLVED || this == REJECTED;
    }

    public static ComplaintStatus fromDbValue(String value) {
        if (value == null) return PENDING;
        for (ComplaintStatus status : values()) {
            if (status.dbValue.equalsIgnoreCase(value)) return status;
        }
        throw new IllegalArgumentException("Unknown complaint status: " + value);
    }
}

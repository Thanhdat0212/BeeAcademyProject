package com.beeacademy.backend.dto.response;

/**
 * Một trường bị thay đổi trong TK ngân hàng của giáo viên.
 *
 * <p>Record này được dùng cho HAI mục đích và tên component phải giữ nguyên:
 * <ul>
 *   <li>Serialize vào cột JSONB {@code teacher_bank_audit_log.changes} —
 *       các entry cũ trong DB đã dùng đúng 3 key {@code field/oldValue/newValue}.</li>
 *   <li>Trả về frontend ở màn xác nhận OTP để GV soi lại thay đổi trước khi nhập mã.</li>
 * </ul>
 *
 * <p>Đổi tên component = vỡ cả audit log cũ lẫn {@code parseChanges()} bên frontend.
 */
public record BankFieldChange(
        String field,
        String oldValue,
        String newValue
) {
}

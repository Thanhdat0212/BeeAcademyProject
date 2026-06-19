package com.beeacademy.backend.exception;

import com.beeacademy.backend.dto.response.ErrorResponse;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;

import java.util.List;

/**
 * Bộ xử lý exception tập trung cho toàn bộ controller.
 *
 * <p>{@code @RestControllerAdvice} = {@code @ControllerAdvice} +
 * {@code @ResponseBody} → mọi method handler trong class này sẽ áp dụng cho
 * mọi controller, và return value tự serialize thành JSON.
 *
 * <p>Mục tiêu: KHÔNG có {@code try/catch} nào trong controller. Service ném
 * exception → handler này bắt và trả {@link ErrorResponse} đồng nhất.
 *
 * <p>Ưu tiên handler chuyên biệt (specific) trước handler tổng quát:
 * <ol>
 *   <li>{@link BusinessException} - lỗi nghiệp vụ (có code + status do
 *       service quyết định)</li>
 *   <li>{@link MethodArgumentNotValidException} - lỗi @Valid trên DTO</li>
 *   <li>{@link ConstraintViolationException} - lỗi @Validated trên path/query param</li>
 *   <li>{@link AccessDeniedException} - lỗi @PreAuthorize hoặc Spring Security</li>
 *   <li>{@link Exception} - catch-all cho lỗi không mong muốn (500)</li>
 * </ol>
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * Bắt mọi lỗi nghiệp vụ mà service chủ động ném.
     *
     * <p>Lấy HTTP status, code, message từ chính exception → service kiểm
     * soát hoàn toàn cách response trả ra.
     */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusinessException(BusinessException ex) {
        log.warn("Business error [{}]: {}", ex.getCode(), ex.getMessage());
        return ResponseEntity
                .status(ex.getStatus())
                .body(ErrorResponse.of(ex.getCode(), ex.getMessage()));
    }

    /**
     * Bắt lỗi validation từ {@code @Valid @RequestBody DTO}.
     *
     * <p>Spring tự thu thập tất cả constraint vi phạm vào
     * {@code BindingResult}. Ta map thành list FieldError để frontend
     * highlight đúng field bị lỗi.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        // Mỗi field error gồm: tên field + message constraint (vd: "Email không hợp lệ")
        List<ErrorResponse.FieldError> fieldErrors = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(fe -> new ErrorResponse.FieldError(fe.getField(), fe.getDefaultMessage()))
                .toList();

        log.warn("Validation failed: {}", fieldErrors);
        return ResponseEntity
                .badRequest()
                .body(ErrorResponse.ofValidation("Dữ liệu không hợp lệ", fieldErrors));
    }

    /**
     * Bắt lỗi validation từ {@code @Validated} trên path / query / request param.
     *
     * <p>Khác {@link MethodArgumentNotValidException} ở chỗ áp dụng cho
     * primitive param chứ không phải DTO.
     */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolation(ConstraintViolationException ex) {
        log.warn("Constraint violation: {}", ex.getMessage());
        return ResponseEntity
                .badRequest()
                .body(ErrorResponse.of("VALIDATION_FAILED", ex.getMessage()));
    }

    /**
     * Bắt lỗi {@code @PreAuthorize} fail hoặc Spring Security từ chối.
     *
     * <p>Trả 403 Forbidden - user đã login nhưng không đủ quyền.
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex) {
        log.warn("Access denied: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.FORBIDDEN)
                .body(ErrorResponse.of("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này"));
    }

    /**
     * Bắt lỗi không có authentication (token thiếu/sai khi gọi endpoint protected).
     */
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ErrorResponse> handleAuthentication(AuthenticationException ex) {
        log.warn("Authentication failed: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.UNAUTHORIZED)
                .body(ErrorResponse.of("UNAUTHORIZED", "Bạn cần đăng nhập để thực hiện thao tác này"));
    }

    /**
     * Client đóng kết nối trước khi server kịp gửi xong response (ví dụ: user
     * navigate đi trong khi response đang stream về, hoặc request timeout phía
     * browser). Đây là hành vi bình thường — không cần log ERROR.
     *
     * <p>Spring bọc {@code ClientAbortException} (Tomcat) thành
     * {@code AsyncRequestNotUsableException}. Không trả response ở đây vì
     * socket đã đóng — Spring sẽ bỏ qua return value khi connection đã abort.
     */
    @ExceptionHandler(AsyncRequestNotUsableException.class)
    public void handleClientAbort(AsyncRequestNotUsableException ex) {
        // WARN thay vì ERROR — client disconnect là expected, không phải bug server
        log.warn("Client đã đóng kết nối trước khi nhận xong response ({})",
                ex.getCause() != null ? ex.getCause().getMessage() : ex.getMessage());
    }

    /**
     * Bắt lỗi vi phạm state transition nghiệp vụ mà model chủ động ném
     * (vd: nộp duyệt khóa học khi đang ở trạng thái không cho phép).
     *
     * <p>Đây là lỗi "người dùng làm sai theo luật nghiệp vụ", không phải bug
     * server → trả 400 Bad Request với message rõ ràng thay vì 500.
     */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> handleIllegalState(IllegalStateException ex) {
        log.warn("Illegal state transition: {}", ex.getMessage());
        return ResponseEntity
                .badRequest()
                .body(ErrorResponse.of("INVALID_STATE", ex.getMessage()));
    }

    /**
     * Catch-all cho mọi lỗi KHÔNG MONG MUỐN (NullPointer, DB exception,...).
     *
     * <p>KHÔNG để stack trace lộ ra client - chỉ trả message chung chung,
     * log đầy đủ ở server cho dev debug.
     *
     * <p>Đây là lưới an toàn cuối - mọi exception lọt qua các handler trên
     * sẽ rơi vào đây, trả về 500 Internal Server Error.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnknown(Exception ex) {
        log.error("Unexpected error", ex);
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse.of("INTERNAL_ERROR", "Đã xảy ra lỗi hệ thống, vui lòng thử lại sau"));
    }
}

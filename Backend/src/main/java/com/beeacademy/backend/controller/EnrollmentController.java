package com.beeacademy.backend.controller;

import com.beeacademy.backend.dto.response.ApiResponse;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.beeacademy.backend.security.CurrentUser;
import com.beeacademy.backend.service.EnrollmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Endpoint ghi danh khóa học cho học sinh.
 *
 * <p>Trong giai đoạn phát triển hiện tại (mock checkout), endpoint này được gọi
 * ngay sau khi frontend hoàn tất thanh toán giả lập. Khi tích hợp VNPay/MoMo thật,
 * endpoint sẽ được bảo vệ thêm bằng cách verify payment trước khi ghi danh.
 *
 * <p>Yêu cầu: người dùng phải đăng nhập (JWT hợp lệ).
 * Bất kỳ role nào cũng có thể gọi (student, teacher, admin).
 */
@RestController
@RequestMapping("/api/courses")
@RequiredArgsConstructor
public class EnrollmentController {

    private final EnrollmentService enrollmentService;

    /**
     * POST /api/courses/{courseId}/enroll
     *
     * <p>Ghi danh học sinh vào khóa học. Idempotent: gọi nhiều lần an toàn.
     * Sau khi gọi thành công, GET /api/courses/{courseId} sẽ trả về
     * {@code enrolled=true} và video URLs đầy đủ.
     *
     * @param courseId UUID khóa học cần ghi danh
     */
    @PostMapping("/{courseId}/enroll")
    public ApiResponse<Void> enroll(@PathVariable UUID courseId) {
        AuthenticatedUser me = CurrentUser.required();
        enrollmentService.enroll(me.userId(), courseId);
        return ApiResponse.ok(null, "Ghi danh thành công");
    }
}

package com.beeacademy.backend.service;

import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseStatus;
import com.beeacademy.backend.model.Enrollment;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.EnrollmentRepository;
import org.springframework.http.HttpStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Nghiệp vụ ghi danh khóa học cho học sinh.
 *
 * <p>Giai đoạn hiện tại: ghi danh được kích hoạt sau khi mock checkout thành công.
 * Khi tích hợp VNPay/MoMo thật, service này sẽ được gọi sau khi payment callback
 * xác nhận giao dịch thành công.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EnrollmentService {

    private final EnrollmentRepository enrollmentRepository;
    private final CourseRepository     courseRepository;
    private final TeacherRevenueService teacherRevenueService;

    /**
     * Ghi danh học sinh vào khóa học.
     *
     * <p>Idempotent: gọi nhiều lần với cùng (studentId, courseId) an toàn —
     * chỉ tạo bản ghi mới nếu chưa tồn tại.
     *
     * @param studentId UUID học sinh (lấy từ JWT)
     * @param courseId  UUID khóa học cần ghi danh
     * @throws ResourceNotFoundException nếu khóa học không tồn tại
     */
    @Transactional
    public void enroll(UUID studentId, UUID courseId) {
        // Load course để check cả tồn tại lẫn trạng thái
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course", courseId));

        // Chỉ cho phép ghi danh khóa học đã được phát hành (PUBLISHED).
        // Ngăn student enroll vào khóa DRAFT / đang chờ duyệt / bị từ chối.
        if (course.getStatus() != CourseStatus.PUBLISHED) {
            throw new BusinessException("COURSE_NOT_AVAILABLE",
                    "Khóa học chưa được phát hành, không thể ghi danh.",
                    HttpStatus.BAD_REQUEST);
        }

        // Idempotent: bỏ qua nếu đã ghi danh rồi
        if (enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId)) {
            log.debug("Student {} đã ghi danh khóa học {}, bỏ qua", studentId, courseId);
            return;
        }

        Enrollment enrollment = Enrollment.create(studentId, courseId);
        enrollmentRepository.save(enrollment);
        teacherRevenueService.recordEnrollmentRevenue(studentId, course);
        log.info("Đã ghi danh student {} vào khóa học {}", studentId, courseId);
    }

    /**
     * Kiểm tra học sinh đã ghi danh khóa học chưa.
     *
     * @return true nếu đã ghi danh
     */
    @Transactional(readOnly = true)
    public boolean isEnrolled(UUID studentId, UUID courseId) {
        return enrollmentRepository.existsByStudentIdAndCourseId(studentId, courseId);
    }
}

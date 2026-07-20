package com.beeacademy.backend.service;

import com.beeacademy.backend.client.SupabaseStorageClient;
import com.beeacademy.backend.dto.response.AdminDocumentUrlResponse;
import com.beeacademy.backend.dto.response.ApprovalHistoryResponse;
import com.beeacademy.backend.dto.response.PendingCourseResponse;
import com.beeacademy.backend.dto.response.PageResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.ApprovalHistory;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.CourseDocument;
import com.beeacademy.backend.model.CourseStatus;
import com.beeacademy.backend.model.CourseVersion;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.repository.ApprovalHistoryRepository;
import com.beeacademy.backend.repository.CourseDocumentRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.CourseVersionRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Nghiệp vụ duyệt khóa học (Admin Portal — UC36).
 *
 * <p>Ba hành động Admin có thể thực hiện:
 * <ul>
 *   <li>{@link #approve}   — Duyệt, auto-publish.</li>
 *   <li>{@link #reject}    — Từ chối (cần comment).</li>
 *   <li>{@link #revise}    — Yêu cầu GV sửa lại (cần comment).</li>
 * </ul>
 *
 * <p>Mỗi hành động ghi vào {@code course_approval_history} và gửi email
 * thông báo cho GV.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ApprovalService {

    /** Bucket private mặc định chứa tài liệu bài học (xem ContentUploadService). */
    private static final String DOCUMENT_BUCKET = "course-documents";

    /** TTL signed URL xem thử tài liệu — admin mở ngay sau khi bấm nên 10 phút là đủ. */
    private static final int PREVIEW_URL_TTL_SECONDS = 600;

    private final CourseRepository          courseRepository;
    private final ProfileRepository         profileRepository;
    private final CourseVersionRepository   courseVersionRepository;
    private final ApprovalHistoryRepository historyRepository;
    private final UserNotificationService   notificationService;
    private final CourseDocumentRepository  documentRepository;
    private final SupabaseStorageClient     storageClient;

    // ========================================================================
    // Admin views
    // ========================================================================

    /** Danh sách khóa học đang chờ duyệt (PENDING_REVIEW), sắp xếp cũ trước. */
    @Transactional(readOnly = true)
    public PageResponse<PendingCourseResponse> getPendingCourses(Pageable pageable) {
        Page<Course> page = courseRepository.findPendingReview(CourseStatus.PENDING_REVIEW, pageable);
        return PageResponse.of(page, PendingCourseResponse::fromEntity);
    }

    /** Lịch sử duyệt của một khóa học (timeline). */
    @Transactional(readOnly = true)
    public List<ApprovalHistoryResponse> getHistory(UUID courseId) {
        return historyRepository.findByCourseIdOrderByCreatedAtAsc(courseId)
                .stream().map(ApprovalHistoryResponse::fromEntity).toList();
    }

    /**
     * URL xem thử tài liệu bài học cho Admin (UC36) — không watermark, không one-time token.
     *
     * <p>Cố ý KHÔNG kiểm tra trạng thái PENDING_REVIEW: admin còn cần xem nội dung
     * khi xử lý khiếu nại của khóa đã publish (UC38).
     */
    @Transactional(readOnly = true)
    public AdminDocumentUrlResponse getDocumentPreviewUrl(UUID courseId, UUID documentId) {
        CourseDocument document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("CourseDocument", documentId));

        // Chống lộ chéo: document phải thuộc đúng course trên URL
        if (!document.getLesson().getChapter().getCourse().getId().equals(courseId)) {
            throw new ResourceNotFoundException("CourseDocument", documentId);
        }

        String path = document.getStoragePath();
        if (path != null && !path.isBlank()) {
            // Bản ghi legacy có thể còn nằm ở bucket cũ "course-docs" — sign theo bucket trong row
            String bucket = (document.getStorageBucket() == null || document.getStorageBucket().isBlank())
                    ? DOCUMENT_BUCKET : document.getStorageBucket();
            String url = storageClient.generateSignedUrl(bucket, path, PREVIEW_URL_TTL_SECONDS);
            return new AdminDocumentUrlResponse(url, Instant.now().plusSeconds(PREVIEW_URL_TTL_SECONDS));
        }

        if (document.getFileUrl() != null && !document.getFileUrl().isBlank()) {
            return new AdminDocumentUrlResponse(document.getFileUrl(), null);
        }

        throw new BusinessException("DOCUMENT_UNAVAILABLE",
                "Tài liệu hiện chưa sẵn sàng để xem.", HttpStatus.NOT_FOUND);
    }

    // ========================================================================
    // Admin actions
    // ========================================================================

    /** Duyệt khóa học → PUBLISHED. */
    @Transactional
    public void approve(UUID courseId, AuthenticatedUser adminUser, String comment) {
        Course  course = loadPendingCourse(courseId);
        Profile admin  = loadProfile(adminUser.userId());

        CourseVersion submittedVersion = courseVersionRepository
                .findByCourseIdAndVersionNo(courseId, course.getSubmittedVersionNo())
                .orElseThrow(() -> new BusinessException(
                        "COURSE_VERSION_NOT_FOUND",
                        "Không tìm thấy phiên bản khóa học đang chờ duyệt.",
                        HttpStatus.CONFLICT));

        course.approve();
        submittedVersion.markApproved(admin);
        courseRepository.save(course);
        courseVersionRepository.save(submittedVersion);

        historyRepository.save(ApprovalHistory.create(course, admin, "approved", comment));
        notifyTeacherCourseReviewed(course, "course_approved",
                "Khóa học đã được duyệt",
                "Khóa học \"%s\" đã được duyệt và xuất bản.".formatted(course.getTitle()));
        log.info("Admin {} duyệt khóa học {} → PUBLISHED", adminUser.userId(), courseId);
        // TODO: gửi email thông báo GV khi JavaMailSender sẵn sàng
    }

    /** Từ chối khóa học → REJECTED (bắt buộc có comment). */
    @Transactional
    public void reject(UUID courseId, AuthenticatedUser adminUser, String comment) {
        if (comment == null || comment.isBlank()) {
            throw new BusinessException("COMMENT_REQUIRED",
                    "Vui lòng nhập lý do từ chối.", HttpStatus.BAD_REQUEST);
        }
        Course  course = loadPendingCourse(courseId);
        Profile admin  = loadProfile(adminUser.userId());

        course.reject();
        courseRepository.save(course);

        historyRepository.save(ApprovalHistory.create(course, admin, "rejected", comment));
        notifyTeacherCourseReviewed(course, "course_rejected",
                "Khóa học bị từ chối",
                "Khóa học \"%s\" bị từ chối. Lý do: %s".formatted(course.getTitle(), comment.trim()));
        log.info("Admin {} từ chối khóa học {}", adminUser.userId(), courseId);
    }

    /** Yêu cầu GV sửa lại → NEEDS_REVISION (bắt buộc có comment). */
    @Transactional
    public void revise(UUID courseId, AuthenticatedUser adminUser, String comment) {
        if (comment == null || comment.isBlank()) {
            throw new BusinessException("COMMENT_REQUIRED",
                    "Vui lòng nhập hướng dẫn cần sửa.", HttpStatus.BAD_REQUEST);
        }
        Course  course = loadPendingCourse(courseId);
        Profile admin  = loadProfile(adminUser.userId());

        course.needsRevision();
        courseRepository.save(course);

        historyRepository.save(
                ApprovalHistory.create(course, admin, "needs_revision", comment));
        notifyTeacherCourseReviewed(course, "course_revision_requested",
                "Khóa học cần chỉnh sửa",
                "Khóa học \"%s\" cần chỉnh sửa. Ghi chú: %s".formatted(course.getTitle(), comment.trim()));
        log.info("Admin {} yêu cầu sửa khóa học {}", adminUser.userId(), courseId);
    }

    // ========================================================================
    // Private helpers
    // ========================================================================

    private Course loadPendingCourse(UUID courseId) {
        Course course = courseRepository.findWithCategoryAndTeacherById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course", courseId));
        if (course.getStatus() != CourseStatus.PENDING_REVIEW) {
            throw new BusinessException("INVALID_STATUS",
                    "Khóa học không ở trạng thái chờ duyệt. Trạng thái hiện tại: "
                    + course.getStatus().toDbValue());
        }
        return course;
    }

    private Profile loadProfile(UUID id) {
        return profileRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", id));
    }

    private void notifyTeacherCourseReviewed(Course course, String type, String title, String body) {
        if (course.getTeacher() == null) {
            log.warn("Course {} has no teacher, skip teacher notification {}", course.getId(), type);
            return;
        }
        notificationService.notify(course.getTeacher().getId(), type, title, body, "/teacher/courses");
    }
}

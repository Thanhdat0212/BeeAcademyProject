package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.ComplaintMessageRequest;
import com.beeacademy.backend.dto.request.CreateComplaintRequest;
import com.beeacademy.backend.dto.response.ComplaintResponse;
import com.beeacademy.backend.dto.response.ComplaintStatsResponse;
import com.beeacademy.backend.dto.response.ComplaintSummaryResponse;
import com.beeacademy.backend.dto.response.PageResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Complaint;
import com.beeacademy.backend.model.ComplaintMessage;
import com.beeacademy.backend.model.ComplaintStatus;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.UserRole;
import com.beeacademy.backend.repository.ComplaintRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Logic khiếu nại cho cả hai phía:
 * <ul>
 *   <li>Người gửi (HS/PH/GV): tạo, xem, bổ sung tin nhắn vào khiếu nại của mình (UC11).</li>
 *   <li>Admin: liệt kê + lọc, xem chi tiết, phản hồi, đổi trạng thái (UC38).</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class ComplaintService {

    private final ComplaintRepository complaintRepository;
    private final ProfileRepository profileRepository;
    private final ComplaintAttachmentService attachmentService;

    /** Map entity → response, kèm signed URL cho file đính kèm. */
    private ComplaintResponse toResponse(Complaint complaint) {
        return ComplaintResponse.fromEntity(complaint, attachmentService::signedUrl);
    }

    // ── Phía người gửi (UC11) ───────────────────────────────────────────────

    @Transactional
    public ComplaintResponse submit(AuthenticatedUser me, CreateComplaintRequest req,
                                    List<MultipartFile> files) {
        Profile sender = loadProfile(me.userId());
        if (sender.getRole() == UserRole.ADMIN) {
            throw new BusinessException("ADMIN_CANNOT_SUBMIT",
                    "Admin không gửi khiếu nại — hãy dùng hộp thư xử lý.", HttpStatus.FORBIDDEN);
        }
        Complaint complaint = Complaint.create(
                sender, req.title(), req.category(), req.priorityOrDefault(), req.content());
        attachmentService.attachTo(complaint.firstMessage(), complaint.getId(), files);
        return toResponse(complaintRepository.save(complaint));
    }

    @Transactional(readOnly = true)
    public List<ComplaintResponse> listMine(AuthenticatedUser me) {
        return complaintRepository.findBySenderId(me.userId()).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ComplaintResponse getMyThread(UUID id, AuthenticatedUser me) {
        Complaint complaint = loadDetailed(id);
        verifySenderOwner(complaint, me.userId());
        return toResponse(complaint);
    }

    @Transactional
    public ComplaintResponse senderReply(UUID id, AuthenticatedUser me,
                                         ComplaintMessageRequest req, List<MultipartFile> files) {
        Profile sender = loadProfile(me.userId());
        Complaint complaint = loadDetailed(id);
        verifySenderOwner(complaint, me.userId());
        requireContentOrFiles(req, files);
        // Thread đã đóng vẫn cho gửi → tự mở lại (chat tiếp nếu chưa thỏa đáng).
        ComplaintMessage message = complaint.addSenderMessage(sender, req.contentOrEmpty());
        attachmentService.attachTo(message, complaint.getId(), files);
        return toResponse(complaintRepository.save(complaint));
    }

    // ── Phía Admin (UC38) ────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PageResponse<ComplaintSummaryResponse> adminList(String status, String search, Pageable pageable) {
        Page<Complaint> page = complaintRepository.findAll(adminFilter(status, search), pageable);
        return PageResponse.of(page, ComplaintSummaryResponse::fromEntity);
    }

    @Transactional(readOnly = true)
    public ComplaintResponse adminGetThread(UUID id) {
        return toResponse(loadDetailed(id));
    }

    @Transactional
    public ComplaintResponse adminReply(UUID id, AuthenticatedUser me,
                                        ComplaintMessageRequest req, List<MultipartFile> files) {
        Profile admin = loadProfile(me.userId());
        Complaint complaint = loadDetailed(id);
        requireContentOrFiles(req, files);
        ComplaintMessage message = complaint.addAdminMessage(admin, req.contentOrEmpty());
        attachmentService.attachTo(message, complaint.getId(), files);
        return toResponse(complaintRepository.save(complaint));
    }

    /** Một tin nhắn phải có nội dung HOẶC ít nhất một file đính kèm. */
    private void requireContentOrFiles(ComplaintMessageRequest req, List<MultipartFile> files) {
        boolean hasContent = req.content() != null && !req.content().isBlank();
        boolean hasFiles = files != null && files.stream().anyMatch(f -> f != null && !f.isEmpty());
        if (!hasContent && !hasFiles) {
            throw new BusinessException("EMPTY_MESSAGE",
                    "Vui lòng nhập nội dung hoặc đính kèm file.", HttpStatus.BAD_REQUEST);
        }
    }

    @Transactional
    public ComplaintResponse adminChangeStatus(UUID id, String status) {
        Complaint complaint = loadDetailed(id);
        complaint.changeStatus(ComplaintStatus.fromDbValue(status));
        return toResponse(complaintRepository.save(complaint));
    }

    @Transactional(readOnly = true)
    public ComplaintStatsResponse adminStats() {
        long pending    = complaintRepository.countByStatus(ComplaintStatus.PENDING);
        long inProgress = complaintRepository.countByStatus(ComplaintStatus.IN_PROGRESS);
        long resolved   = complaintRepository.countByStatus(ComplaintStatus.RESOLVED);
        long rejected   = complaintRepository.countByStatus(ComplaintStatus.REJECTED);
        long closed     = resolved + rejected;
        return new ComplaintStatsResponse(pending, inProgress, closed, pending + inProgress + closed);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Specification lọc danh sách Admin theo status + search (tiêu đề hoặc tên
     * người gửi). Fetch sender trên query dữ liệu (không phải count) để tránh
     * N+1 khi map tên người gửi; ManyToOne fetch + pagination an toàn.
     */
    private Specification<Complaint> adminFilter(String status, String search) {
        return (root, query, cb) -> {
            if (query.getResultType() != Long.class && query.getResultType() != long.class) {
                root.fetch("sender", JoinType.LEFT);
            }
            List<Predicate> predicates = new ArrayList<>();
            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(root.get("status"), ComplaintStatus.fromDbValue(status)));
            }
            if (search != null && !search.isBlank()) {
                String like = "%" + search.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("title")), like),
                        cb.like(cb.lower(root.join("sender", JoinType.LEFT).get("fullName")), like)));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private Complaint loadDetailed(UUID id) {
        return complaintRepository.findDetailedById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Complaint", id));
    }

    private Profile loadProfile(UUID userId) {
        return profileRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", userId));
    }

    private void verifySenderOwner(Complaint complaint, UUID userId) {
        if (!complaint.getSender().getId().equals(userId)) {
            throw new BusinessException("FORBIDDEN",
                    "Bạn không có quyền truy cập khiếu nại này.", HttpStatus.FORBIDDEN);
        }
    }
}

package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.BankInfoRequest;
import com.beeacademy.backend.dto.response.AdminBankAccountResponse;
import com.beeacademy.backend.dto.response.BankAuditLogResponse;
import com.beeacademy.backend.dto.response.BankInfoResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.BankVerifyStatus;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.TeacherBankAccount;
import com.beeacademy.backend.model.TeacherBankAuditLog;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.TeacherBankAccountRepository;
import com.beeacademy.backend.repository.TeacherBankAuditLogRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class TeacherBankService {

    private final TeacherBankAccountRepository bankRepo;
    private final TeacherBankAuditLogRepository auditRepo;
    private final ProfileRepository profileRepo;
    private final ObjectMapper objectMapper;
    private final UserNotificationService userNotificationService;

    @Transactional(readOnly = true)
    public Optional<BankInfoResponse> getBankInfo(UUID teacherId) {
        return bankRepo.findByTeacherId(teacherId).map(BankInfoResponse::from);
    }

    @Transactional
    public BankInfoResponse upsertBankInfo(UUID teacherId, BankInfoRequest req) {
        Optional<TeacherBankAccount> existing = bankRepo.findByTeacherId(teacherId);
        String teacherName = profileRepo.findById(teacherId)
                .map(p -> p.getFullName() != null ? p.getFullName() : "Giáo viên")
                .orElse("Giáo viên");

        TeacherBankAccount account;
        List<Map<String, String>> changes = new ArrayList<>();

        if (existing.isPresent()) {
            account = existing.get();
            // Track changes for audit log
            if (!account.getBankName().equals(req.bankName()))
                changes.add(change("Tên ngân hàng", account.getBankName(), req.bankName()));
            if (!account.getAccountNumber().equals(req.accountNumber()))
                changes.add(change("Số tài khoản", account.getAccountNumber(), req.accountNumber()));
            if (!account.getAccountHolder().equals(req.accountHolder()))
                changes.add(change("Tên chủ tài khoản", account.getAccountHolder(), req.accountHolder()));
            String oldBranch = account.getBranch() != null ? account.getBranch() : "";
            if (!oldBranch.equals(req.branch()))
                changes.add(change("Chi nhánh", oldBranch, req.branch()));

            account.update(req.bankName(), req.accountNumber(),
                           req.accountHolder().toUpperCase(), req.branch());
        } else {
            account = TeacherBankAccount.create(teacherId, req.bankName(),
                    req.accountNumber(), req.accountHolder().toUpperCase(), req.branch());
            changes.add(change("Trạng thái", "", "Thêm mới TK ngân hàng"));
        }

        bankRepo.save(account);

        if (!changes.isEmpty()) {
            try {
                String changesJson = objectMapper.writeValueAsString(changes);
                TeacherBankAuditLog auditEntry = TeacherBankAuditLog.create(
                        teacherId, teacherName, req.reason(), changesJson);
                auditRepo.save(auditEntry);
            } catch (Exception e) {
                log.error("Không thể ghi audit log cho teacherId={}: {}", teacherId, e.getMessage());
            }
        }

        return BankInfoResponse.from(account);
    }

    @Transactional(readOnly = true)
    public List<BankAuditLogResponse> getAuditLog(UUID teacherId) {
        return auditRepo.findByTeacherIdOrderByChangedAtDesc(teacherId)
                .stream()
                .map(BankAuditLogResponse::from)
                .toList();
    }

    /** Danh sách TK ngân hàng GV chờ Admin duyệt (REQ-ADM-006 AC6). */
    @Transactional(readOnly = true)
    public List<AdminBankAccountResponse> listPendingBankAccounts() {
        List<TeacherBankAccount> pending =
                bankRepo.findByVerifyStatusOrderByUpdatedAtAsc(BankVerifyStatus.PENDING);
        if (pending.isEmpty()) {
            return List.of();
        }
        Map<UUID, String> names = profileRepo
                .findAllById(pending.stream().map(TeacherBankAccount::getTeacherId).toList())
                .stream()
                .collect(HashMap::new,
                        (m, p) -> m.put(p.getId(), p.getFullName() != null ? p.getFullName() : "Giáo viên"),
                        HashMap::putAll);
        return pending.stream()
                .map(account -> AdminBankAccountResponse.from(
                        account, names.getOrDefault(account.getTeacherId(), "Giáo viên")))
                .toList();
    }

    /**
     * Admin duyệt/từ chối TK ngân hàng GV. Chỉ TK VERIFIED mới được dùng khi
     * xác nhận chuyển khoản — xem guard HOLD_BANK_INFO ở AdminPayoutService.
     */
    @Transactional
    public AdminBankAccountResponse reviewBankAccount(
            UUID teacherId, boolean approve, String note, UUID adminId) {
        TeacherBankAccount account = bankRepo.findByTeacherId(teacherId)
                .orElseThrow(() -> new ResourceNotFoundException("TeacherBankAccount", teacherId));
        if (account.getVerifyStatus() != BankVerifyStatus.PENDING) {
            throw new BusinessException("BANK_ALREADY_REVIEWED",
                    "TK ngân hàng này đã được duyệt/từ chối trước đó.");
        }

        if (approve) {
            account.approveVerification();
        } else {
            account.rejectVerification();
        }
        bankRepo.save(account);

        String teacherName = profileRepo.findById(teacherId)
                .map(Profile::getFullName).orElse("Giáo viên");
        String action = approve ? "Admin duyệt TK ngân hàng" : "Admin từ chối TK ngân hàng";
        try {
            String changesJson = objectMapper.writeValueAsString(
                    List.of(change("Trạng thái duyệt", "pending", account.getVerifyStatus().toDbValue())));
            auditRepo.save(TeacherBankAuditLog.create(
                    teacherId, teacherName,
                    note != null && !note.isBlank() ? action + ": " + note.trim() : action,
                    changesJson));
        } catch (Exception e) {
            log.error("Không thể ghi audit log duyệt TK cho teacherId={}: {}", teacherId, e.getMessage());
        }

        try {
            userNotificationService.notify(
                    teacherId,
                    "bank_account_review",
                    approve ? "TK ngân hàng đã được duyệt" : "TK ngân hàng bị từ chối",
                    approve
                            ? "Tài khoản %s - %s đã được Admin xác minh và sẽ dùng cho các kỳ chi trả."
                                    .formatted(account.getBankName(), account.getAccountNumber())
                            : "Tài khoản %s - %s bị từ chối%s. Vui lòng cập nhật lại thông tin."
                                    .formatted(account.getBankName(), account.getAccountNumber(),
                                            note != null && !note.isBlank() ? ": " + note.trim() : ""),
                    "/teacher/bank");
        } catch (Exception e) {
            log.warn("Không thể gửi thông báo duyệt TK cho teacherId={}", teacherId, e);
        }

        return AdminBankAccountResponse.from(account,
                teacherName != null ? teacherName : "Giáo viên");
    }

    private Map<String, String> change(String field, String oldValue, String newValue) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("field", field);
        m.put("oldValue", oldValue);
        m.put("newValue", newValue);
        return m;
    }
}

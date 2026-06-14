package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.BankInfoRequest;
import com.beeacademy.backend.dto.response.BankAuditLogResponse;
import com.beeacademy.backend.dto.response.BankInfoResponse;
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

    private Map<String, String> change(String field, String oldValue, String newValue) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("field", field);
        m.put("oldValue", oldValue);
        m.put("newValue", newValue);
        return m;
    }
}

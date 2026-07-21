package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.BankInfoRequest;
import com.beeacademy.backend.dto.response.BankAuditLogResponse;
import com.beeacademy.backend.dto.response.BankChangeRequestResponse;
import com.beeacademy.backend.dto.response.BankFieldChange;
import com.beeacademy.backend.dto.response.BankInfoResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.model.BankVerifyStatus;
import com.beeacademy.backend.model.TeacherBankAccount;
import com.beeacademy.backend.model.TeacherBankAuditLog;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.TeacherBankAccountRepository;
import com.beeacademy.backend.repository.TeacherBankAuditLogRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
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
    private final TeacherBankOtpService bankOtpService;

    @Transactional(readOnly = true)
    public Optional<BankInfoResponse> getBankInfo(UUID teacherId) {
        return bankRepo.findByTeacherId(teacherId).map(BankInfoResponse::from);
    }

    /**
     * Bước 1 — GV xin mã xác nhận để thêm/đổi TK ngân hàng.
     *
     * <p>Chủ ý KHÔNG ghi gì vào DB ở bước này: thông tin mới nằm chờ trong
     * {@link TeacherBankOtpService} cho tới khi mã đúng. Ai mượn được session GV
     * mà không mở được hộp thư thì không đổi nổi một ký tự, và TK đang VERIFIED
     * vẫn nguyên vẹn nên kỳ chi trả không bị treo oan.
     *
     * <p>Cố ý KHÔNG bọc {@code @Transactional}: bước này chỉ đọc, còn phần chậm
     * nhất là gửi SMTP — giữ transaction mở suốt lúc đó là giam connection pool
     * mỗi lần server mail ì.
     */
    public BankChangeRequestResponse requestBankChange(UUID teacherId, BankInfoRequest req) {
        BankInfoRequest payload = normalize(req);
        Optional<TeacherBankAccount> existing = bankRepo.findByTeacherId(teacherId);
        List<BankFieldChange> changes = diff(existing.orElse(null), payload);

        // Không đổi gì mà TK đã VERIFIED rồi thì gửi mã chỉ tổ phiền. Ngược lại,
        // TK đang PENDING/REJECTED được phép "xin mã để xác minh lại" dù giữ
        // nguyên thông tin — đây là đường thoát cho các TK tồn từ thời Admin duyệt.
        boolean alreadyVerified = existing
                .map(a -> a.getVerifyStatus() == BankVerifyStatus.VERIFIED)
                .orElse(false);
        if (changes.isEmpty() && alreadyVerified) {
            throw new BusinessException("BANK_NO_CHANGES", "Không có thay đổi nào để lưu.");
        }

        String email = profileRepo.findEmailByUserId(teacherId)
                .filter(e -> e != null && !e.isBlank())
                .orElseThrow(() -> new BusinessException("BANK_EMAIL_MISSING",
                        "Tài khoản của bạn chưa có email nên không nhận được mã xác nhận. "
                                + "Vui lòng liên hệ Admin.",
                        HttpStatus.CONFLICT));
        String teacherName = teacherName(teacherId);

        var pending = bankOtpService.start(teacherId, email, teacherName, payload, changes);
        return new BankChangeRequestResponse(
                TeacherBankOtpService.maskEmail(email), pending.expiresAt(), changes);
    }

    /**
     * Bước 2 — mã đúng thì ghi TK xuống DB và đánh dấu VERIFIED luôn.
     *
     * <p>Mã gửi tới email GV chính là bằng chứng chủ tài khoản, nên không còn
     * lý do bắt TK nằm chờ Admin duyệt: {@code HOLD_BANK_INFO} ở
     * {@code AdminPayoutService} sẽ mở ngay trong kỳ chi trả kế tiếp.
     */
    @Transactional
    public BankInfoResponse confirmBankChange(UUID teacherId, String otpCode) {
        var pending = bankOtpService.verify(teacherId, otpCode);
        BankInfoRequest req = pending.payload();

        Optional<TeacherBankAccount> existing = bankRepo.findByTeacherId(teacherId);
        // Tính lại diff tại thời điểm ghi, không dùng lại diff lúc xin mã: giữa hai
        // bước Admin có thể đã đụng vào TK, audit log phải chép đúng giá trị cũ thật.
        List<BankFieldChange> changes = new ArrayList<>(diff(existing.orElse(null), req));

        TeacherBankAccount account;
        if (existing.isPresent()) {
            account = existing.get();
            account.update(req.bankName(), req.accountNumber(), req.accountHolder(), req.branch());
        } else {
            account = TeacherBankAccount.create(teacherId, req.bankName(),
                    req.accountNumber(), req.accountHolder(), req.branch());
            changes.add(change("Trạng thái", "", "Thêm mới TK ngân hàng"));
        }
        // update()/create() đều đặt lại PENDING — mã email đã thay vai trò người duyệt.
        account.approveVerification();
        bankRepo.save(account);

        if (changes.isEmpty()) {
            changes.add(change("Trạng thái xác minh", "pending", "Đã xác minh qua email"));
        }
        writeAuditLog(teacherId, req.reason(), changes);

        try {
            userNotificationService.notify(
                    teacherId,
                    "bank_account_verified",
                    "TK ngân hàng đã được xác minh",
                    "Tài khoản %s - %s đã xác minh qua email và sẽ dùng cho các kỳ chi trả."
                            .formatted(account.getBankName(), account.getAccountNumber()),
                    "/teacher/bank");
        } catch (Exception e) {
            log.warn("Không thể gửi thông báo xác minh TK cho teacherId={}", teacherId, e);
        }

        // Chỉ xoá mã sau khi mọi thứ đã ghi xong — lỗi giữa chừng thì GV vẫn còn mã để thử lại.
        bankOtpService.consume(teacherId);
        return BankInfoResponse.from(account);
    }

    @Transactional(readOnly = true)
    public List<BankAuditLogResponse> getAuditLog(UUID teacherId) {
        return auditRepo.findByTeacherIdOrderByChangedAtDesc(teacherId)
                .stream()
                .map(BankAuditLogResponse::from)
                .toList();
    }

    private BankFieldChange change(String field, String oldValue, String newValue) {
        return new BankFieldChange(field, oldValue, newValue);
    }

    /**
     * Chuẩn hoá đúng một lần ở bước xin mã, để payload nằm chờ là chính xác thứ
     * sẽ ghi vào DB. Chuẩn hoá lại ở bước xác nhận thì diff hiển thị trong email
     * có nguy cơ lệch với giá trị thật được lưu.
     */
    private BankInfoRequest normalize(BankInfoRequest req) {
        return new BankInfoRequest(
                req.bankName().trim(),
                req.accountNumber().trim(),
                req.accountHolder().trim().toUpperCase(),
                req.branch().trim(),
                req.reason());
    }

    /** So TK hiện tại với thông tin mới; {@code current == null} nghĩa là GV chưa có TK nào. */
    private List<BankFieldChange> diff(TeacherBankAccount current, BankInfoRequest req) {
        if (current == null) {
            return List.of();
        }
        List<BankFieldChange> changes = new ArrayList<>();
        if (!current.getBankName().equals(req.bankName()))
            changes.add(change("Tên ngân hàng", current.getBankName(), req.bankName()));
        if (!current.getAccountNumber().equals(req.accountNumber()))
            changes.add(change("Số tài khoản", current.getAccountNumber(), req.accountNumber()));
        if (!current.getAccountHolder().equals(req.accountHolder()))
            changes.add(change("Tên chủ tài khoản", current.getAccountHolder(), req.accountHolder()));
        String oldBranch = current.getBranch() != null ? current.getBranch() : "";
        if (!oldBranch.equals(req.branch()))
            changes.add(change("Chi nhánh", oldBranch, req.branch()));
        return changes;
    }

    private String teacherName(UUID teacherId) {
        return profileRepo.findById(teacherId)
                .map(p -> p.getFullName() != null ? p.getFullName() : "Giáo viên")
                .orElse("Giáo viên");
    }

    /**
     * Audit log là bằng chứng khi có tranh chấp tiền, nhưng hỏng audit thì không
     * được kéo đổ giao dịch đã hợp lệ — nuốt lỗi và ghi log ở mức error để còn truy.
     */
    private void writeAuditLog(UUID teacherId, String reason, List<BankFieldChange> changes) {
        try {
            auditRepo.save(TeacherBankAuditLog.create(
                    teacherId, teacherName(teacherId), reason,
                    objectMapper.writeValueAsString(changes)));
        } catch (Exception e) {
            log.error("Không thể ghi audit log cho teacherId={}: {}", teacherId, e.getMessage());
        }
    }
}

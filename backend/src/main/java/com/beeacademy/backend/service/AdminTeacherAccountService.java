package com.beeacademy.backend.service;

import com.beeacademy.backend.client.AuthProviderClient;
import com.beeacademy.backend.client.dto.ProviderUser;
import com.beeacademy.backend.dto.request.CreateTeacherAccountRequest;
import com.beeacademy.backend.dto.response.TemporaryPasswordResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.UserRole;
import com.beeacademy.backend.repository.ProfileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Admin cấp tài khoản giáo viên (thay cho đăng ký công khai).
 *
 * <p>Nghiệp vụ: giáo viên liên hệ Bee Academy qua mạng xã hội, Admin thẩm định
 * ngoài hệ thống rồi tạo tài khoản tại đây. Hệ thống sinh mật khẩu tạm, trả về
 * đúng một lần cho Admin copy gửi qua Zalo/Facebook, đồng thời gửi email.
 * Giáo viên bị buộc đổi mật khẩu ở lần đăng nhập đầu tiên.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminTeacherAccountService {

    /**
     * Bảng ký tự loại bỏ các cặp dễ đọc nhầm (0/O, 1/l/I) vì mật khẩu này
     * được đọc bằng mắt rồi gõ tay hoặc copy qua tin nhắn.
     */
    private static final String UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    private static final String LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
    private static final String DIGITS    = "23456789";
    private static final int PASSWORD_LENGTH = 12;

    private final AuthProviderClient authProviderClient;
    private final ProfileRepository profileRepository;
    private final TeacherAccountEmailService teacherAccountEmailService;

    private final SecureRandom random = new SecureRandom();

    /**
     * Tạo tài khoản giáo viên mới.
     *
     * <p>Thứ tự bước rất quan trọng: kiểm tra trùng email → tạo auth user ở
     * Supabase → lưu profile → gửi email. Email đặt sau cùng và không được ném
     * exception (xem {@link TeacherAccountEmailService}) để SMTP hỏng không
     * làm rollback profile trong khi auth user đã tồn tại bên Supabase.
     *
     * @param adminId Admin đang thao tác - lưu vào profile để audit
     */
    @Transactional
    public TemporaryPasswordResponse createTeacher(CreateTeacherAccountRequest request, UUID adminId) {
        String email = request.email().trim();

        if (profileRepository.existsByEmailInAuth(email)) {
            throw new BusinessException("EMAIL_ALREADY_EXISTS",
                    "Email này đã được sử dụng cho một tài khoản khác", HttpStatus.CONFLICT);
        }

        String temporaryPassword = generateTemporaryPassword();

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("role", UserRole.TEACHER.toDbValue());
        metadata.put("full_name", request.fullName());

        ProviderUser providerUser = authProviderClient.signUp(email, temporaryPassword, metadata);
        log.info("Admin {} đã tạo auth user giáo viên {}", adminId, providerUser.id());

        Profile profile = Profile.createTeacherByAdmin(
                providerUser.id(), request.fullName(), adminId, request.contactNote());
        if (request.phone() != null && !request.phone().isBlank()) {
            profile.updatePersonalInfo(null, request.phone(), null, null, null, null);
        }
        profileRepository.save(profile);

        boolean emailSent = teacherAccountEmailService.sendTemporaryPassword(
                email, request.fullName(), temporaryPassword);

        return new TemporaryPasswordResponse(
                profile.getId(), email, profile.getFullName(), temporaryPassword, emailSent);
    }

    /**
     * Cấp lại mật khẩu tạm cho tài khoản đã có (GV báo mất mật khẩu qua kênh
     * mạng xã hội thay vì dùng luồng quên mật khẩu qua email).
     *
     * <p>Chặn thao tác trên tài khoản Admin - Admin muốn đổi mật khẩu của mình
     * thì dùng luồng đổi mật khẩu thông thường, không đi qua đường này.
     */
    @Transactional
    public TemporaryPasswordResponse resetPassword(UUID userId, UUID adminId) {
        Profile profile = profileRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", userId));

        if (profile.getRole() == UserRole.ADMIN) {
            throw new BusinessException("CANNOT_RESET_ADMIN",
                    "Không thể cấp lại mật khẩu cho tài khoản Admin.", HttpStatus.FORBIDDEN);
        }

        String email = profileRepository.findEmailByUserId(userId)
                .orElseThrow(() -> new BusinessException("USER_EMAIL_NOT_FOUND",
                        "Không tìm thấy email của tài khoản này"));

        String temporaryPassword = generateTemporaryPassword();
        authProviderClient.updatePasswordAsAdmin(userId, temporaryPassword);

        profile.markMustChangePassword();
        profileRepository.save(profile);
        log.info("Admin {} đã cấp lại mật khẩu tạm cho user {}", adminId, userId);

        boolean emailSent = teacherAccountEmailService.sendTemporaryPassword(
                email, profile.getFullName(), temporaryPassword);

        return new TemporaryPasswordResponse(
                userId, email, profile.getFullName(), temporaryPassword, emailSent);
    }

    /**
     * Sinh mật khẩu tạm thoả regex của hệ thống {@code (?=.*[A-Z])(?=.*\d).{8,}}.
     *
     * <p>Ghép cưỡng bức 1 chữ hoa + 1 chữ số rồi shuffle, thay vì rút ngẫu nhiên
     * toàn bộ và hy vọng đủ điều kiện - cách sau có xác suất sinh ra mật khẩu bị
     * chính hệ thống từ chối ở bước đổi mật khẩu sau này.
     */
    private String generateTemporaryPassword() {
        String allChars = UPPERCASE + LOWERCASE + DIGITS;
        List<Character> chars = new ArrayList<>(PASSWORD_LENGTH);

        chars.add(UPPERCASE.charAt(random.nextInt(UPPERCASE.length())));
        chars.add(DIGITS.charAt(random.nextInt(DIGITS.length())));
        for (int i = chars.size(); i < PASSWORD_LENGTH; i++) {
            chars.add(allChars.charAt(random.nextInt(allChars.length())));
        }
        Collections.shuffle(chars, random);

        StringBuilder sb = new StringBuilder(PASSWORD_LENGTH);
        chars.forEach(sb::append);
        return sb.toString();
    }
}

package com.beeacademy.backend.client;

import com.beeacademy.backend.client.dto.ProviderTokenResponse;
import com.beeacademy.backend.client.dto.ProviderUpdateUserRequest;
import com.beeacademy.backend.client.dto.ProviderUser;
import com.beeacademy.backend.config.SupabaseProperties;
import com.beeacademy.backend.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Implementation gọi Supabase GoTrue API (REST) qua {@link RestClient}.
 *
 * <p>Lớp này KHÔNG biết gì về business - chỉ làm 2 việc:
 * <ol>
 *   <li>Build request HTTP đúng spec GoTrue (URL, header, body).</li>
 *   <li>Map response/error của GoTrue → DTO nội bộ hoặc
 *       {@link BusinessException} có code chuẩn.</li>
 * </ol>
 *
 * <p>Header bắt buộc cho mọi call GoTrue:
 * <ul>
 *   <li>{@code apikey}: anon key (public) - cho endpoint không cần auth.</li>
 *   <li>{@code Authorization}: Bearer token - cho endpoint cần user (logout,
 *       update user). Vẫn cần gửi {@code apikey} kèm.</li>
 * </ul>
 */
@Slf4j
@Component
public class SupabaseAuthClient implements AuthProviderClient {

    /** Header key chuẩn của Supabase yêu cầu. */
    private static final String HEADER_API_KEY = "apikey";

    /** Path base của GoTrue. {@code supabaseRestClient} đã set baseUrl = SUPABASE_URL. */
    private static final String PATH_ADMIN_USERS = "/auth/v1/admin/users";
    private static final String PATH_TOKEN       = "/auth/v1/token";
    private static final String PATH_LOGOUT      = "/auth/v1/logout";
    private static final String PATH_RECOVER     = "/auth/v1/recover";
    private static final String PATH_USER        = "/auth/v1/user";

    private final RestClient restClient;
    private final String anonKey;
    private final String serviceRoleKey;

    public SupabaseAuthClient(RestClient restClient, SupabaseProperties props) {
        this.restClient = restClient;
        this.anonKey = props.anonKey();
        this.serviceRoleKey = props.serviceRoleKey();
    }

    // ========================================================================
    // PUBLIC API - implement AuthProviderClient
    // ========================================================================

    /**
     * Gọi {@code POST /auth/v1/admin/users} với service_role_key.
     *
     * <p>Dùng Admin API thay vì {@code /auth/v1/signup} để:
     * <ul>
     *   <li>Bỏ qua email confirmation của Supabase (ta đã xác minh OTP rồi).</li>
     *   <li>Tránh lỗi 500 khi Supabase SMTP không được cấu hình.</li>
     * </ul>
     * {@code email_confirm: true} trong body báo Supabase coi email đã xác minh.
     */
    @Override
    public ProviderUser signUp(String email, String password, Map<String, Object> metadata) {
        Map<String, Object> body = new HashMap<>();
        body.put("email", email);
        body.put("password", password);
        body.put("email_confirm", true);
        body.put("user_metadata", metadata);

        try {
            ProviderUser user = restClient.post()
                    .uri(PATH_ADMIN_USERS)
                    .header(HEADER_API_KEY, serviceRoleKey)
                    .header("Authorization", "Bearer " + serviceRoleKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(ProviderUser.class);

            if (user == null || user.id() == null) {
                throw new BusinessException("AUTH_PROVIDER_ERROR",
                        "Phản hồi không hợp lệ từ máy chủ xác thực", HttpStatus.BAD_GATEWAY);
            }
            return user;
        } catch (HttpClientErrorException ex) {
            throw mapClientError(ex, "signUp");
        } catch (RestClientException ex) {
            throw mapServerError(ex);
        }
    }

    /**
     * Gọi {@code POST /auth/v1/token?grant_type=password}.
     *
     * <p>Trả về cả access_token và refresh_token. Dùng cho:
     * <ul>
     *   <li>Endpoint {@code /api/auth/login}.</li>
     *   <li>Verify mật khẩu cũ ở use case change-password (nếu signin
     *       thành công thì mật khẩu cũ đúng).</li>
     * </ul>
     */
    @Override
    public ProviderTokenResponse signInWithPassword(String email, String password) {
        Map<String, String> body = Map.of("email", email, "password", password);
        try {
            return restClient.post()
                    .uri(uri -> uri.path(PATH_TOKEN).queryParam("grant_type", "password").build())
                    .header(HEADER_API_KEY, anonKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(ProviderTokenResponse.class);
        } catch (HttpClientErrorException ex) {
            // GoTrue trả 400 + message "Invalid login credentials" cho cả 3 case:
            // sai email, sai password, chưa confirm email. Map chung 1 code.
            if (ex.getStatusCode() == HttpStatus.BAD_REQUEST) {
                throw new BusinessException("INVALID_CREDENTIALS",
                        "Email hoặc mật khẩu không đúng, hoặc tài khoản chưa được xác thực email",
                        HttpStatus.UNAUTHORIZED);
            }
            throw mapClientError(ex, "signIn");
        } catch (RestClientException ex) {
            throw mapServerError(ex);
        }
    }

    /**
     * Gọi {@code POST /auth/v1/token?grant_type=refresh_token}.
     */
    @Override
    public ProviderTokenResponse refreshToken(String refreshToken) {
        Map<String, String> body = Map.of("refresh_token", refreshToken);
        try {
            return restClient.post()
                    .uri(uri -> uri.path(PATH_TOKEN).queryParam("grant_type", "refresh_token").build())
                    .header(HEADER_API_KEY, anonKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(ProviderTokenResponse.class);
        } catch (HttpClientErrorException ex) {
            if (ex.getStatusCode() == HttpStatus.BAD_REQUEST || ex.getStatusCode() == HttpStatus.UNAUTHORIZED) {
                throw new BusinessException("INVALID_REFRESH_TOKEN",
                        "Refresh token không hợp lệ hoặc đã hết hạn", HttpStatus.UNAUTHORIZED);
            }
            throw mapClientError(ex, "refresh");
        } catch (RestClientException ex) {
            throw mapServerError(ex);
        }
    }

    /**
     * Gọi {@code POST /auth/v1/logout} với JWT của user.
     *
     * <p>GoTrue revoke refresh_token; access_token vẫn dùng được đến TTL.
     */
    @Override
    public void signOut(String accessToken) {
        try {
            restClient.post()
                    .uri(PATH_LOGOUT)
                    .header(HEADER_API_KEY, anonKey)
                    .header("Authorization", "Bearer " + accessToken)
                    .retrieve()
                    .toBodilessEntity();
        } catch (HttpClientErrorException ex) {
            // 401 = token đã invalid - coi như logout thành công (idempotent)
            if (ex.getStatusCode() == HttpStatus.UNAUTHORIZED) {
                log.debug("Logout với token đã invalid - coi như thành công");
                return;
            }
            throw mapClientError(ex, "signOut");
        } catch (RestClientException ex) {
            throw mapServerError(ex);
        }
    }

    /**
     * Gọi {@code POST /auth/v1/recover} gửi email reset.
     *
     * <p>GoTrue luôn trả 200 dù email tồn tại hay không - chính sách
     * anti-enumeration. Ta giữ nguyên hành vi này: chỉ ném exception
     * khi lỗi mạng/server, không khi "email không tồn tại".
     */
    @Override
    public void sendPasswordRecovery(String email) {
        try {
            restClient.post()
                    .uri(PATH_RECOVER)
                    .header(HEADER_API_KEY, anonKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("email", email))
                    .retrieve()
                    .toBodilessEntity();
        } catch (HttpClientErrorException ex) {
            // 429 rate limit - nên báo cho user biết để chờ
            if (ex.getStatusCode() == HttpStatus.TOO_MANY_REQUESTS) {
                throw new BusinessException("RATE_LIMITED",
                        "Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau ít phút.",
                        HttpStatus.TOO_MANY_REQUESTS);
            }
            throw mapClientError(ex, "recover");
        } catch (RestClientException ex) {
            throw mapServerError(ex);
        }
    }

    @Override
    public void updatePassword(String accessToken, String newPassword) {
        ProviderUpdateUserRequest body = ProviderUpdateUserRequest.changePassword(newPassword);
        try {
            restClient.put()
                    .uri(PATH_USER)
                    .header(HEADER_API_KEY, anonKey)
                    .header("Authorization", "Bearer " + accessToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
        } catch (HttpClientErrorException ex) {
            if (ex.getStatusCode() == HttpStatus.UNPROCESSABLE_ENTITY) {
                // Supabase reject password yếu / trùng password cũ
                throw new BusinessException("WEAK_PASSWORD",
                        "Mật khẩu mới không đáp ứng yêu cầu hoặc trùng mật khẩu cũ");
            }
            throw mapClientError(ex, "updatePassword");
        } catch (RestClientException ex) {
            throw mapServerError(ex);
        }
    }

    @Override
    public void updatePasswordAsAdmin(UUID userId, String newPassword) {
        Map<String, Object> body = Map.of("password", newPassword);
        try {
            restClient.put()
                    .uri(PATH_ADMIN_USERS + "/" + userId)
                    .header(HEADER_API_KEY, serviceRoleKey)
                    .header("Authorization", "Bearer " + serviceRoleKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Admin đã đổi mật khẩu thành công cho user UUID: {}", userId);
        } catch (HttpClientErrorException ex) {
            if (ex.getStatusCode() == HttpStatus.UNPROCESSABLE_ENTITY) {
                throw new BusinessException("WEAK_PASSWORD",
                        "Mật khẩu mới không đáp ứng yêu cầu bảo mật");
            }
            throw mapClientError(ex, "updatePasswordAsAdmin");
        } catch (RestClientException ex) {
            throw mapServerError(ex);
        }
    }

    // ========================================================================
    // ERROR MAPPING - chuyển lỗi HTTP của GoTrue thành BusinessException
    // ========================================================================

    /**
     * Map 4xx của GoTrue → BusinessException với code đọc được.
     *
     * <p>Phân tích body JSON {@code {error_code, msg, ...}} để chọn code
     * phù hợp. Ví dụ {@code user_already_exists} → {@code EMAIL_ALREADY_EXISTS}.
     */
    private BusinessException mapClientError(HttpClientErrorException ex, String operation) {
        String responseBody = ex.getResponseBodyAsString();
        log.warn("GoTrue {} failed: status={}, body={}", operation, ex.getStatusCode(), responseBody);

        // Heuristic đơn giản dựa trên substring - tránh phải dùng Jackson parse
        String lower = responseBody.toLowerCase();
        if (lower.contains("user_already_exists") || lower.contains("already registered")) {
            return new BusinessException("EMAIL_ALREADY_EXISTS",
                    "Email này đã được đăng ký", HttpStatus.CONFLICT);
        }
        if (lower.contains("weak_password") || lower.contains("password should be")) {
            return new BusinessException("WEAK_PASSWORD",
                    "Mật khẩu không đáp ứng yêu cầu bảo mật");
        }
        if (lower.contains("email_address_invalid") || lower.contains("invalid email")) {
            return new BusinessException("INVALID_EMAIL", "Email không hợp lệ");
        }

        // Fallback - giữ status code gốc, message generic
        return new BusinessException("AUTH_PROVIDER_ERROR",
                "Yêu cầu xác thực thất bại: " + ex.getStatusText(),
                HttpStatus.valueOf(ex.getStatusCode().value()));
    }

    /** Map 5xx hoặc lỗi mạng → 503 Service Unavailable. */
    private BusinessException mapServerError(Exception ex) {
        log.error("GoTrue server error: {}", ex.getMessage());
        return new BusinessException("AUTH_PROVIDER_UNAVAILABLE",
                "Dịch vụ xác thực tạm thời không khả dụng. Vui lòng thử lại sau.",
                HttpStatus.SERVICE_UNAVAILABLE);
    }
}

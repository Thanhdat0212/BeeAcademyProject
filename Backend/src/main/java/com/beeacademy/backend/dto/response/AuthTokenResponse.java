package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.client.dto.ProviderTokenResponse;

/**
 * Response cho các endpoint phát hành token: login, refresh.
 *
 * <p>Frontend lưu {@code accessToken} (đính kèm vào header Authorization
 * cho mọi request sau) và {@code refreshToken} (để đổi lấy access mới
 * khi hết hạn).
 *
 * @param accessToken  JWT HS256, TTL 1h (mặc định Supabase)
 * @param refreshToken token đổi lấy access_token mới
 * @param expiresIn    số giây còn hiệu lực của access_token
 * @param tokenType    luôn "bearer"
 * @param user         thông tin user
 */
public record AuthTokenResponse(
        String accessToken,
        String refreshToken,
        Integer expiresIn,
        String tokenType,
        UserSummaryResponse user
) {

    /**
     * Map từ response GoTrue. User có thể null trong response refresh -
     * trường hợp đó cần fetch profile riêng nếu frontend cần.
     */
    public static AuthTokenResponse fromProvider(ProviderTokenResponse resp) {
        return new AuthTokenResponse(
                resp.accessToken(),
                resp.refreshToken(),
                resp.expiresIn(),
                resp.tokenType(),
                resp.user() != null ? UserSummaryResponse.fromProvider(resp.user()) : null
        );
    }
}

package com.beeacademy.backend.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Response chuẩn của Supabase GoTrue cho các endpoint phát hành token:
 * <ul>
 *   <li>{@code POST /auth/v1/token?grant_type=password} (login)</li>
 *   <li>{@code POST /auth/v1/token?grant_type=refresh_token} (refresh)</li>
 *   <li>{@code POST /auth/v1/signup} (cũng trả token nếu email confirm tắt)</li>
 * </ul>
 *
 * <p>Snake_case là format gốc Supabase → ta dùng {@link JsonProperty} map
 * sang camelCase Java cho tự nhiên.
 *
 * @param accessToken  JWT HS256 - frontend đính kèm vào header {@code Authorization}
 * @param refreshToken token đổi lấy access_token mới khi hết hạn
 * @param expiresIn    số giây access_token còn sống (Supabase mặc định 3600)
 * @param tokenType    luôn là "bearer"
 * @param user         thông tin user (có thể null cho refresh endpoint)
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ProviderTokenResponse(

        @JsonProperty("access_token")
        String accessToken,

        @JsonProperty("refresh_token")
        String refreshToken,

        @JsonProperty("expires_in")
        Integer expiresIn,

        @JsonProperty("token_type")
        String tokenType,

        ProviderUser user
) {
}

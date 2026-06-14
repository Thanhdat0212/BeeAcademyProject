package com.beeacademy.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

/**
 * Cấu hình {@link RestClient} - HTTP client mà backend dùng để gọi sang
 * Supabase GoTrue API và Supabase Storage API (kiến trúc Hybrid Auth Proxy).
 *
 * <p>Tại sao 1 bean RestClient riêng thay vì xài mặc định:
 * <ul>
 *   <li>Set sẵn base URL = {@code SUPABASE_URL} → service chỉ cần truyền
 *       path tương đối ({@code /auth/v1/signup}), không lặp host.</li>
 *   <li>Set timeout hợp lý (5s connect, 10s read) - Supabase ở Singapore
 *       nên latency ~50-150ms; quá 10s coi như lỗi mạng, fail-fast cho
 *       client biết thay vì treo.</li>
 *   <li>Có chỗ tập trung để sau này thêm interceptor (logging, retry,
 *       circuit breaker) mà không phá code service.</li>
 * </ul>
 */
@Configuration
public class RestClientConfig {

    /**
     * Tạo bean {@code supabaseRestClient}.
     *
     * <p>Lưu ý: KHÔNG hardcode key/token ở đây. Header {@code apikey} và
     * {@code Authorization} sẽ được service tự thêm vào mỗi request tuỳ
     * ngữ cảnh (call public → anon key; call admin → service_role key).
     *
     * @param props cấu hình Supabase (URL, keys) đọc từ application.yml
     * @return RestClient pre-configured với baseUrl + timeout
     */
    @Bean
    public RestClient supabaseRestClient(SupabaseProperties props) {
        // Cấu hình timeout ở mức request factory (áp dụng cho mọi call)
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout((int) Duration.ofSeconds(5).toMillis());
        requestFactory.setReadTimeout((int) Duration.ofSeconds(10).toMillis());

        return RestClient.builder()
                .baseUrl(props.url())   // vd: https://haksqgakssvmlbxtqxir.supabase.co
                .requestFactory(requestFactory)
                .build();
    }
}

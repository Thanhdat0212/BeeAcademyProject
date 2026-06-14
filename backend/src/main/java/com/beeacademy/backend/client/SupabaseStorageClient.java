package com.beeacademy.backend.client;

import com.beeacademy.backend.config.SupabaseProperties;
import com.beeacademy.backend.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Client gọi Supabase Storage REST API để upload/xoá file binary.
 *
 * <p>Triết lý giống {@link SupabaseAuthClient}: KHÔNG biết business, chỉ
 * lo HTTP. Service quyết định path, content type, validate kích thước.
 *
 * <p>Supabase Storage có 2 quyền access:
 * <ul>
 *   <li><b>Public bucket</b>: file được truy cập qua URL không cần token.
 *       Phù hợp cho avatar (cần hiển thị mọi nơi). Bucket {@code avatars}
 *       cần được tạo PUBLIC trên Dashboard.</li>
 *   <li><b>Private bucket</b>: yêu cầu signed URL hoặc auth header.</li>
 * </ul>
 *
 * <p>API endpoints dùng ở đây:
 * <ul>
 *   <li>{@code POST /storage/v1/object/{bucket}/{path}} - upload mới
 *       (lỗi nếu file đã tồn tại).</li>
 *   <li>{@code PUT /storage/v1/object/{bucket}/{path}} - upsert (ghi đè).</li>
 *   <li>Public URL = {@code {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}}</li>
 * </ul>
 *
 * <p>Authentication: dùng {@code service_role_key} (BÍ MẬT) để bypass RLS,
 * vì backend là phía server tin cậy quản lý ai được upload.
 */
@Slf4j
@Component
public class SupabaseStorageClient {

    /** Path base của Storage REST API. */
    private static final String STORAGE_OBJECT_PATH = "/storage/v1/object";
    private static final String STORAGE_PUBLIC_PATH = "/storage/v1/object/public";

    private final RestClient restClient;
    private final String serviceRoleKey;
    private final String supabaseUrl;

    public SupabaseStorageClient(RestClient restClient, SupabaseProperties props) {
        this.restClient = restClient;
        this.serviceRoleKey = props.serviceRoleKey();
        this.supabaseUrl = props.url();
    }

    /**
     * Upload (upsert) một file binary lên bucket Supabase Storage.
     *
     * <p>Dùng {@code PUT} thay vì {@code POST} để ghi đè nếu path đã tồn tại
     * - phù hợp với avatar (mỗi user 1 file, lần upload sau đè lần trước).
     *
     * @param bucket      tên bucket (vd: "avatars")
     * @param objectPath  path trong bucket (vd: "user-id/avatar.jpg")
     * @param contentType MIME type của file (vd: "image/jpeg")
     * @param bytes       nội dung file
     * @return public URL có thể truy cập trực tiếp từ trình duyệt
     */
    public String upload(String bucket, String objectPath, String contentType, byte[] bytes) {
        // Path đầy đủ trong API: /storage/v1/object/{bucket}/{path}
        String uri = STORAGE_OBJECT_PATH + "/" + bucket + "/" + objectPath;

        try {
            restClient.put()
                    .uri(uri)
                    .header("apikey", serviceRoleKey)
                    .header("Authorization", "Bearer " + serviceRoleKey)
                    // Header này yêu cầu Supabase cho phép upsert (ghi đè nếu đã có)
                    .header("x-upsert", "true")
                    .contentType(MediaType.parseMediaType(contentType))
                    .body(bytes)
                    .retrieve()
                    .toBodilessEntity();

            String publicUrl = buildPublicUrl(bucket, objectPath);
            log.info("Đã upload file lên {} ({} bytes) -> {}", uri, bytes.length, publicUrl);
            return publicUrl;

        } catch (HttpClientErrorException ex) {
            throw mapClientError(ex, "upload " + objectPath);
        } catch (RestClientException ex) {
            log.error("Storage server error: {}", ex.getMessage());
            throw new BusinessException("STORAGE_UNAVAILABLE",
                    "Dịch vụ lưu trữ tạm thời không khả dụng. Vui lòng thử lại sau.",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    /**
     * Xoá object khỏi bucket (dùng khi user xoá avatar hoặc cleanup orphan).
     *
     * <p>Silently bỏ qua 404 - object có thể đã bị xoá trước đó, không
     * coi là lỗi.
     */
    public void delete(String bucket, String objectPath) {
        String uri = STORAGE_OBJECT_PATH + "/" + bucket + "/" + objectPath;
        try {
            restClient.delete()
                    .uri(uri)
                    .header("apikey", serviceRoleKey)
                    .header("Authorization", "Bearer " + serviceRoleKey)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Đã xoá object {}/{}", bucket, objectPath);
        } catch (HttpClientErrorException ex) {
            if (ex.getStatusCode() == HttpStatus.NOT_FOUND) {
                log.debug("Object {}/{} đã không tồn tại - bỏ qua", bucket, objectPath);
                return;
            }
            throw mapClientError(ex, "delete " + objectPath);
        } catch (RestClientException ex) {
            log.error("Storage delete error: {}", ex.getMessage());
            // Xoá fail không nên block user - chỉ log
        }
    }

    /**
     * Tạo signed URL tạm thời cho object trong private bucket.
     *
     * <p>Dùng cho video bài giảng — student stream qua URL này, URL hết hạn
     * sau {@code expiresInSeconds} giây (thường 3600 = 1 giờ).
     *
     * <p>Supabase API: {@code POST /storage/v1/object/sign/{bucket}/{path}}
     * Body: {@code {"expiresIn": 3600}}
     * Response: {@code {"signedURL": "/storage/v1/object/sign/..."}}
     *
     * @param bucket          tên bucket private (vd: "course-videos")
     * @param objectPath      path trong bucket (vd: "uuid/uuid/uuid.mp4")
     * @param expiresInSeconds thời gian hiệu lực tính bằng giây
     * @return full signed URL có thể dùng ngay để stream/download
     */
    public String generateSignedUrl(String bucket, String objectPath, int expiresInSeconds) {
        String uri = "/storage/v1/object/sign/" + bucket + "/" + objectPath;
        String requestBody = "{\"expiresIn\":" + expiresInSeconds + "}";

        try {
            // Response dạng: {"signedURL":"/storage/v1/object/sign/bucket/path?token=..."}
            SignedUrlResponse response = restClient.post()
                    .uri(uri)
                    .header("apikey", serviceRoleKey)
                    .header("Authorization", "Bearer " + serviceRoleKey)
                    .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .body(SignedUrlResponse.class);

            if (response == null || response.signedURL() == null) {
                throw new BusinessException("SIGNED_URL_FAILED",
                        "Không thể tạo đường dẫn xem video. Vui lòng thử lại.");
            }
            // Supabase trả về path dạng "/object/sign/..." (thiếu /storage/v1/ prefix)
            // URL đúng phải là: {supabaseUrl}/storage/v1/object/sign/...
            String signedPath = response.signedURL();
            if (signedPath.startsWith("http")) return signedPath;
            if (!signedPath.startsWith("/storage/v1")) {
                signedPath = "/storage/v1" + signedPath;
            }
            return supabaseUrl + signedPath;

        } catch (org.springframework.web.client.HttpClientErrorException ex) {
            throw mapClientError(ex, "sign " + objectPath);
        } catch (org.springframework.web.client.RestClientException ex) {
            log.error("Lỗi khi tạo signed URL: {}", ex.getMessage());
            throw new BusinessException("SIGNED_URL_FAILED",
                    "Không thể tạo đường dẫn xem video. Vui lòng thử lại.");
        }
    }

    /** DTO nội bộ để parse response signed URL từ Supabase. */
    private record SignedUrlResponse(String signedURL) {}

    /**
     * Build public URL theo format chuẩn của Supabase Storage cho bucket public.
     */
    private String buildPublicUrl(String bucket, String objectPath) {
        return supabaseUrl + STORAGE_PUBLIC_PATH + "/" + bucket + "/" + objectPath;
    }

    /** Map 4xx của Storage → BusinessException. */
    private BusinessException mapClientError(HttpClientErrorException ex, String operation) {
        log.warn("Supabase Storage {} failed: status={}, body={}",
                operation, ex.getStatusCode(), ex.getResponseBodyAsString());

        if (ex.getStatusCode() == HttpStatus.NOT_FOUND) {
            return new BusinessException("BUCKET_NOT_FOUND",
                    "Bucket lưu trữ không tồn tại. Vui lòng kiểm tra cấu hình Supabase.",
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }
        if (ex.getStatusCode() == HttpStatus.PAYLOAD_TOO_LARGE) {
            return new BusinessException("FILE_TOO_LARGE",
                    "File vượt quá giới hạn dung lượng cho phép");
        }
        return new BusinessException("STORAGE_ERROR",
                "Tải file lên thất bại: " + ex.getStatusText(),
                HttpStatus.valueOf(ex.getStatusCode().value()));
    }
}

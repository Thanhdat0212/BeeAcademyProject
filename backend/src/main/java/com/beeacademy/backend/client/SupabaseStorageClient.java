package com.beeacademy.backend.client;

import com.beeacademy.backend.config.SupabaseProperties;
import com.beeacademy.backend.exception.BusinessException;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

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
        return uploadBody(bucket, objectPath, contentType, bytes, bytes.length);
    }

    public String upload(String bucket, String objectPath, String contentType,
                         Resource resource, long contentLength) {
        return uploadBody(bucket, objectPath, contentType, resource, contentLength);
    }

    /** Đọc binary object để backend watermark PDF trước khi cấp quyền tải. */
    public byte[] download(String bucket, String objectPath) {
        String uri = STORAGE_OBJECT_PATH + "/" + bucket + "/" + objectPath;
        try {
            byte[] body = restClient.get()
                    .uri(uri)
                    .header("apikey", serviceRoleKey)
                    .header("Authorization", "Bearer " + serviceRoleKey)
                    .retrieve()
                    .body(byte[].class);
            if (body == null) {
                throw new BusinessException("DOCUMENT_UNAVAILABLE", "Tệp tạm thời không khả dụng.");
            }
            return body;
        } catch (HttpClientErrorException ex) {
            throw mapClientError(ex, "download " + objectPath);
        } catch (RestClientException ex) {
            throw new BusinessException("DOCUMENT_UNAVAILABLE",
                    "Tệp tạm thời không khả dụng.", HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    private String uploadBody(String bucket, String objectPath, String contentType,
                              Object body, long contentLength) {
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
                    .contentLength(contentLength)
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();

            String publicUrl = buildPublicUrl(bucket, objectPath);
            log.info("Đã upload file lên {} ({} bytes) -> {}", uri, contentLength, publicUrl);
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

    /** Signed URL tai file kem Content-Disposition download va ten file theo nghiep vu. */
    public String generateSignedDownloadUrl(String bucket, String objectPath,
                                            int expiresInSeconds, String filename) {
        String signedUrl = generateSignedUrl(bucket, objectPath, expiresInSeconds);
        if (filename == null || filename.isBlank()) return signedUrl;
        String separator = signedUrl.contains("?") ? "&" : "?";
        return signedUrl + separator + "download="
                + URLEncoder.encode(filename, StandardCharsets.UTF_8);
    }

    /**
     * Xin Supabase cấp URL cho phép browser upload THẲNG lên bucket, bỏ qua backend.
     *
     * <p>Backend không còn là ống dẫn cho file 2GB: nó chỉ ký một URL dùng một lần
     * rồi trả về, còn luồng byte đi trực tiếp từ máy giáo viên tới Supabase.
     * Token do Supabase phát hành gắn chặt với {@code objectPath} nên client
     * không thể ghi sang path khác.
     *
     * <p>Supabase API: {@code POST /storage/v1/object/upload/sign/{bucket}/{path}}
     * Response: {@code {"url": "/object/upload/sign/bucket/path?token=..."}}
     *
     * @return URL tuyệt đối để client {@code PUT} nội dung file lên
     */
    public String createSignedUploadUrl(String bucket, String objectPath) {
        String uri = "/storage/v1/object/upload/sign/" + bucket + "/" + objectPath;
        try {
            SignedUploadUrlResponse response = restClient.post()
                    .uri(uri)
                    .header("apikey", serviceRoleKey)
                    .header("Authorization", "Bearer " + serviceRoleKey)
                    .retrieve()
                    .body(SignedUploadUrlResponse.class);

            if (response == null || response.url() == null) {
                throw new BusinessException("SIGNED_UPLOAD_FAILED",
                        "Không thể tạo đường dẫn tải lên. Vui lòng thử lại.");
            }
            String signedPath = response.url();
            if (signedPath.startsWith("http")) return signedPath;
            if (!signedPath.startsWith("/storage/v1")) {
                signedPath = "/storage/v1" + signedPath;
            }
            return supabaseUrl + signedPath;

        } catch (HttpClientErrorException ex) {
            throw mapClientError(ex, "sign upload " + objectPath);
        } catch (RestClientException ex) {
            log.error("Lỗi khi tạo signed upload URL: {}", ex.getMessage());
            throw new BusinessException("SIGNED_UPLOAD_FAILED",
                    "Dịch vụ lưu trữ tạm thời không khả dụng. Vui lòng thử lại sau.",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    /**
     * Đọc metadata thật của object đã nằm trên Storage (size + MIME).
     *
     * <p>Cần thiết vì với direct upload, kích thước và content type mà client
     * khai báo lúc xin chữ ký chỉ là lời khai — backend phải hỏi lại Supabase
     * trước khi ghi nhận vào DB.
     *
     * <p>Dùng endpoint list thay vì info vì list ổn định qua các phiên bản
     * storage-api và trả thẳng khối {@code metadata}.
     *
     * @return metadata của object, hoặc {@code null} nếu object không tồn tại
     */
    public ObjectStat statObject(String bucket, String objectPath) {
        int lastSlash = objectPath.lastIndexOf('/');
        String prefix   = lastSlash < 0 ? "" : objectPath.substring(0, lastSlash);
        String filename = lastSlash < 0 ? objectPath : objectPath.substring(lastSlash + 1);

        String uri = "/storage/v1/object/list/" + bucket;
        try {
            ListedObject[] items = restClient.post()
                    .uri(uri)
                    .header("apikey", serviceRoleKey)
                    .header("Authorization", "Bearer " + serviceRoleKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(new ListRequest(prefix, filename, 100, 0))
                    .retrieve()
                    .body(ListedObject[].class);

            if (items == null) return null;
            for (ListedObject item : items) {
                if (filename.equals(item.name()) && item.metadata() != null) {
                    return new ObjectStat(item.metadata().size(), item.metadata().mimetype());
                }
            }
            return null;

        } catch (HttpClientErrorException ex) {
            throw mapClientError(ex, "stat " + objectPath);
        } catch (RestClientException ex) {
            log.error("Lỗi khi đọc metadata object {}/{}: {}", bucket, objectPath, ex.getMessage());
            throw new BusinessException("STORAGE_UNAVAILABLE",
                    "Dịch vụ lưu trữ tạm thời không khả dụng. Vui lòng thử lại sau.",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    /** Metadata tối thiểu của một object trên Storage. */
    public record ObjectStat(Long size, String mimetype) {}

    /** DTO nội bộ để parse response signed URL từ Supabase. */
    private record SignedUrlResponse(String signedURL) {}

    /** DTO nội bộ để parse response signed UPLOAD URL từ Supabase. */
    private record SignedUploadUrlResponse(String url) {}

    private record ListRequest(String prefix, String search, int limit, int offset) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record ListedObject(String name, ObjectMetadata metadata) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record ObjectMetadata(Long size, String mimetype) {}

    /** Public URL của object đã có sẵn trên bucket public (client tự upload, không qua backend). */
    public String publicUrl(String bucket, String objectPath) {
        return buildPublicUrl(bucket, objectPath);
    }

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

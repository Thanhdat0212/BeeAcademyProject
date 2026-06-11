package com.beeacademy.backend.controller;

import com.beeacademy.backend.service.OrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/webhooks")
@RequiredArgsConstructor
@Slf4j
public class PayOSWebhookController {

    private final OrderService orderService;

    @Value("${payos.checksum-key}")
    private String checksumKey;

    @Value("${app.dev-mode:false}")
    private boolean devMode;

    // PayOS SDK v1.0.2 chỉ dùng đúng 9 fields này để tính chữ ký webhook
    private static final List<String> SIG_FIELDS = List.of(
        "accountNumber", "amount", "code", "desc", "description",
        "orderCode", "paymentLinkId", "reference", "transactionDateTime"
    );

    @PostMapping("/payos")
    public ResponseEntity<Map<String, Object>> handlePayOSWebhook(
            @RequestBody Map<String, Object> body) {

        log.info("PayOS webhook raw body keys: {}", body.keySet());

        try {
            String signature = (String) body.get("signature");
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) body.get("data");

            if (data != null) {
                log.info("PayOS webhook data fields: {}", data.entrySet().stream()
                    .map(e -> e.getKey() + "(" + (e.getValue() == null ? "null" : e.getValue().getClass().getSimpleName()) + ")=" + e.getValue())
                    .collect(Collectors.joining(", ")));
            }

            if (data == null || signature == null) {
                log.warn("PayOS webhook: thiếu data hoặc signature");
                return ok();
            }

            // Chỉ dùng 9 fields mà PayOS SDK dùng để tính signature, bỏ qua các fields thừa
            TreeMap<String, String> sigMap = new TreeMap<>();
            for (String field : SIG_FIELDS) {
                Object val = data.get(field);
                if (val != null) sigMap.put(field, String.valueOf(val));
            }
            String dataString = sigMap.entrySet().stream()
                .map(e -> e.getKey() + "=" + e.getValue())
                .collect(Collectors.joining("&"));

            String computed = computeHmac(dataString);
            boolean sigValid = computed.equalsIgnoreCase(signature);

            log.info("PayOS webhook sigData  : {}", dataString);
            log.info("PayOS webhook received : {}", signature);
            log.info("PayOS webhook computed : {}", computed);
            log.info("PayOS webhook sig valid: {}", sigValid);

            if (!sigValid) {
                if (devMode) {
                    // ⚠️ CẢNH BÁO SECURITY: DEV_MODE=true bypass toàn bộ xác thực chữ ký.
                    // Nếu vô tình deploy lên production với cờ này, bất kỳ HTTP request nào
                    // đến /api/webhooks/payos cũng được xử lý như webhook hợp lệ → có thể
                    // fake thanh toán mà không cần key thật.
                    // Đảm bảo DEV_MODE=false trong backend/.env khi deploy production.
                    log.warn("PayOS webhook: chữ ký không khớp — BỎ QUA kiểm tra vì DEV_MODE=true");
                } else {
                    log.warn("PayOS webhook: chữ ký không hợp lệ, bỏ qua");
                    return ok();
                }
            }

            String code = (String) data.get("code");
            Object orderCodeObj = data.get("orderCode");

            // Bảo vệ NPE: PayOS có thể gửi webhook test/ping không có field orderCode.
            // Trường hợp đó bỏ qua luôn thay vì để NullPointerException bị catch phía ngoài.
            if (orderCodeObj == null) {
                log.info("PayOS webhook: không có orderCode (có thể là ping), bỏ qua.");
                return ok();
            }

            long orderCode = ((Number) orderCodeObj).longValue();

            log.info("PayOS webhook: orderCode={} code={}", orderCode, code);

            if ("00".equals(code)) {
                orderService.handlePayOSWebhook(orderCode);
            }

        } catch (Exception e) {
            log.error("PayOS webhook xử lý lỗi: {}", e.getMessage(), e);
        }

        return ok();
    }

    private String computeHmac(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(checksumKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            log.error("HMAC compute lỗi: {}", e.getMessage());
            return "";
        }
    }

    private ResponseEntity<Map<String, Object>> ok() {
        return ResponseEntity.ok(Map.of("error", 0, "message", "success"));
    }
}

package com.beeacademy.backend.security;

import org.springframework.stereotype.Component;

import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Cache in-memory cho role của user, dùng bởi {@code JwtAuthenticationFilter}.
 *
 * <p><b>Tại sao cần cache?</b><br>
 * Filter đọc role từ DB ở MỌI request đã đăng nhập để quyền hạn mới có hiệu
 * lực ngay (xem javadoc {@code buildAuthenticatedUser}). Nhưng DB Supabase đặt
 * ở region xa (~200ms round-trip), nghĩa là mỗi request cõng thêm ~200ms chỉ
 * cho một câu SELECT role gần như không bao giờ đổi. Cache TTL ngắn giữ được
 * cả hai: request nhanh, và role mới vẫn áp dụng trong tối đa {@link #TTL_MS}.
 *
 * <p>Khi Admin đổi role, {@code AdminUserController} gọi {@link #evict(UUID)}
 * để user đó nhận role mới ngay lập tức, không cần chờ hết TTL.
 *
 * <p>Không dùng thư viện cache ngoài (Caffeine...) — theo quy tắc không thêm
 * dependency khi stack hiện tại làm được; map này chỉ giữ tối đa vài nghìn
 * entry nhỏ (UUID + String).
 */
@Component
public class UserRoleCache {

    /** 60s: đủ ngắn để đổi role trên node khác cũng có hiệu lực nhanh. */
    private static final long TTL_MS = 60_000L;

    /** Chặn map phình vô hạn nếu có lượng user lớn truy cập dồn dập. */
    private static final int MAX_ENTRIES = 10_000;

    private record Entry(String role, long expiresAtMs) {}

    private final ConcurrentHashMap<UUID, Entry> cache = new ConcurrentHashMap<>();

    /** Trả về role đã cache, hoặc {@code null} nếu chưa có / đã hết hạn. */
    public String get(UUID userId) {
        Entry entry = cache.get(userId);
        if (entry == null) {
            return null;
        }
        if (System.currentTimeMillis() > entry.expiresAtMs()) {
            cache.remove(userId, entry);
            return null;
        }
        return entry.role();
    }

    public void put(UUID userId, String role) {
        if (role == null) {
            return;
        }
        if (cache.size() >= MAX_ENTRIES) {
            evictExpired();
            // Vẫn đầy sau khi dọn (toàn entry còn sống) → bỏ qua lần put này,
            // request chỉ chậm hơn chứ không sai; tránh xoá entry đang dùng.
            if (cache.size() >= MAX_ENTRIES) {
                return;
            }
        }
        cache.put(userId, new Entry(role, System.currentTimeMillis() + TTL_MS));
    }

    /** Gọi khi role của user thay đổi để hiệu lực ngay, không chờ TTL. */
    public void evict(UUID userId) {
        cache.remove(userId);
    }

    private void evictExpired() {
        long now = System.currentTimeMillis();
        cache.entrySet().removeIf(e -> now > e.getValue().expiresAtMs());
    }
}

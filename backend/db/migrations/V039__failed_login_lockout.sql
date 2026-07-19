-- REQ-AUTH-002: khóa tạm 15 phút sau 5 lần đăng nhập sai liên tiếp trong 15
-- phút, tách biệt hoàn toàn với is_blocked (khóa vĩnh viễn do Admin thao tác).

ALTER TABLE profiles
    ADD COLUMN failed_login_attempts INT NOT NULL DEFAULT 0,
    ADD COLUMN last_failed_login_at TIMESTAMPTZ,
    ADD COLUMN failed_login_lock_until TIMESTAMPTZ;

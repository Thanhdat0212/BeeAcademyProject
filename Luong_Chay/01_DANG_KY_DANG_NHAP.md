# Luồng Đăng ký / Đăng nhập — UC01–UC04

Trạng thái: ✅ Đã triển khai đầy đủ

---

## 1. Đăng ký có OTP (luồng chính — UC01)

```
Người dùng điền form đăng ký (email, mật khẩu, họ tên, vai trò)
    │
    ▼
FE: POST /api/auth/register/request-otp
    Body: { email, fullName, role: "student"|"parent"|"teacher" }
    │
    ▼
AuthController → AuthService.requestOtp()
    ├── Validate role: chỉ cho "student", "parent", "teacher" (chặn "admin")
    ├── OtpService.send(email, fullName, role)
    │       ├── Sinh mã 6 số ngẫu nhiên (SecureRandom)
    │       ├── Lưu vào ConcurrentHashMap: { email → {fullName, role, code, expiresAt} }
    │       │   TTL: 5 phút (300 giây)
    │       └── Gửi email HTML qua JavaMailSender (SMTP Gmail)
    │           DEV_MODE=true: nếu SMTP lỗi → swallow exception, log OTP ra console
    └── Trả 200: "Mã OTP đã được gửi đến {email}. Hiệu lực 5 phút."
    │
    ▼
Người dùng nhập mã OTP nhận qua email
    │
    ▼
FE: POST /api/auth/register/verify-otp
    Body: { email, otp, password }
    │
    ▼
AuthService.verifyOtpAndRegister()
    ├── OtpService.verify(email, otp)
    │       ├── Tìm entry trong store theo email
    │       ├── Kiểm tra hết hạn → ném OTP_EXPIRED nếu quá 5 phút
    │       └── So sánh mã → ném OTP_INVALID nếu sai
    ├── authProviderClient.signUp(email, password, {role, full_name})
    │       → Gọi Supabase GoTrue: POST /auth/v1/admin/users
    │       → Supabase tạo auth.users row + trả UUID mới
    ├── Profile.createNew(authUserId, role, fullName)
    │       → INSERT vào bảng public.profiles
    ├── OtpService.consume(email) → xóa OTP khỏi store (single-use)
    └── Trả UserSummaryResponse { id, email, fullName, role }
    │
    ▼
FE nhận thông báo thành công → redirect /login
```

**Lưu ý:**
- OTP lưu in-memory (ConcurrentHashMap) — restart server sẽ mất tất cả OTP đang chờ
- Production nên chuyển sang Redis
- Email thực cần Gmail App Password (hiện đang dùng DEV_MODE=true)

---

## 2. Đăng ký trực tiếp (không OTP)

```
FE: POST /api/auth/register
    Body: { email, password, fullName, role }
    │
    ▼
AuthService.register()
    ├── Validate role (không cho admin)
    ├── authProviderClient.signUp() → Supabase tạo user
    ├── Profile.createNew() → INSERT profiles
    └── Trả UserSummaryResponse (KHÔNG có token — cần xác thực email trước)
```

---

## 3. Đăng nhập email/mật khẩu (UC02)

```
Người dùng nhập email + mật khẩu
    │
    ▼
FE: Login.tsx → authService.login({ email, password })
    │
    ▼
POST /api/auth/login
    │
    ▼
AuthService.login()
    └── authProviderClient.signInWithPassword(email, password)
            → Gọi Supabase GoTrue: POST /auth/v1/token?grant_type=password
            → Supabase xác thực → trả { access_token, refresh_token, expires_in }
    └── enrichAuthTokenResponse(tokens)
            → Đọc thêm thông tin profile từ DB (fullName, avatarUrl, role)
            → Build AuthTokenResponse { accessToken, refreshToken, user: UserSummary }
    │
    ▼
FE nhận AuthTokenResponse
    └── useAuthStore.loginWithTokens(payload)
            → Lưu accessToken, refreshToken, user vào Zustand
            → persist middleware → ghi vào localStorage key "bee-academy-auth"
    └── Redirect theo role:
            student  → /courses
            teacher  → /teacher
            admin    → /admin
            parent   → /parent
```

**Lưu ý interceptor:**
Mọi request sau đó từ `apiClient` đều tự gắn header:
```
Authorization: Bearer {accessToken}
```

---

## 4. Đăng xuất (UC03)

```
User click "Đăng xuất"
    │
    ▼
FE: authService.logout()
    └── POST /api/auth/logout
        Header: Authorization: Bearer {accessToken}
    │
    ▼
AuthController.logout()
    ├── CurrentUser.required() → verify JWT hợp lệ (ném 401 nếu không)
    ├── Lấy raw token từ header Authorization
    └── authService.logout(token)
            → authProviderClient.signOut(token)
            → Gọi Supabase GoTrue: POST /auth/v1/logout
            → Supabase revoke refresh_token (invalidate session)
    │
    ▼
FE: useAuthStore.logout()
    → Xóa toàn bộ state: isLoggedIn=false, user=null, tokens=null
    → localStorage cũng bị xóa (persist middleware)
    → Redirect /login
```

---

## 5. Làm mới token (Token Refresh)

```
Khi accessToken hết hạn (Supabase: ~1 giờ):
    │
    ▼
Axios interceptor response: nhận 401
    └── POST /api/auth/refresh
        Body: { refreshToken }
        │
        ▼
AuthService.refresh(refreshToken)
    └── authProviderClient.refreshToken(refreshToken)
            → Supabase: POST /auth/v1/token?grant_type=refresh_token
            → Trả access_token mới + refresh_token mới (rotation)
    │
    ▼
FE cập nhật accessToken mới vào Zustand + localStorage
    → Retry request ban đầu với token mới
```

---

## 6. Quên mật khẩu — luồng OTP (UC04)

```
FE: POST /api/auth/reset-password/request-otp
    Body: { email }
    │
    ▼
AuthService.requestPasswordResetOtp(email)
    └── OtpService.sendResetOtp(email) → gửi OTP reset qua email
    └── Trả 200: "Mã OTP phục hồi mật khẩu đã được gửi..."
    │
    ▼
User nhập OTP + mật khẩu mới
    │
    ▼
FE: POST /api/auth/reset-password/verify-otp
    Body: { email, otp, newPassword }
    │
    ▼
AuthService.verifyOtpAndResetPassword()
    ├── OtpService.verify(email, otp) → validate OTP
    ├── authProviderClient.updateUserPassword(email, newPassword)
    │       → Supabase Admin API: PATCH /auth/v1/admin/users/{userId}
    └── OtpService.consume(email) → xóa OTP
    └── Trả 200: "Đặt lại mật khẩu thành công!"
```

**Lưu ý bảo mật:**
Response luôn chung chung "Nếu email tồn tại..." — tránh enumeration attack (kẻ tấn công không biết email có trong hệ thống không).

---

## 7. Đăng nhập Google OAuth

```
User click "Tiếp tục với Google"
    │
    ▼
FE Login.tsx: window.location.href = buildGoogleOAuthUrl()
    → URL: {SUPABASE_URL}/auth/v1/authorize
          ?provider=google
          &redirect_to=http://localhost:3000/auth/callback
    │
    ▼
Google hiển thị consent screen
    │
    ▼ (user đồng ý)
    │
Supabase xử lý OAuth callback từ Google
    → Tạo/cập nhật user trong auth.users
    → Redirect về: http://localhost:3000/auth/callback#access_token=...&refresh_token=...
    │
    ▼
FE: OAuthCallbackPage.tsx nhận hash từ URL
    ├── Parse: access_token, refresh_token từ window.location.hash
    │
    │   [QUAN TRỌNG] Dùng axios.create() riêng biệt — KHÔNG dùng apiClient
    │   Lý do: apiClient có interceptor tự gắn token từ Zustand store cũ
    │           → nếu còn session cũ sẽ ghi đè token OAuth mới → backend nhận JWT cũ → 401
    │
    ├── POST /api/auth/oauth/sync
    │       Header: Authorization: Bearer {accessToken OAuth mới}
    │       Body: { fullName, avatarUrl } (từ Google profile)
    │   │
    │   ▼
    │   AuthController.syncOAuth()
    │       ├── CurrentUser.required() → verify JWT ES256 từ Supabase
    │       ├── AuthService.syncOAuthProfile(me, request)
    │       │       ├── Tìm profile theo userId trong DB
    │       │       ├── Nếu chưa có → Profile.createNew(userId, STUDENT, fullName)
    │       │       │   [Idempotent: Google user không cần đăng ký trước]
    │       │       ├── Nếu đã có → cập nhật avatarUrl nếu chưa có ảnh
    │       │       └── Trả UserSummaryResponse
    │       └── Trả ApiResponse<UserSummaryResponse>
    │
    ├── FE: useAuthStore.loginWithTokens(payload)
    │       → Lưu tokens + user vào Zustand + localStorage
    │
    └── Redirect /courses
```

# Luồng Hồ Sơ Cá Nhân — UC05

Trạng thái: ✅ Đã triển khai đầy đủ

---

## 1. Xem hồ sơ

```
User vào /profile
    │
    ▼
ProfilePage.tsx mount
    └── GET /api/me
        Header: Authorization: Bearer {accessToken}
        │
        ▼
    ProfileController.getMyProfile()
        ├── AuthenticatedUser me = CurrentUser.required() → ném 401 nếu không có JWT
        └── ProfileService.getCurrentProfile(me)
                └── profileRepository.findById(me.userId())
                        → SELECT * FROM profiles WHERE id = {userId}
                        → ném ResourceNotFoundException (404) nếu chưa có profile
                └── ProfileResponse.fromEntity(profile, me.email())
                        → { id, email, fullName, phone, bio,
                            twitterUrl, facebookUrl, linkedinUrl,
                            avatarUrl, role, createdAt }
    │
    ▼
ProfilePage render form với dữ liệu từ API
```

---

## 2. Cập nhật hồ sơ

```
User sửa thông tin → click "Lưu thay đổi"
    │
    ▼
ProfilePage.tsx
    └── PUT /api/me
        Header: Authorization: Bearer {accessToken}
        Body: { fullName, phone, bio, twitterUrl, facebookUrl, linkedinUrl }
        │
        ▼
    ProfileController.updateMyProfile()
        └── ProfileService.updateProfile(me, request)
                ├── Tải profile từ DB
                ├── profile.updatePersonalInfo(fullName, phone, bio, ...)
                │       Invariant: fullName sau trim không được rỗng
                │       null field = giữ nguyên giá trị cũ (partial update)
                └── profileRepository.save(profile)
                        → UPDATE profiles SET ... WHERE id = {userId}
    │
    ▼
FE: useAuthStore.updateUser({ name: fullName, avatar: avatarUrl })
    → Cập nhật Zustand (Header dropdown cập nhật tên ngay)
    → Toast: "Cập nhật hồ sơ thành công"
```

---

## 3. Đổi mật khẩu

```
User nhập mật khẩu hiện tại + mật khẩu mới → click "Đổi mật khẩu"
    │
    ▼
AccountPage.tsx
    └── POST /api/auth/change-password
        Header: Authorization: Bearer {accessToken}
        Body: { currentPassword, newPassword }
        │
        ▼
    AuthController.changePassword()
        ├── AuthenticatedUser me = CurrentUser.required()
        ├── Lấy raw accessToken từ header Authorization
        └── AuthService.changePassword(token, me.email, request)
                ├── Bước 1: Xác minh mật khẩu hiện tại
                │       authProviderClient.signInWithPassword(me.email, currentPassword)
                │       → Nếu sai → Supabase ném lỗi → 401 INVALID_CREDENTIALS
                ├── Bước 2: Đổi mật khẩu mới
                │       authProviderClient.updateUserPassword(token, newPassword)
                │       → Supabase Admin API: PATCH /auth/v1/user
                └── Trả 200: "Đổi mật khẩu thành công"
    │
    ▼
FE: Toast thành công → Form reset
```

---

## 4. Upload ảnh đại diện

```
User vào /account/photo → chọn file ảnh → click "Lưu"
    │
    ▼
AvatarPage.tsx
    └── POST /api/me/avatar
        Header: Authorization: Bearer {accessToken}
        Body: multipart/form-data { file: <binary> }
        │
        ▼
    ProfileController.uploadAvatar()
        └── ProfileService.uploadAvatar(me, file)
                │
                ├── Validate file:
                │       MIME: image/jpeg | image/png | image/webp  (không nhận gif, bmp...)
                │       Size: ≤ 2MB (MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024)
                │       → ném BusinessException nếu vi phạm
                │
                ├── Build storage path:
                │       {userId}/{timestamp}.{ext}
                │       VD: "abc-123-uuid/1717123456789.jpg"
                │       KHÔNG dùng tên file gốc (ngăn path traversal)
                │
                ├── SupabaseStorageClient.upload(
                │       bucket = "avatars",        ← PUBLIC bucket
                │       path   = "{userId}/{ts}.jpg",
                │       contentType = "image/jpeg",
                │       bytes  = file.getBytes()
                │   )
                │   → PUT {SUPABASE_URL}/storage/v1/object/avatars/{path}
                │   → Header: apikey + Authorization: Bearer {serviceRoleKey}
                │   → Header: x-upsert: true  (ghi đè nếu đã có)
                │   → Trả publicUrl = {SUPABASE_URL}/storage/v1/object/public/avatars/{path}
                │
                ├── profile.changeAvatar(publicUrl)
                │   → UPDATE profiles SET avatar_url = '{publicUrl}' WHERE id = {userId}
                │
                └── Trả ProfileResponse kèm avatarUrl mới
    │
    ▼
FE: useAuthStore.updateUser({ avatar: newAvatarUrl })
    → Avatar trong Header dropdown cập nhật ngay
    → Toast: "Cập nhật ảnh đại diện thành công"
```

**Sơ đồ lưu trữ avatar:**
```
Supabase Storage
└── bucket: avatars  (PUBLIC — URL không cần token)
    └── {userId}/
        ├── 1717100000000.jpg   ← ảnh cũ (vẫn còn trên Storage)
        └── 1717200000000.jpg   ← ảnh mới (x-upsert ghi đè nếu cùng path)
```

**Lưu ý:** Hiện tại mỗi lần upload tạo file mới (timestamp khác nhau) → Storage tích lũy file cũ.
Production nên thêm bước xóa file cũ trước khi upload: `SupabaseStorageClient.delete(bucket, oldPath)`.

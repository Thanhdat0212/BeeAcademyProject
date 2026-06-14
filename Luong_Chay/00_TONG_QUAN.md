# Tổng quan luồng hệ thống — Bee Academy

Cập nhật: 2026-05-30

---

## Bản đồ các luồng

| File | Luồng | Trạng thái |
|---|---|---|
| `01_DANG_KY_DANG_NHAP.md` | Đăng ký OTP, Đăng nhập, Quên mật khẩu, Google OAuth | ✅ Đã triển khai |
| `02_XEM_KHOA_HOC.md` | Duyệt khóa học, Xem chi tiết, Phân quyền video | ✅ Đã triển khai |
| `03_HO_SO_CA_NHAN.md` | Xem/sửa hồ sơ, Đổi mật khẩu, Upload avatar | ✅ Đã triển khai |
| `04_PHU_HUYNH.md` | Xem danh sách con, Gỡ liên kết, Báo cáo tiến độ | ✅ Backend xong / FE skeleton |
| `05_MUA_HANG.md` | Giỏ hàng, Checkout, Enrollment | ⏳ Chưa triển khai (Mock) |
| `06_GIAO_VIEN_DANG_KHOA_HOC.md` | Tạo khóa, Upload video/tài liệu, Nộp duyệt | ⏳ Kế hoạch Phase 1-2 |
| `07_DUYET_KHOA_HOC.md` | Admin duyệt / từ chối / yêu cầu sửa | ⏳ Kế hoạch Phase 3 |
| `08_NGAN_HANG_CAU_HOI.md` | CRUD câu hỏi, Ngân hàng câu hỏi theo chương/môn | ⏳ Kế hoạch Phase 4 |
| `09_QUIZ_KIEM_TRA.md` | Cấu hình quiz, Randomize, Làm bài, Chấm điểm | ⏳ Kế hoạch Phase 5-6 |
| `10_SECURITY_JWT.md` | JWT verification, ES256 vs HS256, Role guard | ✅ Đã triển khai (Cross-cutting) |

---

## Kiến trúc tổng thể

```
Browser (React 19 + Vite)
    │
    │  Axios + Bearer Token (localStorage)
    │
    ▼
Spring Boot 3.2 (port 8080)
    ├── JwtAuthenticationFilter  ← verify ES256 (Supabase) / HS256 fallback
    ├── SecurityConfig           ← whitelist public routes
    ├── Controller (thin)        ← bind DTO, gọi service, wrap ApiResponse
    ├── Service (business logic) ← validate, transform, orchestrate
    └── Repository (JPA)         ← query PostgreSQL
    │
    ├── Supabase GoTrue (Auth)   ← signUp / signIn / signOut / refresh
    ├── Supabase Storage         ← avatars (public) / course-videos (private) / course-docs (public)
    └── Supabase PostgreSQL      ← profiles, courses, chapters, lessons, enrollments, ...
```

---

## Quy ước chung

- **✅** = luồng đã hoạt động end-to-end
- **⚠️** = hoạt động nhưng có giới hạn / dùng data mock
- **⏳** = chưa triển khai, có kế hoạch
- **❌** = bug đã biết

Mọi response backend đều bọc trong:
```json
{ "success": true, "message": "...", "data": {...}, "timestamp": "..." }
```

Lỗi trả về:
```json
{ "success": false, "code": "ERROR_CODE", "message": "...", "fieldErrors": [...] }
```

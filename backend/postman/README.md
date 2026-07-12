# Test API Bee Academy bằng Postman

Các file trong thư mục này import thẳng vào Postman:

- `BeeAcademy.postman_collection.json` — bộ request (4 thư mục: Public, Đăng nhập tự động, Phân quyền, Thủ công)
- `dev.postman_environment.json` — **environment DEV** (backend local `:8080`) ← dùng mặc định
- `staging.postman_environment.json` — **environment STAGING** (đổi `baseUrl` khi có server staging)
- `BeeAcademy.Local.postman_environment.json` — env local cá nhân (tuỳ chọn)

## Môi trường (dev / staging)

| Environment | baseUrl | Khi nào dùng |
|---|---|---|
| **BeeAcademy.Dev** | `http://localhost:8080` | Chạy backend ở máy mình |
| **BeeAcademy.Staging** | `https://staging-api...` (sửa lại) | Khi có server staging chung |

Mọi biến **secret** (`token`, `refreshToken`, `testPassword`, `myPassword`, `runPassword`) để **rỗng** trong file —
điền tay trong Postman lúc chạy, **KHÔNG commit mật khẩu thật vào file**. `token`/`refreshToken`/`courseId`
được collection **tự lưu** sau khi đăng nhập (không cần điền tay).

## Chuẩn bị 1 lần

1. Chạy backend: trong `backend/` chạy `mvn spring-boot:run`, đợi log `Started BeeAcademyApplication ... 8080`.
2. Mở Postman → **Import** → kéo `BeeAcademy.postman_collection.json` + `dev.postman_environment.json` vào.
3. Góc trên phải, chọn environment **BeeAcademy.Dev**.
4. (Tuỳ chọn) để chạy folder "Thủ công" cần đăng nhập tài khoản thật: điền `myEmail` + `myPassword` trong tab **Environment** (không lưu vào file).

> ⚠️ Bản này đã sửa một bug backend (query đánh giá làm `/api/courses` lỗi 500).
> **Phải khởi động lại backend** (tắt rồi chạy lại `mvn spring-boot:run`) thì `/api/courses` mới trả 200.

## Cách chạy cho TẤT CẢ XANH (không cần OTP, không thao tác tay)

1. Cột trái, di chuột vào collection **Bee Academy API** → bấm **Run** (biểu tượng ▶) → mở **Collection Runner**.
2. Tích chọn 3 thư mục **0, 1, 2** (bỏ qua thư mục 3 — phần học tay).
3. Bấm **Run Bee Academy API**.
4. Kết quả: **tất cả test PASS (xanh)**.

Vì sao xanh tự động: thư mục **1** tạo tài khoản mới bằng email ngẫu nhiên qua `POST /api/auth/register`
(Supabase tạo sẵn `email_confirm=true` → đăng nhập được ngay), tự lưu token, rồi gọi các API cần đăng nhập.
Không cần nhập OTP, không cần tài khoản có sẵn.

## Các thư mục

| Thư mục | Nội dung | Chạy Runner |
|---|---|---|
| **0. Public** | health, danh sách/chi tiết khóa học, danh mục | ✅ xanh |
| **1. Đăng nhập tự động** | đăng ký nhanh → đăng nhập → refresh → hồ sơ → khóa học đã mua | ✅ xanh |
| **2. Kiểm tra phân quyền** | token student bị chặn khỏi API teacher/admin (mong đợi 401/403) | ✅ xanh |
| **3. Thủ công (OTP)** | đăng ký bằng OTP, đổi mật khẩu, đăng xuất | Chạy tay từng request |

## Thư mục 3 — học thêm về OTP (chạy tay)

1. **B1: gửi OTP** → Send → mở console backend, tìm dòng `⚠️ [DEV] OTP cho test@example.com: 482915`.
2. **B2: xác minh** → tab Body sửa `"123456"` thành OTP thật → Send → 200.

## Đọc kết quả

- **Status**: 200 OK · 400 sai input · 401 thiếu/sai token · 403 sai quyền · 404 không thấy · 500 lỗi server.
- **Body** luôn dạng `{ success, message, data, timestamp }` — đọc `message` (tiếng Việt) khi lỗi.

## An toàn

- Thư mục 0 chỉ đọc dữ liệu.
- Thư mục 1 tạo tài khoản test mới mỗi lần chạy (email ngẫu nhiên `qa_...@example.com`) — không đụng tài khoản thật.
- Thư mục 3 (đổi mật khẩu) tác động lên chính tài khoản test vừa tạo, không ảnh hưởng dữ liệu khác.

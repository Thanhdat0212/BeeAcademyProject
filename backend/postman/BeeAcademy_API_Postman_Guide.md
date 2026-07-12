# Hướng Dẫn Thiết Kế API & Test Postman — Bee Academy

> **Base URL:** `http://localhost:8080`
> **Content-Type mặc định:** `application/json`
> **Auth:** JWT Bearer Token (Supabase) — gắn sau khi đăng nhập
> **Quan trọng:** Mọi response thành công đều bọc trong `{ success, message, data, timestamp }`.
> Token đăng nhập nằm ở `data.accessToken` (KHÔNG phải `data.token`).

---

## Mục Lục

1. [Thiết kế API là gì?](#1-thiết-kế-api)
2. [Cấu trúc API trong Bee Academy](#2-cấu-trúc-api-bee-academy)
3. [Cài đặt Postman](#3-cài-đặt-postman)
4. [Test từng nhóm API](#4-test-từng-nhóm-api)
   - [4.1 Auth (đăng ký / đăng nhập)](#41-auth)
   - [4.2 Profile (hồ sơ của tôi)](#42-profile)
   - [4.3 Course (khóa học công khai)](#43-course)
   - [4.4 Category (danh mục)](#44-category)
   - [4.5 Enrollment + Order (ghi danh & đơn hàng)](#45-enrollment--order)
   - [4.6 Teacher Course (giáo viên quản lý khóa)](#46-teacher-course)
   - [4.7 Question + Quiz + Exam](#47-question--quiz--exam)
   - [4.8 Complaint (khiếu nại)](#48-complaint)
   - [4.9 Q&A + Discussion](#49-qa--discussion)
   - [4.10 Admin](#410-admin)
5. [Test Cases gợi ý (Happy & Unhappy)](#5-test-cases)
6. [Mẹo dùng Postman nâng cao](#6-mẹo-nâng-cao)

---

## 1. Thiết Kế API

### API là gì?
API (Application Programming Interface) là tập hợp các **endpoint** mà backend Spring Boot cung cấp cho frontend (hoặc Postman) gọi đến. Mỗi endpoint gồm:

| Thành phần | Ví dụ |
|---|---|
| HTTP Method | `GET`, `POST`, `PUT`, `DELETE`, `PATCH` |
| URL | `/api/auth/login` |
| Request Body / Params | JSON, multipart, path/query variable |
| Response | JSON `{ success, message, data, timestamp }` |

### Quy tắc REST của Bee Academy
- **GET** → lấy dữ liệu (không đổi DB) · **POST** → tạo mới · **PUT** → cập nhật · **PATCH** → cập nhật một phần · **DELETE** → xóa
- URL dùng danh từ số nhiều: `/api/courses`, `/api/orders`.
- Phân quyền theo prefix: `/api/teacher/**` cần role teacher, `/api/admin/**` cần role admin, `/api/student/**` cần role student.
- Status code: `200 OK`, `400 Bad Request`, `401 Unauthorized` (chưa đăng nhập), `403 Forbidden` (sai vai trò), `404 Not Found`, `500 Internal Server Error`.

---

## 2. Cấu Trúc API Bee Academy

| Controller | Base Path | Chức năng | Quyền |
|---|---|---|---|
| HealthController | `/api/health` | Kiểm tra server + DB | Công khai |
| AuthController | `/api/auth` | Đăng ký, đăng nhập, OTP, đổi mật khẩu | Công khai |
| ProfileController | `/api/me` | Hồ sơ, avatar, khóa học đã mua | Đăng nhập |
| CourseController | `/api/courses` | Danh sách + chi tiết khóa học | Công khai (GET) |
| CategoryController | `/api/categories` | Danh mục môn học | Công khai |
| EnrollmentController | `/api/courses/{id}/enroll` | Ghi danh | Đăng nhập |
| OrderController | `/api/orders` | Tạo đơn → PayOS | Đăng nhập |
| TeacherCourseController | `/api/teacher/courses` | CRUD khóa/chương/bài + submit duyệt | teacher |
| QuestionController | `/api/teacher/questions` | Ngân hàng câu hỏi | teacher |
| QuizController | `/api/teacher` + `/api/student` | Cấu hình & làm quiz chương | teacher/student |
| ExamController | `/api/teacher/courses/{id}/exams` | Cấu hình thi cuối chương | teacher |
| ComplaintController | `/api/complaints` | Khiếu nại (UC11) | Đăng nhập |
| QaController | `/api/student/qa`, `/api/teacher/qa` | Hỏi đáp GV–HS | student/teacher |
| CourseDiscussionController | `/api/courses/{id}/discussion` | Thảo luận khóa học | Đăng nhập |
| AdminApprovalController | `/api/admin/courses/...` | Duyệt khóa học | admin |
| AdminUserController | `/api/admin/users` | Quản lý người dùng | admin |
| AdminComplaintController | `/api/admin/complaints` | Xử lý khiếu nại | admin |
| AdminPayoutController | `/api/admin/payouts` | Chi trả giáo viên | admin |
| TeacherBankController | `/api/teacher/bank` | Tài khoản ngân hàng GV | teacher |
| TeacherRevenueController | `/api/teacher/revenue` | Doanh thu GV | teacher |
| ParentController | `/api/parent` | Theo dõi con | parent |

---

## 3. Cài Đặt Postman

### Bước 1: Tải Postman
Vào https://www.postman.com/downloads/ → tải bản Desktop → cài → mở từ Start Menu.

### Bước 2: Import sẵn collection của dự án (nhanh nhất)
Thư mục `backend/postman/` đã có sẵn:
- `BeeAcademy.postman_collection.json` — bộ request + test code
- `BeeAcademy.Local.postman_environment.json` — biến môi trường

Postman → **Import** → kéo 2 file vào → góc trên phải chọn environment **BeeAcademy.Local**.

### Bước 3: Biến môi trường (Environment)

| Variable | Initial Value | Ghi chú |
|---|---|---|
| `baseUrl` | `http://localhost:8080` | URL gốc |
| `token` | _(để trống)_ | Tự điền sau khi login |
| `refreshToken` | _(để trống)_ | Tự điền sau khi login |
| `myEmail` / `myPassword` | tài khoản thật của bạn | Dùng cho thư mục "Tài khoản của tôi" |
| `runEmail` / `runPassword` | _(tự sinh)_ | Dùng cho luồng đăng ký tự động |
| `courseId` | _(tự điền)_ | Lấy từ danh sách khóa học |

### Bước 4: Authorization mặc định cho Collection
Collection đã đặt **Bearer Token = `{{token}}`** ở cấp collection → mọi request con tự gắn token. Request công khai override thành **No Auth**.

> ⚠️ Backend phải đang chạy: `cd backend && mvn spring-boot:run` (đợi log `Started BeeAcademyApplication ... 8080`).

---

## 4. Test Từng Nhóm API

---

### 4.1 AUTH

#### API 1: Đăng ký nhanh (không OTP)
```
POST {{baseUrl}}/api/auth/register
```
**Body:**
```json
{
  "email": "hocsinh01@example.com",
  "password": "MatKhau123",
  "fullName": "Học sinh Một",
  "role": "student"
}
```
- `role` ∈ `student | parent | teacher`. `password` ≥ 8 ký tự, có 1 chữ hoa + 1 chữ số.
- Tài khoản tạo qua Supabase Admin API (`email_confirm=true`) nên **đăng nhập được ngay**.

**Expected (200):**
```json
{ "success": true, "message": "Đăng ký thành công...", "data": { "id": "...", "email": "...", "role": "student" } }
```

#### API 2: Đăng ký bằng OTP (2 bước)
```
POST {{baseUrl}}/api/auth/register/request-otp
Body: { "email": "...", "fullName": "...", "role": "student" }
```
→ DEV_MODE=true: OTP in ra console backend (`⚠️ [DEV] OTP cho ...: 482915`).
```
POST {{baseUrl}}/api/auth/register/verify-otp
Body: { "email": "...", "otp": "482915", "password": "MatKhau123" }
```

#### API 3: Đăng nhập
```
POST {{baseUrl}}/api/auth/login
Body: { "email": "hocsinh01@example.com", "password": "MatKhau123" }
```
**Expected (200):** `data.accessToken`, `data.refreshToken`, `data.expiresIn`, `data.user`.

**🔑 Lưu token tự động — tab Scripts (Tests):**
```javascript
pm.test("Đăng nhập 200", () => pm.response.to.have.status(200));
const d = pm.response.json().data;
pm.environment.set("token", d.accessToken);
pm.environment.set("refreshToken", d.refreshToken);
```

#### API 4: Refresh token
```
POST {{baseUrl}}/api/auth/refresh
Body: { "refreshToken": "{{refreshToken}}" }
```

#### API 5: Đổi mật khẩu (cần token)
```
POST {{baseUrl}}/api/auth/change-password
Body: { "currentPassword": "MatKhau123", "newPassword": "MatKhauMoi123" }
```

#### API 6: Đăng xuất (cần token)
```
POST {{baseUrl}}/api/auth/logout
```

#### API 7: Quên mật khẩu bằng OTP
```
POST {{baseUrl}}/api/auth/reset-password/request-otp   Body: { "email": "..." }
POST {{baseUrl}}/api/auth/reset-password/verify-otp     Body: { "email": "...", "otp": "...", "newPassword": "..." }
```

---

### 4.2 PROFILE

#### API 1: Xem hồ sơ của tôi (cần token)
```
GET {{baseUrl}}/api/me
```

#### API 2: Cập nhật hồ sơ (cần token)
```
PUT {{baseUrl}}/api/me
```
**Body (mọi field optional, chỉ gửi field muốn đổi):**
```json
{
  "fullName": "Nguyễn Văn An",
  "phone": "0901234567",
  "bio": "Học sinh lớp 8 yêu Toán",
  "facebookUrl": "https://facebook.com/an"
}
```
> `phone` định dạng VN: 10 số bắt đầu 03–09.

#### API 3: Đổi avatar (cần token, multipart)
```
POST {{baseUrl}}/api/me/avatar    Content-Type: multipart/form-data
form-data: file = (chọn ảnh)
```

#### API 4: Khóa học đã mua (cần token)
```
GET {{baseUrl}}/api/me/courses
```
**Expected (200):** `data` là mảng khóa học (rỗng nếu chưa mua).

---

### 4.3 COURSE (công khai)

#### API 1: Danh sách + tìm kiếm khóa học
```
GET {{baseUrl}}/api/courses?page=0&size=12
```
**Query optional:** `subject` (slug danh mục), `grade` (6–9), `keyword`, `page`, `size`.
**Expected (200):** `data` là trang phân trang (`content`, `totalElements`...).

#### API 2: Chi tiết khóa học theo ID
```
GET {{baseUrl}}/api/courses/{{courseId}}
```

#### API 3: Chi tiết theo slug
```
GET {{baseUrl}}/api/courses/by-slug/{slug}
```

---

### 4.4 CATEGORY
```
GET {{baseUrl}}/api/categories
```
**Expected (200):** `data` là mảng 8 danh mục (Toán, Văn, Anh...).

---

### 4.5 ENROLLMENT & ORDER

#### API 1: Tạo đơn hàng (cần token) → trả link PayOS
```
POST {{baseUrl}}/api/orders
Body: { "courseIds": ["<UUID khóa học>"] }
```

#### API 2: Lịch sử đơn hàng
```
GET {{baseUrl}}/api/orders
```

#### API 3: Chi tiết đơn
```
GET {{baseUrl}}/api/orders/{orderId}
```

#### API 4: Xác minh thanh toán đơn
```
POST {{baseUrl}}/api/orders/{orderId}/verify
```

#### API 5: Ghi danh trực tiếp (cần token)
```
POST {{baseUrl}}/api/courses/{courseId}/enroll
```

---

### 4.6 TEACHER COURSE (role teacher)

#### API 1: Khóa học của tôi
```
GET {{baseUrl}}/api/teacher/courses
```

#### API 2: Tạo khóa học mới (trạng thái DRAFT)
```
POST {{baseUrl}}/api/teacher/courses
```
**Body:**
```json
{
  "title": "Toán nâng cao lớp 8",
  "description": "Khóa học bồi dưỡng học sinh giỏi Toán 8",
  "thumbnailUrl": "https://picsum.photos/400",
  "categoryId": "<UUID danh mục>",
  "grades": [8],
  "priceVnd": 299000,
  "salePriceVnd": 199000
}
```
> Lấy `categoryId` từ `GET /api/categories`. `priceVnd` ≥ 1000.

#### API 3–5: Cập nhật / Xóa / Submit duyệt
```
PUT    {{baseUrl}}/api/teacher/courses/{courseId}
DELETE {{baseUrl}}/api/teacher/courses/{courseId}
POST   {{baseUrl}}/api/teacher/courses/{courseId}/submit
```

#### API 6+: Chương & bài học
```
POST   {{baseUrl}}/api/teacher/courses/{courseId}/chapters
PUT    {{baseUrl}}/api/teacher/courses/{courseId}/chapters/{chapterId}
DELETE {{baseUrl}}/api/teacher/courses/{courseId}/chapters/{chapterId}
POST   {{baseUrl}}/api/teacher/courses/{courseId}/chapters/{chapterId}/lessons
```

---

### 4.7 QUESTION + QUIZ + EXAM (role teacher / student)

#### Ngân hàng câu hỏi (teacher)
```
GET    {{baseUrl}}/api/teacher/questions
POST   {{baseUrl}}/api/teacher/questions
PUT    {{baseUrl}}/api/teacher/questions/{questionId}
DELETE {{baseUrl}}/api/teacher/questions/{questionId}
GET    {{baseUrl}}/api/teacher/questions/stats/{chapterId}
```

#### Cấu hình quiz chương (teacher)
```
GET {{baseUrl}}/api/teacher/chapters/{chapterId}/quiz-config
PUT {{baseUrl}}/api/teacher/chapters/{chapterId}/quiz-config
```

#### Học sinh làm quiz (student)
```
POST {{baseUrl}}/api/student/chapters/{chapterId}/quiz/start
POST {{baseUrl}}/api/student/quiz/{attemptId}/submit
GET  {{baseUrl}}/api/student/quiz/{attemptId}/result
```

#### Thi cuối chương
```
GET  {{baseUrl}}/api/student/courses/{courseId}/exams
POST {{baseUrl}}/api/student/courses/{courseId}/exams/{slotIndex}/start
POST {{baseUrl}}/api/student/exam-attempts/{attemptId}/submit
```

---

### 4.8 COMPLAINT (cần token)

#### API 1: Gửi khiếu nại
```
POST {{baseUrl}}/api/complaints
```
**Body:**
```json
{
  "title": "Video bài 3 không xem được",
  "category": "technical",
  "priority": "medium",
  "content": "Em bấm vào bài 3 thì báo lỗi không tải được video."
}
```
> `category` ∈ `payment | course_review | bank_verify | student_report | content | technical | other`. `priority` ∈ `low | medium | high`.

#### API 2–4: Danh sách / chi tiết / trả lời
```
GET  {{baseUrl}}/api/complaints
GET  {{baseUrl}}/api/complaints/{id}
POST {{baseUrl}}/api/complaints/{id}/messages    Body: { "content": "..." }
```

---

### 4.9 Q&A + DISCUSSION

#### Hỏi đáp (student hỏi)
```
GET  {{baseUrl}}/api/student/qa
POST {{baseUrl}}/api/student/qa
Body: { "courseId": "<UUID>", "lessonId": null, "content": "Thầy ơi câu 5 giải sao ạ?" }
```

#### Giáo viên trả lời
```
GET  {{baseUrl}}/api/teacher/qa
POST {{baseUrl}}/api/teacher/qa/{threadId}/messages    Body: { "content": "..." }
```

#### Thảo luận trong khóa học
```
GET  {{baseUrl}}/api/courses/{courseId}/discussion
POST {{baseUrl}}/api/courses/{courseId}/discussion
Body: { "lessonId": null, "content": "Mọi người ôn chương 2 chưa?" }
```

---

### 4.10 ADMIN (role admin)

```
GET  {{baseUrl}}/api/admin/dashboard/overview
GET  {{baseUrl}}/api/admin/courses/pending
POST {{baseUrl}}/api/admin/courses/{courseId}/approve
POST {{baseUrl}}/api/admin/courses/{courseId}/reject
GET  {{baseUrl}}/api/admin/users
GET  {{baseUrl}}/api/admin/complaints
GET  {{baseUrl}}/api/admin/payouts
```

---

## 5. Test Cases

Mỗi API nên test ít nhất 3 loại: **Happy Path**, **Unhappy Path**, **Edge Case**.

### Bảng test cases — Auth

| ID | Tên | Method | URL | Input | Status | Kết quả |
|---|---|---|---|---|---|---|
| TC_AUTH_01 | Đăng ký hợp lệ | POST | `/api/auth/register` | đủ field, role=student | 200 | user object |
| TC_AUTH_02 | Đăng ký email đã tồn tại | POST | `/api/auth/register` | email trùng | 409 | "Email này đã được đăng ký" |
| TC_AUTH_03 | Đăng ký mật khẩu yếu | POST | `/api/auth/register` | password="123" | 400 | "Mật khẩu tối thiểu 8 ký tự..." |
| TC_AUTH_04 | Đăng nhập đúng | POST | `/api/auth/login` | email/pass đúng | 200 | accessToken |
| TC_AUTH_05 | Đăng nhập sai mật khẩu | POST | `/api/auth/login` | pass sai | 401 | "Email hoặc mật khẩu không đúng..." |

### Bảng test cases — Course

| ID | Tên | Method | URL | Status | Kết quả |
|---|---|---|---|---|---|
| TC_COURSE_01 | Danh sách khóa học | GET | `/api/courses` | 200 | trang phân trang |
| TC_COURSE_02 | Lọc theo lớp 8 | GET | `/api/courses?grade=8` | 200 | khóa lớp 8 |
| TC_COURSE_03 | Chi tiết khóa tồn tại | GET | `/api/courses/{id}` | 200 | chi tiết |
| TC_COURSE_04 | Chi tiết khóa không tồn tại | GET | `/api/courses/<uuid-lạ>` | 404 | "Không tìm thấy" |

### Bảng test cases — Phân quyền

| ID | Tên | Method | URL | Token | Status |
|---|---|---|---|---|---|
| TC_SEC_01 | Không token gọi API riêng | GET | `/api/me/courses` | không | 401 |
| TC_SEC_02 | Student gọi API teacher | GET | `/api/teacher/courses` | student | 403 |
| TC_SEC_03 | Student gọi API admin | GET | `/api/admin/users` | student | 403 |
| TC_SEC_04 | Teacher gọi API teacher | GET | `/api/teacher/courses` | teacher | 200 |

---

## 6. Mẹo Nâng Cao

### 6.1 Test assertions tự động (tab Scripts/Tests)
```javascript
// Status code
pm.test("Status 200", () => pm.response.to.have.status(200));

// Có envelope success
pm.test("success = true", () => pm.expect(pm.response.json().success).to.be.true);

// Thời gian phản hồi < 2s
pm.test("Nhanh < 2000ms", () => pm.expect(pm.response.responseTime).to.be.below(2000));

// Lưu giá trị để request sau dùng
const list = pm.response.json().data.content;
if (list && list.length) pm.environment.set("courseId", list[0].id);
```

### 6.2 Tự đăng nhập trong Pre-request Script
```javascript
if (!pm.environment.get("token")) {
  pm.sendRequest({
    url: pm.environment.get("baseUrl") + "/api/auth/login",
    method: "POST",
    header: { "Content-Type": "application/json" },
    body: { mode: "raw", raw: JSON.stringify({
      email: pm.environment.get("myEmail"),
      password: pm.environment.get("myPassword")
    }) }
  }, (err, res) => {
    if (!err) pm.environment.set("token", res.json().data.accessToken);
  });
}
```

### 6.3 Chạy Collection Runner
1. Di chuột vào collection **Bee Academy API** → **Run**.
2. Chọn environment **BeeAcademy.Local**.
3. Tích các thư mục muốn chạy → **Run**.
→ Postman chạy tuần tự và báo PASS/FAIL.

### 6.4 Export chia sẻ với nhóm
**...** cạnh collection → **Export** → **Collection v2.1** → gửi file `.json`.

### 6.5 Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách xử lý |
|---|---|---|
| `401 Unauthorized` | Token thiếu/hết hạn | Đăng nhập lại (token tự lưu) |
| `403 Forbidden` | Sai vai trò | Dùng tài khoản đúng role (teacher/admin) |
| `400 Bad Request` | Body sai/thiếu field | Đọc `message` trong response |
| `404 Not Found` | URL sai hoặc ID không tồn tại | Kiểm tra path + ID |
| `500 Internal Server Error` | Lỗi server | Xem log console Spring Boot |
| `Could not send request` | Backend chưa chạy | Chạy `mvn spring-boot:run` |

---

## Tổng Kết

| Bước | Công việc |
|---|---|
| 1 | Cài Postman, import collection + environment của dự án |
| 2 | Bật backend (`mvn spring-boot:run`), chọn environment BeeAcademy.Local |
| 3 | Test Auth: register → login (lưu token) |
| 4 | Test Profile, Course, Category (đọc dữ liệu) |
| 5 | Test theo vai trò: teacher (khóa học), admin (duyệt) |
| 6 | Viết test assertions, chạy Collection Runner |

> **Lưu ý:** Backend Bee Academy nối Supabase Postgres — đảm bảo `backend/.env` có đủ `SUPABASE_*` trước khi chạy.

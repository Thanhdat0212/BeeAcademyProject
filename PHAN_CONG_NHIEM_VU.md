# Phân công nhiệm vụ theo Use Case — Bee Academy (5 thành viên)

> Cách chia: mỗi thành viên **phụ trách một cụm module end-to-end (Backend + Frontend)** để code song song,
> hạn chế đụng file của nhau. Mỗi người chịu trách nhiệm cả phần **đã làm** (bảo trì + viết test) lẫn phần
> **còn thiếu** (code mới) trong cụm của mình.
>
> Cơ sở UC: tài liệu **SWT_v4_final.docx (SRS v4.0)** — 44 Use Case, 8 module.
> Trạng thái khảo sát từ code thực tế trong `backend/` và `frontend/`.

---

## 1. Trạng thái hiện tại (theo module)

Ký hiệu: ✅ Đã xong (BE+FE) · 🟡 Một phần · ⬜ Chưa có

| Module | UC | Tên | Backend | Frontend |
|---|---|---|---|---|
| **AUTH** | UC01 | Đăng ký (OTP) | ✅ | ✅ |
| | UC02 | Đăng nhập | ✅ | ✅ |
| | UC03 | Đăng xuất | ✅ | ✅ |
| | UC04 | Đặt lại mật khẩu | ✅ | ✅ |
| | UC05 | Cập nhật hồ sơ | ✅ | ✅ |
| **CRS** | UC06 | Tìm kiếm khóa học | ✅ | ✅ |
| | UC07 | Xem chi tiết khóa học | ✅ | ✅ |
| | UC08 | Xem bài học thử | 🟡 | 🟡 |
| **PAY** | UC09 | Mua khóa học (tạo Order) | ✅ | ✅ |
| | UC10 | Thanh toán (PayOS) | ✅ | ✅ |
| | UC11 | Lịch sử mua khóa học | ✅ | 🟡 |
| | UC12 | Gửi khiếu nại đến Admin | ⬜ | 🟡 |
| **LRN** | UC13 | DS khóa đã mua | ✅ | ✅ |
| | UC14 | Xem bài giảng & tài liệu | ✅ | ✅ |
| | UC15 | Tải tài liệu học tập | 🟡 | ⬜ |
| | UC16 | Nộp bài tập | ⬜ | ⬜ |
| | UC17 | Làm bài kiểm tra | ✅ | ✅ |
| | UC18 | Xem điểm & tiến độ | 🟡 | 🟡 |
| | UC19 | Đánh giá khóa học | ⬜ | ⬜ |
| | UC20 | Xem & tải chứng chỉ | ⬜ | ⬜ |
| **INT** | UC21 | Gửi câu hỏi cho GV | ✅ | ✅ |
| | UC22 | Chat AI hỗ trợ | ⬜ | ⬜ |
| | UC23 | Đề xuất lộ trình AI | ⬜ | ⬜ |
| **PRN** | UC24 | Theo dõi tiến độ con | ✅ (BE) | 🟡 |
| | UC25 | Liên hệ & nhận thông báo GV | ⬜ | ⬜ |
| | UC26 | Lịch sử thanh toán của con | ⬜ | ⬜ |
| | UC27 | Gửi lời mời liên kết con | ⬜ | ⬜ |
| | UC28 | Chấp nhận / từ chối liên kết | ⬜ | ⬜ |
| | UC29 | Hủy liên kết | ✅ | ✅ |
| **TCH** | UC30 | Tạo khóa học | ✅ | ✅ |
| | UC31 | Cập nhật bài giảng & tài liệu | ✅ | ✅ |
| | UC32 | Tạo question bank | ✅ | ✅ |
| | UC33 | Cập nhật question bank | ✅ | ✅ |
| | UC34 | Tạo bài kiểm tra (exam) | ✅ | ✅ |
| | UC35 | Chấm điểm bài tập | ⬜ | 🟡 |
| | UC36 | Trả lời câu hỏi học sinh | ✅ | ✅ |
| | UC37 | Xem lịch sử doanh thu | ✅ | ✅ |
| **ADM** | UC38 | Dashboard quản trị | ✅ | ✅ |
| | UC39 | DS tài khoản người dùng | ✅ (BE) | 🟡 |
| | UC40 | Mở/khóa tài khoản, đổi vai trò | ✅ (BE) | 🟡 |
| | UC41 | Duyệt khóa học | ✅ | 🟡 |
| | UC42 | Xử lý khiếu nại | ⬜ | 🟡 |
| | UC43 | Xác nhận chuyển khoản GV + xuất Excel | ⬜ | ⬜ |
| | UC44 | Gửi thông báo | ⬜ | ⬜ |

---

## 2. Bảng phân công

| TV | Cụm phụ trách | UC phụ trách |
|---|---|---|
| **TV1 — Thành Đạt** | Xác thực & Thanh toán | UC01-05, 09, 10, 11, 37 |
| **TV2** | Học tập & Chứng chỉ | UC06, 07, 08, 13, 14, 15, 19, 20 |
| **TV3** | Khảo thí, Bài tập & Tương tác | UC16, 17, 18, 21, 22\*, 23\*, 35, 36 |
| **TV4** | Giáo viên & Phụ huynh | UC24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34 |
| **TV5** | Quản trị (Admin) | UC12, 38, 39, 40, 41, 42, 43, 44 |

\* UC22, UC23 (AI) là phần mở rộng — làm sau nếu còn thời gian.

---

## 3. Chi tiết từng thành viên

### 🟦 TV1 — Thành Đạt · Xác thực & Thanh toán

**UC phụ trách:** UC01-05 (Auth) · UC09, UC10, UC11 (Mua/Thanh toán/Lịch sử) · UC37 (Doanh thu GV).

**Backend:**
- `controller/AuthController.java`, `service/AuthService.java`, `service/OtpService.java`
- `controller/OrderController.java`, `service/OrderService.java`, `controller/PayOSWebhookController.java`
- `controller/TeacherRevenueController.java`, `service/TeacherRevenueService.java`

**Frontend:**
- `pages/common/Login, Register, ForgotPassword, OAuthCallbackPage`
- `pages/student/AccountPage, CheckoutPage, PaymentResultPage, OrdersPage`
- `pages/teacher/TeacherRevenuePage` · `api/authService.ts, orderService.ts, revenueService.ts`

**Việc cần làm:** Auth và Thanh toán (PayOS) **đã hoàn thiện** → tập trung **bảo trì + viết test** (Unit/Integration/System). Hoàn thiện nốt UC11 (OrdersPage bỏ fallback Zustand, dùng API thật).

> Ghi chú logistics: TV1 giữ các file dùng chung (`api/client.ts`, `App.tsx`, `ProtectedRoute.tsx`, Spring
> Security, `application.yml`, migration SQL) để tránh xung đột — ai cần thêm route/cột báo TV1 gộp một lần.

---

### 🟩 TV2 · Học tập cốt lõi & Chứng chỉ

**UC phụ trách:** UC06, UC07, UC08 (Tìm kiếm/Chi tiết/Học thử) · UC13, UC14 (Khóa đã mua/Bài giảng) ·
UC15 (Tải tài liệu) · UC19 (Đánh giá) · UC20 (Chứng chỉ).

**Backend:**
- `controller/CourseController.java`, `service/CourseService.java`
- `controller/EnrollmentController.java`, `service/EnrollmentService.java`
- `model/CourseDocument.java`, `repository/CourseDocumentRepository`
- **Mới:** signed URL + watermark (UC15) · `Review` model/controller/service (UC19) ·
  `Certificate` model + sinh PDF + QR + trang xác minh công khai (UC20)

**Frontend:**
- `pages/student/CoursesPage, CourseDetailPage` · `api/courseService.ts, enrollmentService.ts`
- **Mới:** UI tải tài liệu (UC15) · UI đánh giá sao + review (UC19) · trang `/certificates` (UC20)

**Việc cần làm:** UC15 (tải tài liệu bảo mật) · UC19 (đánh giá — BE+FE mới) · UC20 (chứng chỉ PDF+QR — mới) ·
UC08 (hiển thị bài học thử rõ ràng).

---

### 🟨 TV3 · Khảo thí, Bài tập & Tương tác học

**UC phụ trách:** UC16 (Nộp bài tập) · UC17 (Làm bài kiểm tra) · UC18 (Điểm & tiến độ HS) · UC21 (Hỏi GV) ·
UC35 (Chấm bài tập) · UC36 (GV trả lời) · *UC22, UC23 (AI — mở rộng)*.

**Backend:**
- `controller/QuizController.java`, `service/QuizService.java`, `controller/ExamController.java`, `service/ExamService.java`
- `controller/QaController.java`, `service/QaService.java`
- **Mới:** `Assignment` + `AssignmentSubmission` model/controller/service (UC16) · endpoint chấm điểm (UC35) ·
  endpoint tổng hợp điểm & tiến độ (UC18)

**Frontend:**
- `pages/student/StudentQuizPage, MessagesPage` · `pages/teacher/TeacherGradesPage, TeacherQAPage`
- `api/quizService.ts, examService.ts, qaService.ts`
- **Mới:** UI nộp bài tập (UC16) · wire chấm điểm (UC35) · trang tiến độ HS (UC18)

**Việc cần làm:** UC16 + UC35 (hệ thống bài tập + chấm) · UC18 (trang điểm/tiến độ). *Mở rộng:* UC22/UC23 (AI).

---

### 🟧 TV4 · Giáo viên (authoring) & Phụ huynh

**UC phụ trách:** UC30-34 (Tạo khóa/Nội dung/Question bank/Exam) · UC24 (Theo dõi tiến độ con) ·
UC25 (Liên hệ GV) · UC26 (Lịch sử thanh toán con) · UC27 (Gửi lời mời) · UC28 (Chấp nhận/từ chối) ·
UC29 (Hủy liên kết).

**Backend:**
- `controller/TeacherCourseController.java`, `service/TeacherCourseService.java`, `controller/UploadController.java`, `service/ContentUploadService.java`
- `controller/QuestionController.java`, `service/QuestionService.java`
- `controller/ParentController.java`, `service/ParentService.java`, `model/ParentStudentLink.java`, `repository/ParentStudentLinkRepository`
- **Mới:** luồng invite/accept/reject liên kết PH–HS (UC27, UC28) · liên hệ GV (UC25) · lịch sử thanh toán con (UC26)

**Frontend:**
- `pages/teacher/TeacherCoursesPage, TeacherContentPage, QuestionBankPage, TeacherQuizChapterPage, TeacherExamPage`
- `pages/parents/ParentDashboard, ParentCourses, ParentProgress, ParentMessages, ParentStudentLink`
- `api/teacherCourseService.ts, questionService.ts, parentService.ts`

**Việc cần làm:** Teacher authoring (UC30-34) đã gần xong → bảo trì + test. Trọng tâm code mới: Parent —
UC24 (thay mock bằng API), UC25, UC26, UC27, UC28.

---

### 🟥 TV5 · Quản trị (Admin)

**UC phụ trách:** UC38 (Dashboard) · UC39 (DS tài khoản) · UC40 (Mở/khóa tài khoản) · UC41 (Duyệt khóa học) ·
UC12 (Tiếp nhận khiếu nại) · UC42 (Xử lý khiếu nại) · UC43 (Xác nhận chuyển khoản GV + xuất Excel) ·
UC44 (Gửi thông báo).

**Backend:**
- `controller/AdminDashboardController.java`, `service/AdminDashboardService.java`
- `controller/AdminUserController.java`
- `controller/AdminApprovalController.java`, `service/ApprovalService.java`, `model/ApprovalHistory`
- **Mới:** `Complaint`/`Ticket` model + controller + service (UC12, UC42) ·
  `PayoutController` + endpoint xác nhận chuyển khoản & xuất Excel — Apache POI (UC43) ·
  `NotificationController` + `NotificationService` + model `Notification` (UC44)

**Frontend:**
- `pages/admin/DashboardAdmin, ApprovalsPage, CourseReviewPage` · `pages/student/ComplaintsPage` · `api/adminService.ts`
- **Mới:** wire tab Users (UC39, UC40) · hoàn thiện CourseReview (UC41) · UI khiếu nại (UC12, UC42) ·
  màn xác nhận payout + tải Excel (UC43) · trang gửi thông báo (UC44)

**Việc cần làm:** UC12 + UC42 (khiếu nại) · UC43 (payout + Excel) · UC44 (thông báo) · wire FE UC39/40/41.

---

## 4. Sở hữu schema dùng chung & migration

| Entity | Chủ sở hữu | Người dùng chung |
|---|---|---|
| `Profile` (thêm cột `grade`) | TV1 | TV4, TV5 |
| `Course`, `Chapter`, `Lesson` | TV2 | TV4 (tạo), TV5 (duyệt) |
| `Order`, `RevenueSplit`, `PayoutPeriod` | TV1 | TV5 (UC43 đọc), TV4 (UC26) |
| `ParentStudentLink` | TV4 | TV5 |
| `Assignment`, `QuizAttempt` | TV3 | TV2 (UC20), TV4 (UC24) |
| `Complaint`, `Notification` | TV5 | tất cả (chỉ tạo qua API của TV5) |

**Migration:** mọi thay đổi DB ghi vào **một thư mục migration đánh số tăng dần**, TV1 gác cổng. Không tự sửa
bảng của module khác — gửi yêu cầu thêm cột cho chủ sở hữu.

---

## 5. Phụ thuộc chéo (cần hẹn checkpoint)

| Tính năng | Phụ thuộc dữ liệu của |
|---|---|
| UC18 Tiến độ HS (TV3) | quiz/bài tập (TV3) + enrollment (TV2) |
| UC20 Chứng chỉ (TV2) | điều kiện *pass bài kiểm tra* (TV3) |
| UC24/UC26 Parent (TV4) | quiz (TV3) + Order (TV1) |
| UC44 Thông báo (TV5) | nhiều module bắn notify → TV5 cung cấp 1 API `notify()` chung |

---

## 6. Quy tắc làm việc chung

1. **Branch theo UC:** `feature/uc16-nop-bai-tap`, `feature/uc43-payout-export`... Mỗi UC một PR nhỏ.
2. **File dùng chung** (`App.tsx`, `client.ts`, Spring Security, enum/DTO chung, migration SQL): báo TV1 trước
   khi sửa, gộp một lần để tránh xung đột.
3. **Ưu tiên tạo file mới** (controller/service/page riêng) thay vì sửa file của người khác.
4. **Quy ước:** UI text tiếng Việt; dùng CSS var Material Design 3 (`bg-surface`, `text-on-surface`...);
   dev server chạy port **3000**.
5. **Test theo SRS:** mỗi UC viết tối thiểu 1 happy-path + 1 negative — đúng mã UT/IT/ST trong Ma trận truy
   xuất (Bảng 49 SRS). Coverage mục tiêu ≥ 70%.
6. **Sync hằng ngày:** trước khi push, `git pull --rebase`; conflict ở file chung báo TV1.

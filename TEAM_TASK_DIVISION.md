# Kế hoạch chia code theo Use Case — Bee Academy (5 thành viên)

> Mục tiêu: Mỗi thành viên **sở hữu một cụm Use Case end-to-end (Backend + Frontend)**, chịu trách nhiệm cả
> phần **đã làm** (bảo trì, viết test, fix bug) lẫn phần **còn thiếu** (code mới).
> Thành Đạt (TV1) quản lý **hạ tầng dùng chung**,
> hai module mới mang tính nền tảng (Payout & Hệ thống thông báo) và **điều phối tích hợp/merge** cho cả nhóm.
>
> Cơ sở UC: tài liệu **SWT_v4_final.docx (SRS v4.0)** — 44 Use Case, 8 module, 7 actor.
> Trạng thái triển khai khảo sát từ code thực tế trong `backend/` và `frontend/` (không theo CLAUDE.md vì
> CLAUDE.md đã cũ — dự án thực tế đã có Order/Payment PayOS, Revenue, Bank, Exam, Q&A, AdminDashboard...).

---

## 1. Trạng thái triển khai thực tế (theo module)

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
| | UC08 | Xem bài học thử | 🟡 (free preview lồng trong course, chưa có khái niệm "trial" riêng) | 🟡 (lồng trong CourseDetail) |
| **PAY** | UC09 | Mua khóa học (tạo Order) | ✅ | ✅ |
| | UC10 | Thanh toán | ✅ (qua **PayOS** — thay cho VNPay/MoMo trong SRS) | ✅ |
| | UC11 | Lịch sử mua khóa học | ✅ | 🟡 (OrdersPage còn fallback Zustand) |
| | UC12 | Gửi khiếu nại đến Admin | ⬜ | 🟡 (ComplaintsPage chỉ skeleton) |
| **LRN** | UC13 | DS khóa đã mua | ✅ | ✅ |
| | UC14 | Xem bài giảng & tài liệu | ✅ | ✅ |
| | UC15 | Tải tài liệu học tập | 🟡 (doc có publicUrl, chưa có signed URL + watermark) | ⬜ (chưa có UI tải riêng) |
| | UC16 | Nộp bài tập | ⬜ (chưa có model Assignment) | ⬜ |
| | UC17 | Làm bài kiểm tra | ✅ (quiz) | ✅ (StudentQuizPage) |
| | UC18 | Xem điểm & tiến độ | 🟡 (dữ liệu có qua quiz/parent) | 🟡 (chưa có trang riêng cho HS) |
| | UC19 | Đánh giá khóa học | ⬜ | ⬜ |
| | UC20 | Xem & tải chứng chỉ | ⬜ | ⬜ |
| **INT** | UC21 | Gửi câu hỏi cho GV | ✅ (Qa) | ✅ (MessagesPage) |
| | UC22 | Chat AI hỗ trợ | ⬜ | ⬜ |
| | UC23 | Đề xuất lộ trình AI | ⬜ | ⬜ |
| **PRN** | UC24 | Theo dõi tiến độ con | ✅ (BE: ChildOverview) | 🟡 (FE còn mock) |
| | UC25 | Liên hệ & nhận thông báo GV | ⬜ | ⬜ |
| | UC26 | Lịch sử thanh toán của con | ⬜ | ⬜ |
| | UC27 | Gửi lời mời liên kết con | ⬜ (link đang prepopulate, chưa có invite) | ⬜ |
| | UC28 | Chấp nhận / từ chối liên kết | ⬜ | ⬜ |
| | UC29 | Hủy liên kết | ✅ (revoke/unlink) | ✅ |
| **TCH** | UC30 | Tạo khóa học | ✅ | ✅ |
| | UC31 | Cập nhật bài giảng & tài liệu (upload) | ✅ | ✅ |
| | UC32 | Tạo question bank | ✅ | ✅ |
| | UC33 | Cập nhật question bank | ✅ | ✅ |
| | UC34 | Tạo bài kiểm tra (exam) | ✅ | ✅ |
| | UC35 | Chấm điểm bài tập | ⬜ (phụ thuộc UC16) | 🟡 (TeacherGradesPage skeleton) |
| | UC36 | Trả lời câu hỏi học sinh | ✅ | ✅ |
| | UC37 | Xem lịch sử doanh thu | ✅ | ✅ |
| **ADM** | UC38 | Dashboard quản trị | ✅ | ✅ |
| | UC39 | DS tài khoản người dùng | ✅ (BE: AdminUserController) | 🟡 (tab Users skeleton) |
| | UC40 | Mở/khóa tài khoản, đổi vai trò | ✅ (BE) | 🟡 (chưa wire FE) |
| | UC41 | Duyệt khóa học | ✅ | 🟡 (ApprovalsPage/CourseReview wire 1 phần) |
| | UC42 | Xử lý khiếu nại | ⬜ | 🟡 (tab Complaints skeleton) |
| | UC43 | Xác nhận chuyển khoản GV + xuất Excel | ⬜ (chưa có endpoint confirm/export) | ⬜ |
| | UC44 | Gửi thông báo | ⬜ | ⬜ |

**Tổng quan mức hoàn thành:** Auth ~100% · Thanh toán ~100% (PayOS) · Course/Learning cốt lõi ~80% ·
Teacher ~85% · Admin ~45% · Parent ~40% · AI/Chứng chỉ/Bài tập/Đánh giá ~0%.

---

## 2. Nguyên tắc chia & thang điểm công sức

Vì phần lớn UC đã hoàn thành, **không chia theo số lượng UC** (sẽ sai lệch), mà chia theo **công sức thực tế**
quy đổi ra điểm:

| Loại công việc | Điểm | Diễn giải |
|---|---|---|
| 🔨 Module mới lớn (model + BE + FE) | **3** | vd chứng chỉ, hệ thống bài tập, payout/Excel, thông báo |
| 🔧 Tính năng mới gọn | **2** | vd đánh giá, tải tài liệu bảo mật, khiếu nại, liên kết PH |
| 🔌 Wire/hoàn thiện phần dở | **1** | nối FE vào API có sẵn, bỏ mock |
| 🧪 Bảo trì + viết test phần đã xong | **0.5/UC** | giữ chất lượng, bổ sung Unit/Integration/System test |



## 3. Bảng phân chia 5 thành viên

| TV | Vai trò | Cụm phụ trách | UC sở hữu | Điểm công sức |
|---|---|---|---|---|
| **TV1 — Thành Đạt** | Chủ trì kỹ thuật · Hạ tầng + Tài chính + Thông báo | Auth, Thanh toán/Doanh thu, Payout, Notification, hạ tầng dùng chung | UC01-05, 09, 10, 11, 37, **43, 44** | **≈ 18 (cao nhất)** |
| **TV2** | Học tập & Chứng chỉ | Khám phá khóa học + học tập cốt lõi + đánh giá + chứng chỉ | UC06, 07, 08, 13, 14, **15, 19, 20** | ≈ 11 |
| **TV3** | Khảo thí, Bài tập & Tương tác học | Quiz/Exam + bài tập/chấm + tiến độ + Q&A (+AI) | UC16, 17, 18, 21, 35, 36 (+22, 23\*) | ≈ 10 |
| **TV4** | Giáo viên & Liên kết Phụ huynh | Teacher authoring + luồng liên kết PH–HS | UC24, 25, 27, 28, 29, 30, 31, 32, 33, 34 | ≈ 10 |
| **TV5** | Quản trị & Khiếu nại | Admin user/duyệt + khiếu nại + lịch sử thanh toán PH | UC12, 26, 38, 39, 40, 41, 42 | ≈ 10 |

\* UC22, UC23 (AI) là **mục tiêu mở rộng (stretch goal)** — chỉ làm nếu còn thời gian, vì cần AI Engine chưa có.

---

## 4. Chi tiết từng thành viên

### 🟦 TV1 — Thành Đạt · Chủ trì kỹ thuật (Hạ tầng + Tài chính + Thông báo)

**UC sở hữu:** UC01-05 (Auth) · UC09, UC10, UC11 (Mua/Thanh toán/Lịch sử) · UC37 (Doanh thu GV) ·
**UC43** (Xác nhận payout + xuất Excel) · **UC44** (Hệ thống thông báo).

**Backend:**
- `controller/AuthController.java`, `service/AuthService.java`, `service/OtpService.java`
- `controller/OrderController.java`, `service/OrderService.java`, `controller/PayOSWebhookController.java`
- `controller/TeacherRevenueController.java`, `service/TeacherRevenueService.java`
- `repository/OrderRepository`, `OrderItemRepository`, `RevenueSplitRepository`, `PayoutPeriodRepository`
- **Mới:** `PayoutController` + endpoint xác nhận chuyển khoản & xuất Excel (Apache POI) — UC43
- **Mới:** `NotificationController` + `NotificationService` + model `Notification` (in-app/email) — UC44

**Frontend:**
- `pages/common/Login, Register, ForgotPassword, OAuthCallbackPage`
- `pages/student/AccountPage, CheckoutPage, PaymentResultPage, OrdersPage`
- `api/authService.ts, orderService.ts, revenueService.ts`
- `pages/teacher/TeacherRevenuePage`
- **Mới:** trang Admin xác nhận payout + tải Excel (UC43) · trung tâm thông báo + trang gửi thông báo (UC44)

**Hạ tầng dùng chung (chỉ TV1 sửa — các TV khác đề nghị qua TV1):**
- `frontend/src/api/client.ts` (apiClient + interceptor) · `App.tsx` (routing) · `components/ProtectedRoute.tsx`
- Spring Security / `JwtAuthenticationFilter` / CORS / GlobalExceptionHandler · cấu trúc `dto/`, enum chung
- `application.yml` · **thư mục migration SQL (gác cổng đánh số thứ tự)**
- **Điều phối merge, review PR, giải quyết conflict, chuẩn hóa convention, dựng CI.**

**Việc còn phải code:** **UC43** (payout confirm + Excel — module mới) · **UC44** (thông báo in-app + email,
dùng chung cả hệ thống — module mới) · wire lại UC11 (bỏ fallback Zustand). Thanh toán PayOS (UC09/10) đã
hoàn thiện → bảo trì + viết test.

---

### 🟩 TV2 · Học tập cốt lõi & Chứng chỉ

**UC sở hữu:** UC06, UC07, UC08 (Tìm kiếm/Chi tiết/Học thử) · UC13, UC14 (Khóa đã mua/Bài giảng) ·
**UC15** (Tải tài liệu) · **UC19** (Đánh giá) · **UC20** (Chứng chỉ).

**Backend:**
- `controller/CourseController.java`, `service/CourseService.java`
- `controller/EnrollmentController.java`, `service/EnrollmentService.java`
- `model/CourseDocument.java`, `repository/CourseDocumentRepository`
- **Mới:** signed URL + watermark cho UC15 · `Review` model/controller/service (UC19) ·
  `Certificate` model + sinh PDF + QR + trang xác minh công khai (UC20)

**Frontend:**
- `pages/student/CoursesPage, CourseDetailPage` · `api/courseService.ts, enrollmentService.ts`
- **Mới:** UI tải tài liệu (UC15) · UI đánh giá sao + review (UC19) · trang `/certificates` xem & tải PDF (UC20)

**Việc còn phải code:** UC15 (tải có bảo mật) · UC19 (đánh giá — BE+FE mới) · UC20 (chứng chỉ PDF+QR — module
mới) · UC08 (đánh dấu/hiển thị bài học thử rõ ràng).

---

### 🟨 TV3 · Khảo thí, Bài tập & Tương tác học

**UC sở hữu:** UC16 (Nộp bài tập) · UC17 (Làm bài kiểm tra) · UC18 (Điểm & tiến độ HS) · UC21 (Hỏi GV) ·
UC35 (Chấm bài tập) · UC36 (GV trả lời) · *UC22, UC23 (AI — stretch)*.

**Backend:**
- `controller/QuizController.java`, `service/QuizService.java`, `controller/ExamController.java`, `service/ExamService.java`
- `controller/QaController.java`, `service/QaService.java` (Q&A cả hai chiều HS↔GV)
- `model/QuizConfig, QuizAttempt, ExamConfig, QaThread, QaMessage`
- **Mới:** `Assignment` + `AssignmentSubmission` model/controller/service (UC16) · endpoint chấm điểm (UC35) ·
  endpoint tổng hợp điểm & tiến độ (UC18)

**Frontend:**
- `pages/student/StudentQuizPage, MessagesPage` · `pages/teacher/TeacherGradesPage, TeacherQAPage`
- `api/quizService.ts, examService.ts, qaService.ts`
- **Mới:** UI nộp bài tập (UC16) · wire TeacherGradesPage chấm điểm (UC35) · trang tiến độ HS (UC18)

**Việc còn phải code:** UC16 + UC35 (hệ thống bài tập + chấm — module mới) · UC18 (trang điểm/tiến độ riêng).
*Stretch:* UC22 Chat AI, UC23 Lộ trình AI (chỉ khi còn thời gian / làm bản rule-based).

---

### 🟧 TV4 · Giáo viên (authoring) & Liên kết Phụ huynh

**UC sở hữu:** UC30-34 (Tạo khóa/Nội dung/Question bank/Exam) · UC24 (Theo dõi tiến độ con) ·
**UC25** (Liên hệ GV) · **UC27** (Gửi lời mời) · **UC28** (Chấp nhận/từ chối) · UC29 (Hủy liên kết).

**Backend:**
- `controller/TeacherCourseController.java`, `service/TeacherCourseService.java`, `controller/UploadController.java`, `service/ContentUploadService.java`
- `controller/QuestionController.java`, `service/QuestionService.java`
- `controller/ParentController.java`, `service/ParentService.java`, `model/ParentStudentLink.java`, `repository/ParentStudentLinkRepository`
- **Mới:** luồng invite/accept/reject liên kết PH–HS (UC27, UC28) · kênh liên hệ GV cho PH (UC25)

**Frontend:**
- `pages/teacher/TeacherCoursesPage, TeacherContentPage, QuestionBankPage, TeacherQuizChapterPage, TeacherExamPage`
- `pages/parents/ParentDashboard, ParentProgress, ParentMessages, ParentStudentLink`
- `api/teacherCourseService.ts, questionService.ts, parentService.ts`

**Việc còn phải code:** Teacher authoring (UC30-34) đã gần xong → **bảo trì + viết test**. Trọng tâm code mới:
UC24 (thay mock bằng API thật), UC25 (PH liên hệ GV), UC27 (gửi lời mời), UC28 (chấp nhận/từ chối).

---

### 🟥 TV5 · Quản trị & Khiếu nại

**UC sở hữu:** UC38 (Dashboard) · UC39 (DS tài khoản) · UC40 (Mở/khóa tài khoản) · UC41 (Duyệt khóa học) ·
**UC12** (HS/PH gửi khiếu nại) · **UC42** (Admin xử lý khiếu nại) · **UC26** (Lịch sử thanh toán của con).

**Backend:**
- `controller/AdminDashboardController.java`, `service/AdminDashboardService.java`
- `controller/AdminUserController.java`
- `controller/AdminApprovalController.java`, `service/ApprovalService.java`, `model/ApprovalHistory`
- **Mới:** `Complaint`/`Ticket` model + controller + service (UC12 gửi, UC42 xử lý) · truy vấn lịch sử thanh
  toán theo con cho PH (UC26 — đọc Order, phối hợp TV1)

**Frontend:**
- `pages/admin/DashboardAdmin, ApprovalsPage, CourseReviewPage` · `pages/student/ComplaintsPage` · `api/adminService.ts`
- **Mới:** wire tab Users (UC39, UC40) · hoàn thiện CourseReview (UC41) · UI khiếu nại HS/PH (UC12) + tab xử lý
  (UC42) · màn lịch sử thanh toán của con cho PH (UC26)

**Việc còn phải code:** UC12 + UC42 (hệ thống khiếu nại — BE+FE mới) · UC26 (lịch sử thanh toán con) ·
wire FE UC39/40/41 (BE đã có).

---

## 5. Sở hữu schema dùng chung & thứ tự migration

Nhiều entity bị nhiều người động vào → quy định **chủ sở hữu schema** để tránh xung đột cột/migration:

| Entity | Chủ sở hữu | Người dùng chung (chỉ đọc / xin thêm cột qua chủ) |
|---|---|---|
| `Profile` (thêm cột `grade`) | TV1 | TV4 (parent), TV5 (admin user) |
| `Course`, `Chapter`, `Lesson` | TV2 | TV4 (GV tạo), TV5 (duyệt) |
| `Order`, `RevenueSplit`, `PayoutPeriod` | TV1 | TV5 (UC26 đọc), TV4 |
| `ParentStudentLink` | TV4 | TV5 |
| `Assignment`, `QuizAttempt` | TV3 | TV2 (UC20 cert đọc pass), TV4 (UC24) |
| `Complaint`, `Notification` | TV5 / TV1 | tất cả (chỉ tạo qua API của chủ) |

**Quy tắc migration:** mọi thay đổi DB ghi vào **một thư mục migration đánh số tăng dần** do TV1 gác cổng;
không ai tự sửa bảng của module khác — gửi yêu cầu thêm cột cho chủ sở hữu.

---

## 6. Phụ thuộc chéo & điểm tích hợp (cần hẹn checkpoint)

| Tính năng | Phụ thuộc dữ liệu của | Ghi chú |
|---|---|---|
| UC18 Tiến độ HS (TV3) | quiz/bài tập (TV3) + enrollment (TV2) | thống nhất công thức % hoàn thành |
| UC20 Chứng chỉ (TV2) | điều kiện *pass bài kiểm tra* (TV3) | TV3 cung cấp API "đã pass?" |
| UC24/UC26 Parent (TV4/TV5) | quiz (TV3) + Order (TV1) | đọc qua API, không query thẳng bảng |
| UC44 Thông báo (TV1) | mọi module bắn notify (duyệt khóa, payout, Q&A) | TV1 cung cấp 1 API `notify()` chung |

> Thông báo (UC44) là **hạ tầng dùng chung**: các TV khác chỉ gọi API của TV1, không tự dựng cơ chế riêng.

---

## 7. Quy tắc làm việc chung (code song song, tránh đụng nhau)

1. **Branch theo UC:** `feature/uc16-nop-bai-tap`, `feature/uc43-payout-export`... Mỗi UC một PR nhỏ.
2. **File dùng chung chỉ TV1 sửa:** `App.tsx`, `client.ts`, Spring Security, enum/DTO chung, `application.yml`,
   migration SQL. Cần thêm route/endpoint chung → báo TV1 gộp một lần.
3. **Mỗi TV ưu tiên tạo file mới** (controller/service/page riêng) thay vì sửa file của người khác.
4. **Quy ước theo CLAUDE.md:** UI text tiếng Việt; dùng CSS var Material Design 3 (`bg-surface`,
   `text-on-surface`...), không dùng màu Tailwind trực tiếp cho surface/text; commit **không** kèm
   `Co-Authored-By`; dev server chạy port **3000**.
5. **Test theo SRS:** mỗi UC viết tối thiểu 1 happy-path (từ Tiêu chí chấp nhận) + 1 negative (từ Ngoại lệ) —
   đúng mã UT/IT/ST trong Ma trận truy xuất (Bảng 49 SRS). Coverage mục tiêu ≥ 70%.
6. **Sync hằng ngày:** trước khi push, `git pull --rebase` nhánh chính; conflict ở file chung → TV1 xử lý.

---

## 8. Lưu ý đối chiếu SRS (để báo cáo giảng viên)

- **SRS ghi VNPay/MoMo, code dùng PayOS** → cập nhật SRS ghi nhận PayOS như quyết định thay thế (hoặc ghi chú
  "deviation được duyệt"), tránh mâu thuẫn khi chấm.
- **AI (UC22, UC23)** đưa vào diện *stretch goal*, không tính vào phạm vi bắt buộc do chưa có AI Engine.
- Các NFR cần bổ sung để đủ điểm: gửi **email thông báo** thật, **mã hóa AES-256** TK ngân hàng GV,
  **audit log** thao tác tài chính/Admin, **watermark** tài liệu/chứng chỉ.

---

## 9. Phân bổ công việc theo trạng thái

| TV | UC đã xong (bảo trì + test) | UC code mới | Điểm |
|---|---|---|---|
| **TV1** | UC01-05, 09, 10, 11, 37 | **UC43, UC44** + wire UC11 + hạ tầng + điều phối | **≈ 18** |
| TV2 | UC06, 07, 13, 14 | UC15, UC19, UC20 (+UC08) | ≈ 11 |
| TV3 | UC17, 21, 36 | UC16, UC35, UC18 (+UC22/23 stretch) | ≈ 10 |
| TV4 | UC30-34, 29 | UC24, UC25, UC27, UC28 | ≈ 10 |
| TV5 | UC38, 39, 40, 41 (BE) | UC12, UC42, UC26 + wire FE 39/40/41 | ≈ 10 |

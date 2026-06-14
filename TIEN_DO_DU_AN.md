# 📊 Báo Cáo Tiến Độ Dự Án & Định Hướng Phát Triển — Bee Academy

Tài liệu này ghi lại chi tiết trạng thái tiến độ các chức năng (Use Case), các file không cần thiết trong dự án và các bước tiếp theo cần triển khai.

---

## 🗑️ 1. Các File Không Cần Thiết / File Rác Trong Workspace

Các file và thư mục dưới đây không trực tiếp tham gia vào việc chạy code của hệ thống, chủ yếu là tài liệu học tập hoặc thư mục trống:

| Đường dẫn file | Vai trò / Mô tả | Hướng xử lý |
| :--- | :--- | :--- |
| `Image 1.png.html` | File HTML nhúng ảnh chụp màn hình thiết kế để đối chiếu | Giữ lại tham khảo, xóa khi đóng gói deploy |
| `Image 11.png.html` | File HTML nhúng ảnh chụp màn hình thiết kế để đối chiếu | Giữ lại tham khảo, xóa khi đóng gói deploy |
| `Image 7.png.html` | File HTML nhúng ảnh chụp màn hình thiết kế để đối chiếu | Giữ lại tham khảo, xóa khi đóng gói deploy |
| `www.4user.net_ (1).png` | Ảnh chụp màn hình giao diện tham khảo từ nguồn bên ngoài | Giữ lại tham khảo, xóa khi đóng gói deploy |
| `baocaolan1.md` | Tài liệu ghi yêu cầu báo cáo tiến độ lần 1 của môn học | Giữ lại tham khảo khi nộp báo cáo |
| `Thông tin trang web.txt` | Bản sao chép đặc tả Use Case v6.5 (trùng lặp với `BEE ACADEMY.md`) | Có thể xóa vì nội dung đã nằm trong `BEE ACADEMY.md` |
| `frontend/src/pages/parents/` | Thư mục trống bên trong frontend | Để nguyên để chuẩn bị code Phân hệ Phụ huynh |

---

## 📊 2. Bảng Theo Dõi Tiến Độ Chi Tiết (UseCase v6.5)

Hệ thống được cấu trúc gồm **48 Use Cases (UC)** chia thành **9 Phân hệ (Module)**.

### 🔑 Module 1: Xác Thực & Tài Khoản (Đã hoàn thành 100%)
*Tất cả chức năng đã được kết nối API thực tế và hoạt động ổn định:*
- [x] **UC01 - Đăng ký tài khoản:** Hỗ trợ nhập thông tin, gửi mã OTP qua email xác thực và tạo tài khoản.
- [x] **UC02 - Đăng nhập hệ thống:** Đăng nhập bằng Email/Password hoặc Đăng nhập nhanh với Google (Google OAuth2).
- [x] **UC03 - Đăng xuất hệ thống:** Xóa session client-side và vô hiệu hóa token trên server.
- [x] **UC04 - Đặt lại mật khẩu:** Gửi OTP qua email xác nhận để thay đổi mật khẩu mới.
- [x] **UC05 - Cập nhật hồ sơ cá nhân:** Xem thông tin cá nhân, sửa hồ sơ và tải lên ảnh đại diện thật (lưu trữ Cloudinary).

### 🔍 Module 2: Tìm Kiếm & Khóa Học (Hoàn thành 70%)
- [x] **UC06 - Tìm kiếm & lọc khóa học:** Giao diện `/courses` đã kết nối API thật, lọc động theo Môn học (tải từ DB), Lớp học (6-9) và từ khóa tìm kiếm (có bộ đệm debounce 300ms).
- [ ] **UC07 - Xem chi tiết khóa học:** Đã viết xong `courseService.ts` nhưng trang `/courses/:id` vẫn đang render dữ liệu tĩnh `MOCK_COURSES`.
- [ ] **UC08 - Xem bài học thử:** Hỗ trợ xem trước video bài giảng của các bài học miễn phí (`isFree = true`) ngay khi chưa mua khóa học (Chờ kết nối dữ liệu thật cùng UC07).

### 💳 Module 3: Mua Hàng & Thanh Toán (Chưa tích hợp API thật)
*Hiện tại các luồng này đang chạy bằng dữ liệu giả lập (Mock UI):*
- [ ] **UC09 - Mua và thanh toán khóa học:** Giao diện thanh toán `/checkout` hiển thị mã QR giả lập và bộ đếm ngược 15 phút. Chưa tích hợp cổng VNPay/MoMo.
- [ ] **UC10 - Xem lịch sử mua khóa học:** Trang `/orders` đang hiển thị dữ liệu tĩnh.
- [ ] **UC11 - Gửi khiếu nại đến Admin:** Chưa xây dựng giao diện gửi khiếu nại (thay thế cho nút hoàn tiền).

### 📖 Module 4: Học Tập (Hoàn thành 75% - UI đầy đủ)
*Giao diện học bài đã thiết kế rất chi tiết, hiện đang chờ kết nối dữ liệu thật:*
- [x] **UC12 - Xem danh sách khóa học đã mua:** Hiển thị tiến độ hoàn thành (%) trực quan trên card khóa học.
- [x] **UC13 - Xem bài giảng & tài liệu:** Giao diện học bài (LearningView) gồm video player và trình xem PDF.
- [x] **UC14 - Tải tài liệu học tập:** Nút tải file đính kèm từ bài giảng.
- [ ] **UC15 - Nộp bài tập:** Tính năng nộp bài tự luận chưa được phát triển.
- [x] **UC16 - Làm quiz chương:** Modal làm bài trắc nghiệm tự động mở khi học xong chương. Có chấm điểm trực quan (SVG Score Circle) và giải thích đáp án đúng/sai.
- [ ] **UC17 - Làm bài kiểm tra:** Bài kiểm tra cuối khóa/định kỳ chưa kích hoạt.
- [x] **UC18 - Xem điểm & tiến độ học tập:** Lưu điểm quiz và hiển thị tiến độ học tập.
- [x] **UC19 - Đánh giá khóa học:** Đã có giao diện đánh giá và chấm điểm sao cho khóa học.

### 💬 Module 5: Tương Tác & Hỗ Trợ (Hoàn thành 30%)
- [x] **UC20 - Gửi câu hỏi cho giáo viên:** Tab Q&A trong phòng học để học sinh đặt câu hỏi trực tiếp.
- [ ] **UC21 - Chat AI hỗ trợ:** Tính năng chat với AI tư vấn học tập chưa tích hợp.
- [ ] **UC22 - Nhận đề xuất lộ trình từ AI:** Chưa phát triển.

### 👨‍👩‍👧 Module 6: Phân Hệ Phụ Huynh (Chưa bắt đầu)
- [ ] **UC23 - Theo dõi tiến độ học tập của con:** Chưa xây dựng giao diện.
- [ ] **UC24 - Liên hệ & nhận thông báo từ GV:** Chưa xây dựng giao diện.
- [ ] **UC25 - Xem lịch sử thanh toán khóa học:** Chưa xây dựng giao diện.
- [ ] **UC47 - Gửi lời mời liên kết con:** Chưa phát triển.
- [ ] **UC48 - Chấp nhận/Từ chối liên kết:** Chưa phát triển.
- [ ] **UC49 - Hủy liên kết tài khoản:** Chưa phát triển.

### 👨‍🏫 Module 7: Phân Hệ Giáo Viên (Đang dựng UI - 0% API)
*Frontend đã hoàn thành 11 trang giao diện tĩnh (Skeleton) tại `/teacher/**`, backend chưa xây dựng API:*
- [ ] **UC26 - Xem dashboard doanh thu**
- [ ] **UC27 - Tạo khóa học mới**
- [ ] **UC28 - Cập nhật bài giảng & tài liệu**
- [ ] **UC29 - Tạo quiz chương**
- [ ] **UC30 - Tạo bài kiểm tra**
- [ ] **UC31 - Chấm điểm bài tập**
- [ ] **UC32 - Trả lời câu hỏi học sinh**
- [ ] **UC33 - Xem lịch sử doanh thu**
- [ ] **UC45 - Nhập thông tin TK ngân hàng**
- [ ] **UC46 - Cập nhật TK ngân hàng**

### 👑 Module 8: Quản Trị Viên (Admin) (Hoàn thành 10%)
- [x] **UC34 - Xem dashboard quản trị:** Giao diện chính tổng hợp doanh thu và số tiền cần thanh toán cho giáo viên (dữ liệu mock).
- [ ] **UC35 - UC41 (Quản lý user, Duyệt khóa học, Báo cáo tài chính, Xuất Excel thanh toán giáo viên, Xác nhận chuyển khoản GV):** Đang sử dụng trang chờ (ComingSoonPage).

### 🎓 Module 9: Chứng Chỉ (Chưa bắt đầu)
- [ ] **UC42 - Cấp chứng chỉ hoàn thành:** Hệ thống tự động kích hoạt khi học sinh đạt điểm đỗ bài test cuối khóa.
- [ ] **UC43 - Xem & tải chứng chỉ:** Xuất chứng chỉ học viên dạng file PDF.

---

## 🎯 3. Định Hướng Phát Triển Tiếp Theo (Sắp xếp theo thứ tự ưu tiên)

1.  **Phát triển Phân hệ Phụ huynh (Parent Portal):**
    *   Tạo các trang giao diện trong thư mục `frontend/src/pages/parents/`.
    *   Đăng ký các route phụ huynh trong `frontend/src/App.tsx`.
    *   Thiết kế biểu đồ theo dõi tiến độ học tập và luồng gửi lời mời liên kết tài khoản học sinh.
2.  **Sửa lỗi Enum `course_status` ở Backend:**
    *   Chỉnh sửa backend Java để serialize Enum ăn khớp với chữ thường (`published`, `draft`...) trong database Postgres của Supabase.
3.  **Tích hợp API thật cho trang Chi tiết khóa học (`CourseDetailPage.tsx`):**
    *   Thay thế dữ liệu tĩnh `MOCK_COURSES` bằng dữ liệu trả về từ API `getCourseDetail`.
    *   Đảm bảo video bài giảng thật chạy được với dữ liệu bài học trả về từ backend.
4.  **Tích hợp cổng thanh toán VNPay / MoMo:**
    *   Xây dựng API tạo URL thanh toán ở backend và cấu hình trang kết quả `/payment-result`.

# 📊 Báo Cáo Tiến Độ Dự Án & Định Hướng Phát Triển — Bee Academy

Tài liệu này ghi lại trạng thái tiến độ các chức năng của dự án Bee Academy, đồng thời đã được chỉnh lại để khớp với file đặc tả `SWT_v4_final(7).docx`.

**Cơ sở đối chiếu:** SRS Bee Academy – Online Learning Platform, phiên bản 1.0 / lịch sử phiên bản 4.0, gồm **8 module** và **44 use case**.

---

## 🧭 0. Các điểm đã chỉnh so với bản `.md` cũ

| Nội dung cũ | Đã chỉnh theo `SWT_v4_final(7).docx` |
| :--- | :--- |
| Ghi hệ thống có **48 UC / 9 module** | Sửa thành **44 UC / 8 module** |
| Tách riêng **Module Chứng Chỉ** | Gộp vào **Module Học Tập**: `REQ-LRN-008 / UC20 - Xem và tải chứng chỉ` |
| Module Thanh toán chỉ có 3 UC | Sửa thành 4 UC: `UC09` mua khóa học, `UC10` thanh toán, `UC11` lịch sử mua, `UC12` khiếu nại |
| Module Phụ huynh dùng UC23-25 và UC47-49 | Sửa thành `UC24` đến `UC29` |
| Module Giáo viên có UC45-46 tài khoản ngân hàng | Bỏ vì không có trong SRS; thay bằng `Tạo/Cập nhật question bank` |
| Module Admin dùng UC34-41 | Sửa thành `UC38` đến `UC44` |
| `Làm quiz chương` là UC riêng | Không còn là UC riêng trong SRS; nội dung kiểm tra được quy về `UC17 - Làm bài kiểm tra` và các UC liên quan |

---

## 🗑️ 1. Các File Không Cần Thiết / File Rác Trong Workspace

Các file và thư mục dưới đây không trực tiếp tham gia vào việc chạy code của hệ thống, chủ yếu là tài liệu học tập, ảnh đối chiếu giao diện hoặc thư mục chuẩn bị cho chức năng sau.

| Đường dẫn file | Vai trò / Mô tả | Hướng xử lý |
| :--- | :--- | :--- |
| `Image 1.png.html` | File HTML nhúng ảnh chụp màn hình thiết kế để đối chiếu | Giữ lại tham khảo, xóa khi đóng gói deploy |
| `Image 11.png.html` | File HTML nhúng ảnh chụp màn hình thiết kế để đối chiếu | Giữ lại tham khảo, xóa khi đóng gói deploy |
| `Image 7.png.html` | File HTML nhúng ảnh chụp màn hình thiết kế để đối chiếu | Giữ lại tham khảo, xóa khi đóng gói deploy |
| `www.4user.net_ (1).png` | Ảnh chụp màn hình giao diện tham khảo từ nguồn bên ngoài | Giữ lại tham khảo, xóa khi đóng gói deploy |
| `baocaolan1.md` | Tài liệu ghi yêu cầu báo cáo tiến độ lần 1 của môn học | Giữ lại tham khảo khi nộp báo cáo |
| `Thông tin trang web.txt` | Bản sao đặc tả/use case cũ, có thể trùng với tài liệu chính | Có thể xóa nếu nội dung đã được thay thế bằng `SWT_v4_final(7).docx` hoặc tài liệu SRS chính |
| `frontend/src/pages/parents/` | Thư mục chuẩn bị cho phân hệ Phụ huynh | Giữ lại để triển khai Parent Portal |

---

## 📊 2. Bảng Theo Dõi Tiến Độ Chi Tiết Theo SRS

**Quy ước trạng thái:**

| Ký hiệu | Ý nghĩa |
| :--- | :--- |
| ✅ Hoàn thành | Đã có chức năng chính, đã nối API hoặc đã hoạt động theo luồng hiện tại |
| 🟡 Đang làm / UI mock | Đã có giao diện, skeleton hoặc service, nhưng chưa hoàn chỉnh theo SRS / chưa nối API thật |
| ⬜ Chưa làm | Chưa phát triển hoặc chưa có giao diện/luồng chính |

---

### 🔑 Module 1: Xác Thực & Tài Khoản — `REQ-AUTH` / `UC01-UC05`

**Tình trạng:** Hoàn thành tốt phần chính. Các chức năng xác thực đã có luồng hoạt động thực tế.

| UC | REQ | Chức năng theo SRS | Trạng thái | Ghi chú tiến độ |
| :--- | :--- | :--- | :--- | :--- |
| UC01 | REQ-AUTH-001 | Đăng ký tài khoản | ✅ Hoàn thành | Có luồng nhập thông tin, xác thực email/OTP và tạo tài khoản. |
| UC02 | REQ-AUTH-002 | Đăng nhập hệ thống | ✅ Hoàn thành | Có đăng nhập Email/Password; Google OAuth2 là phần mở rộng thêm so với SRS. |
| UC03 | REQ-AUTH-003 | Đăng xuất hệ thống | ✅ Hoàn thành | Xóa phiên/token phía client và xử lý đăng xuất. |
| UC04 | REQ-AUTH-004 | Đặt lại mật khẩu | ✅ Hoàn thành | Có luồng gửi mã/link xác nhận qua email để đổi mật khẩu mới. |
| UC05 | REQ-AUTH-005 | Cập nhật hồ sơ cá nhân | ✅ Hoàn thành | Có xem/sửa hồ sơ và tải ảnh đại diện, lưu trữ Cloudinary. |

---

### 🔍 Module 2: Tìm Kiếm & Khóa Học — `REQ-CRS` / `UC06-UC08`

**Tình trạng:** Đã có tìm kiếm thật; chi tiết khóa học và học thử vẫn cần nối dữ liệu thật.

| UC | REQ | Chức năng theo SRS | Trạng thái | Ghi chú tiến độ |
| :--- | :--- | :--- | :--- | :--- |
| UC06 | REQ-CRS-001 | Tìm kiếm khóa học | ✅ Hoàn thành | Trang `/courses` đã nối API thật, lọc theo môn học từ DB, lớp 6-9 và từ khóa tìm kiếm; có debounce 300ms. |
| UC07 | REQ-CRS-002 | Xem chi tiết khóa học | 🟡 Đang làm | Đã có `courseService.ts`, nhưng trang `/courses/:id` vẫn render dữ liệu tĩnh `MOCK_COURSES`. |
| UC08 | REQ-CRS-003 | Xem bài học thử | 🟡 Đang làm | Cần phụ thuộc dữ liệu thật của UC07; chỉ các bài `isFree = true` mới được xem thử theo SRS. |

---

### 💳 Module 3: Mua Hàng & Thanh Toán — `REQ-PAY` / `UC09-UC12`

**Tình trạng:** Mới dừng ở giao diện/mock UI, chưa tích hợp đầy đủ API thanh toán, webhook và revenue split.

| UC | REQ | Chức năng theo SRS | Trạng thái | Ghi chú tiến độ |
| :--- | :--- | :--- | :--- | :--- |
| UC09 | REQ-PAY-001 | Mua khóa học | 🟡 UI mock | Luồng xác nhận đơn hàng/chọn khóa học đã có hướng giao diện, nhưng chưa tạo Order thật theo định dạng `ORD-YYYYMMDD-XXXXX`. |
| UC10 | REQ-PAY-002 | Thanh toán khóa học | 🟡 UI mock | Trang `/checkout` đang hiển thị QR giả lập và bộ đếm ngược; chưa tích hợp VNPay/MoMo, webhook, audit log, `revenue_splits`. |
| UC11 | REQ-PAY-003 | Xem lịch sử mua khóa học | 🟡 UI mock | Trang `/orders` đang dùng dữ liệu tĩnh; chưa có lọc trạng thái/khoảng thời gian và hóa đơn PDF thật. |
| UC12 | REQ-PAY-004 | Gửi khiếu nại đến Admin | ⬜ Chưa làm | Chưa xây dựng giao diện gửi ticket khiếu nại và luồng Admin xử lý. |

---

### 📖 Module 4: Học Tập — `REQ-LRN` / `UC13-UC20`

**Tình trạng:** UI học tập đã khá đầy đủ, nhưng vẫn còn thiếu nộp bài, bài kiểm tra cuối và chứng chỉ.

| UC | REQ | Chức năng theo SRS | Trạng thái | Ghi chú tiến độ |
| :--- | :--- | :--- | :--- | :--- |
| UC13 | REQ-LRN-001 | Xem danh sách khóa học đã mua | ✅ Hoàn thành | Có danh sách khóa học đã sở hữu và hiển thị tiến độ phần trăm trên card. |
| UC14 | REQ-LRN-002 | Xem bài giảng & tài liệu | ✅ Hoàn thành | Giao diện `LearningView` có video player và trình xem PDF/tài liệu. |
| UC15 | REQ-LRN-003 | Tải tài liệu học tập | ✅ Hoàn thành | Đã có nút tải tài liệu; cần rà lại signed URL/log/watermark nếu muốn đúng đầy đủ theo SRS. |
| UC16 | REQ-LRN-004 | Nộp bài tập | ⬜ Chưa làm | Chưa phát triển luồng nộp bài tự luận/upload file và gửi thông báo cho giáo viên. |
| UC17 | REQ-LRN-005 | Làm bài kiểm tra | ⬜ Chưa làm | Bài kiểm tra cuối khóa/định kỳ chưa kích hoạt đầy đủ theo điều kiện hoàn thành 100% nội dung. |
| UC18 | REQ-LRN-006 | Xem điểm & tiến độ học tập | ✅ Hoàn thành | Có lưu điểm quiz và hiển thị tiến độ học tập. |
| UC19 | REQ-LRN-007 | Đánh giá khóa học | ✅ Hoàn thành | Đã có giao diện đánh giá, nhận xét và chấm sao cho khóa học. |
| UC20 | REQ-LRN-008 | Xem và tải chứng chỉ | ⬜ Chưa làm | Đây là phần chứng chỉ trong SRS, không tách thành module riêng. Cần sinh PDF chứng chỉ có QR xác minh. |

---

### 💬 Module 5: Tương Tác & Hỗ Trợ — `REQ-INT` / `UC21-UC23`

**Tình trạng:** Có Q&A cơ bản; AI chưa tích hợp.

| UC | REQ | Chức năng theo SRS | Trạng thái | Ghi chú tiến độ |
| :--- | :--- | :--- | :--- | :--- |
| UC21 | REQ-INT-001 | Gửi câu hỏi cho giáo viên | ✅ Hoàn thành | Có tab Q&A trong phòng học để học sinh gửi câu hỏi. |
| UC22 | REQ-INT-002 | Chat AI hỗ trợ | ⬜ Chưa làm | Chưa tích hợp AI Engine/chat widget. |
| UC23 | REQ-INT-003 | Nhận đề xuất lộ trình từ AI | ⬜ Chưa làm | Chưa phát triển lộ trình học cá nhân hóa theo dữ liệu học tập. |

---

### 👨‍👩‍👧 Module 6: Phân Hệ Phụ Huynh — `REQ-PRN` / `UC24-UC29`

**Tình trạng:** Chưa bắt đầu. Thư mục `frontend/src/pages/parents/` mới là phần chuẩn bị.

| UC | REQ | Chức năng theo SRS | Trạng thái | Ghi chú tiến độ |
| :--- | :--- | :--- | :--- | :--- |
| UC24 | REQ-PRN-001 | Theo dõi tiến độ học tập của con | ⬜ Chưa làm | Cần trang dashboard phụ huynh, biểu đồ tiến độ, điểm quiz/bài kiểm tra. |
| UC25 | REQ-PRN-002 | Liên hệ & nhận thông báo từ GV | ⬜ Chưa làm | Cần luồng nhắn tin/liên hệ giáo viên và nhận thông báo. |
| UC26 | REQ-PRN-003 | Xem lịch sử thanh toán khóa học | ⬜ Chưa làm | Cần danh sách giao dịch phụ huynh đã thanh toán cho con. |
| UC27 | REQ-PRN-004 | Gửi lời mời liên kết con | ⬜ Chưa làm | Cần form nhập email học sinh và gửi yêu cầu liên kết. |
| UC28 | REQ-PRN-005 | Chấp nhận / từ chối liên kết | ⬜ Chưa làm | Cần phía học sinh xác nhận hoặc từ chối liên kết. |
| UC29 | REQ-PRN-006 | Hủy liên kết tài khoản | ⬜ Chưa làm | Cần cho cả phụ huynh và học sinh hủy liên kết đang ACTIVE. |

---

### 👨‍🏫 Module 7: Phân Hệ Giáo Viên — `REQ-TCH` / `UC30-UC37`

**Tình trạng:** Frontend đã có hướng skeleton tại `/teacher/**`, backend/API chưa hoàn chỉnh theo SRS.

| UC | REQ | Chức năng theo SRS | Trạng thái | Ghi chú tiến độ |
| :--- | :--- | :--- | :--- | :--- |
| UC30 | REQ-TCH-001 | Tạo khóa học mới | 🟡 UI skeleton | Cần API tạo khóa, lưu nháp/gửi duyệt và trạng thái `PENDING_REVIEW`. |
| UC31 | REQ-TCH-002 | Cập nhật bài giảng & tài liệu | 🟡 UI skeleton | Cần API upload video/tài liệu, encode video và audit log. |
| UC32 | REQ-TCH-004 | Tạo question bank | 🟡 UI skeleton | Cần chức năng tạo ngân hàng câu hỏi theo lĩnh vực/mô tả. |
| UC33 | REQ-TCH-005 | Cập nhật question bank | 🟡 UI skeleton | Cần thêm/sửa/xóa/import câu hỏi từ Excel/CSV theo template. |
| UC34 | REQ-TCH-003 | Tạo bài kiểm tra | 🟡 UI skeleton | Cần tạo bài kiểm tra tổng hợp, cấu hình câu hỏi/thời gian/điểm pass/chống gian lận. |
| UC35 | REQ-TCH-006 | Chấm điểm bài tập | 🟡 UI skeleton | Cần API lấy bài nộp, nhập điểm/nhận xét và cập nhật tiến độ học. |
| UC36 | REQ-TCH-007 | Trả lời câu hỏi học sinh | 🟡 UI skeleton | Cần luồng giáo viên trả lời câu hỏi từ Q&A và gửi thông báo cho học sinh. |
| UC37 | REQ-TCH-008 | Xem lịch sử doanh thu | 🟡 UI skeleton | Cần bảng lịch sử nhận tiền, truy vết giao dịch nguồn và export Excel. |

---

### 👑 Module 8: Quản Trị Viên — `REQ-ADM` / `UC38-UC44`

**Tình trạng:** Dashboard đã có giao diện mock; các chức năng quản trị còn lại đang là trang chờ hoặc chưa có API.

| UC | REQ | Chức năng theo SRS | Trạng thái | Ghi chú tiến độ |
| :--- | :--- | :--- | :--- | :--- |
| UC38 | REQ-ADM-001 | Xem dashboard quản trị | 🟡 UI mock | Đã có giao diện tổng hợp doanh thu/số tiền cần thanh toán cho giáo viên, nhưng dữ liệu còn mock. |
| UC39 | REQ-ADM-002 | Xem danh sách tài khoản người dùng | ⬜ Chưa làm | Cần danh sách user, tìm kiếm/lọc theo vai trò/trạng thái. |
| UC40 | REQ-ADM-003 | Cập nhật tài khoản người dùng | ⬜ Chưa làm | Cần khóa/mở khóa, đổi vai trò, reset mật khẩu theo quyền Admin. |
| UC41 | REQ-ADM-004 | Duyệt khóa học | ⬜ Chưa làm | Cần luồng Approve / Reject / Needs Revision cho khóa học giáo viên gửi. |
| UC42 | REQ-ADM-005 | Xử lý khiếu nại từ người dùng | ⬜ Chưa làm | Cần danh sách ticket, trả lời, cập nhật trạng thái khiếu nại. |
| UC43 | REQ-ADM-006 | Xác nhận đã chuyển khoản GV | ⬜ Chưa làm | Cần ghi nhận ngày chuyển khoản, nội dung chuyển khoản, file UNC và trạng thái payout. |
| UC44 | REQ-ADM-007 | Gửi thông báo đến người dùng | ⬜ Chưa làm | Cần gửi thông báo theo nhóm người dùng qua in-app/email/push. |

---

## 📌 3. Tổng Hợp Tiến Độ Theo Module

| Module | Phạm vi UC | Trạng thái tổng quan | Việc còn thiếu chính |
| :--- | :--- | :--- | :--- |
| Xác Thực & Tài Khoản | UC01-UC05 | ✅ Hoàn thành | Rà lại bảo mật theo SRS: bcrypt, khóa sau 5 lần sai, vô hiệu session cũ. |
| Tìm Kiếm & Khóa Học | UC06-UC08 | 🟡 Đang làm | Nối API thật cho chi tiết khóa học và học thử miễn phí. |
| Mua Hàng & Thanh Toán | UC09-UC12 | 🟡 UI mock | Tạo Order, tích hợp VNPay/MoMo, webhook, revenue split, lịch sử mua, khiếu nại. |
| Học Tập | UC13-UC20 | 🟡 Khá hoàn thiện UI | Bổ sung nộp bài, bài kiểm tra cuối, signed URL/log/watermark tài liệu, chứng chỉ PDF QR. |
| Tương Tác & Hỗ Trợ | UC21-UC23 | 🟡 Một phần | Hoàn thiện Q&A nếu cần API thật; tích hợp AI chat và AI roadmap. |
| Phụ Huynh | UC24-UC29 | ⬜ Chưa bắt đầu | Xây Parent Portal và luồng liên kết phụ huynh - học sinh. |
| Giáo Viên | UC30-UC37 | 🟡 UI skeleton | Xây API cho course, lesson, question bank, test, grading, Q&A, revenue. |
| Admin | UC38-UC44 | 🟡 UI mock/chưa làm | Quản lý user, duyệt khóa học, xử lý khiếu nại, payout GV, gửi thông báo. |

---

## 🎯 4. Định Hướng Phát Triển Tiếp Theo Theo Đúng SRS

1. **Hoàn thiện `UC07` và `UC08` trước**
   - Tích hợp API thật cho `CourseDetailPage.tsx`.
   - Thay `MOCK_COURSES` bằng dữ liệu trả về từ API `getCourseDetail`.
   - Bảo đảm chỉ bài học `isFree = true` được học thử.

2. **Tách rõ luồng mua và thanh toán theo `UC09` - `UC10`**
   - `UC09`: tạo Order trạng thái `PENDING`, kiểm tra người dùng đã sở hữu khóa hay chưa.
   - `UC10`: tích hợp VNPay/MoMo, xác minh webhook, cập nhật `PAID`, cấp quyền học, ghi `revenue_splits`.

3. **Xây `UC11` và `UC12` để hoàn chỉnh sau thanh toán**
   - `UC11`: lịch sử mua hàng, lọc trạng thái/thời gian, chi tiết hóa đơn PDF.
   - `UC12`: form gửi khiếu nại, tạo ticket, theo dõi trạng thái ticket.

4. **Phát triển Phân hệ Phụ huynh `UC24-UC29`**
   - Tạo giao diện trong `frontend/src/pages/parents/`.
   - Đăng ký route phụ huynh trong `frontend/src/App.tsx`.
   - Làm luồng gửi lời mời liên kết, chấp nhận/từ chối và hủy liên kết.
   - Làm dashboard theo dõi tiến độ học tập của con.

5. **Xây API cho Phân hệ Giáo viên `UC30-UC37`**
   - Ưu tiên: tạo khóa học, cập nhật bài giảng/tài liệu, question bank, bài kiểm tra.
   - Sau đó làm chấm bài, trả lời Q&A và lịch sử doanh thu.

6. **Hoàn thiện Admin Panel `UC38-UC44`**
   - Thay dữ liệu mock bằng API dashboard thật.
   - Làm quản lý user, duyệt khóa học, xử lý khiếu nại, xác nhận chuyển khoản GV và gửi thông báo.

7. **Bổ sung phần chứng chỉ đúng vị trí `UC20` trong Module Học Tập**
   - Sinh chứng chỉ PDF khi học sinh hoàn thành 100% và pass bài kiểm tra cuối.
   - Gắn mã QR xác minh công khai.
   - Cho phép học sinh xem và tải chứng chỉ.

---

## ✅ 5. Ghi Chú Quan Trọng Khi Nộp Báo Cáo

- Không ghi hệ thống có 48 UC vì file SRS hiện tại chỉ có **44 UC**.
- Không tách chứng chỉ thành module số 9; chứng chỉ nằm trong **Module 4 - Học Tập**.
- Không dùng lại UC47, UC48, UC49 cho Parent Portal; trong SRS chúng tương ứng là **UC27, UC28, UC29**.
- Không liệt kê UC45, UC46 về tài khoản ngân hàng giáo viên vì không xuất hiện trong SRS hiện tại.
- Khi trình bày tiến độ, nên phân biệt rõ **UI mock/skeleton** với **chức năng đã nối API thật** để tránh bị hỏi phản biện.

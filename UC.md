**BEE ACADEMY**

**USE CASE SPECIFICATION**

**Phần 1 — Danh sách Actor**

7 actor. Giáo viên là đối tác cộng tác — xem doanh thu realtime nhưng nhận tiền thủ công từ Admin cuối kỳ theo hợp đồng dịch vụ đã ký.

| ID | Actor | Loại | Mô tả |
| :---- | :---- | :---- | :---- |
| A01 | Guest (Khách) | Primary | Người dùng chưa đăng nhập, truy cập trang công khai |
| A02 | Học sinh | Primary | Kế thừa Guest — mua khóa học, học tự do theo tiến độ cá nhân, làm quiz và kiểm tra |
| A03 | Phụ huynh | Primary | Kế thừa Guest — theo dõi tiến độ học tập và thanh toán cho con |
| A04 | Giáo viên | Primary | Tạo khóa học, upload tài liệu, tạo quiz/kiểm tra, nhập TK ngân hàng, xem báo cáo doanh thu và lịch sử nhận tiền |
| A05 | Admin | Primary | Duyệt khóa học, xử lý yêu cầu, xác nhận chuyển khoản cho GV, báo cáo tổng |
| A06 | AI Engine | External | Hệ thống AI — tạo câu hỏi tự động, đề xuất lộ trình học |
| A07 | Payment Gateway | External | VNPay / MoMo — xử lý thanh toán, gửi webhook về backend |

 

**Phần 2 — Danh sách Use Case theo Module**

44 UC tổ chức thành 8 module. Tên UC theo quy tắc: Động từ \+ Danh từ. Không có tính năng livestream, lịch học cố định, hoặc chuyển tiền tự động.

**Module 1 — Xác thực & Tài khoản  (5 UC)**

| ID | Tên Use Case | Actor | Ghi chú |
| :---- | :---- | :---- | :---- |
| UC01 | Đăng ký tài khoản | Guest | — |
| UC02 | Đăng nhập hệ thống | Học sinh, PH, GV, Admin | — |
| UC03 | Đăng xuất hệ thống | Học sinh, PH, GV, Admin | — |
| UC04 | Đặt lại mật khẩu | Guest | — |
| UC05 | Cập nhật hồ sơ cá nhân | Học sinh, PH, GV | — |

 

**Module 2 — Tìm kiếm & Khóa học  (3 UC)**

| ID | Tên Use Case | Actor | Ghi chú |
| :---- | :---- | :---- | :---- |
| UC06 | Tìm kiếm khóa học | Guest | — |
| UC07 | Xem chi tiết khóa học | Guest | — |
| UC08 | Xem bài học thử | Guest | \<\<extend\>\> UC07 — khi isFree \= true |

 

**Module 3 — Mua hàng & Thanh toán  (3 UC)**

Tiền về thẳng TK công ty qua VNPay/MoMo. Hệ thống tự ghi nhận phần GV và phần nền tảng vào revenue\_splits. Admin chuyển thủ công cuối kỳ.

| ID | Tên Use Case | Actor | Ghi chú |
| :---- | :---- | :---- | :---- |
| UC09 | Mua khóa học | Học sinh, PH | → A07 VNPay/MoMo → tiền về TK công ty |
| UC10 | thanh toán Khóa học | Học sinh, Phụ huynh  | \<\<include\>\> UC10  |
| UC11 | Xem lịch sử mua khóa học | Học sinh, PH | — |
| UC12 | Gửi khiếu nại đến Admin | Học sinh, PH | \<\<extend\>\> UC39 |

 

**Module 4 — Học tập  (8 UC)**

Học tự do theo tiến độ cá nhân. Không có lịch cố định. Quiz chương tự mở sau khi hoàn thành chương; bài kiểm tra tự mở sau khi pass quiz 3 chương liên tiếp.

| ID | Tên Use Case | Actor | Ghi chú |
| :---- | :---- | :---- | :---- |
| UC13 | Xem danh sách khóa học đã mua | Học sinh | — |
| UC14 | Xem bài giảng & tài liệu | Học sinh | — |
| UC15 | Tải tài liệu học tập | Học sinh | — |
| UC16 | Nộp bài tập | Học sinh | — |
| UC17 | Làm kiểm tra | Học sinh | Tự mở sau khi hoàn thành 100% nội dung chương |
| UC18 | Xem điểm & tiến độ học tập | Học sinh | \<\<extend\>\> UC23 |
| UC19 | Đánh giá khóa học | Học sinh | — |
| UC20 | Xem & tải chứng chỉ |  | Chỉ hiển thị nếu đã được cấp — xuất dạng PDF |

 

**Module 5 — Tương tác & Hỗ trợ  (3 UC)**

| ID | Tên Use Case | Actor | Ghi chú |
| :---- | :---- | :---- | :---- |
| UC21 | Gửi câu hỏi cho giáo viên | Học sinh | \<\<extend\>\> UC33 |
| UC22 | Chat AI hỗ trợ | Học sinh | → A06 AI Engine |
| UC23 | Nhận đề xuất lộ trình từ AI | Học sinh | \<\<extend\>\> UC19 |

 

**Module 6 — Phụ huynh  (6 UC)**

Phụ huynh theo dõi tiến độ qua % hoàn thành chương và điểm quiz/kiểm tra. UC23, UC24, UC25 chỉ khả dụng khi tài khoản PH đã liên kết với tài khoản HS (status \= ACTIVE).

| ID | Tên Use Case | Actor | Ghi chú |
| :---- | :---- | :---- | :---- |
| UC24 | Theo dõi tiến độ học tập của con | Phụ huynh |  |
| UC25 | Liên hệ & nhận thông báo từ GV | Phụ huynh |  |
| UC26 | Xem lịch sử thanh toán khóa học | Phụ huynh | Bao gồm thông tin thanh toán và tiến độ. Chỉ khả dụng khi link ACTIVE |
| UC42 | Gửi lời mời liên kết con | Phụ huynh | PH nhập email HS → hệ thống gửi thông báo cho HS xác nhận |
| UC43 | Chấp nhận / từ chối liên kết | Học sinh | HS tự quyết định — PENDING → ACTIVE hoặc REVOKED |
| UC44 | Hủy liên kết tài khoản | Học sinh, Phụ huynh | Cả hai đều có quyền hủy |

 **Module 7 — Giáo viên  (10 UC)**

GV tự nhập và cập nhật thông tin TK ngân hàng qua trang cá nhân. GV xem doanh thu realtime từ revenue\_splits và lịch sử các lần nhận tiền từ Admin. Không thao tác trực tiếp với thanh toán.

| ID | Tên Use Case | Actor | Ghi chú |
| :---- | :---- | :---- | :---- |
| UC27 | Tạo khóa học mới | Giáo viên | Submit để Admin duyệt trước khi xuất bản |
| UC28 | Cập nhật bài giảng & tài liệu | Giáo viên | Upload video, PDF, slide |
| UC29 | Tạo question bank | Gíao viên  |  |
| UC30 | Cập nhật  question bank | Giáo viên  |  |
| UC31 | Tạo bài kiểm tra | Giáo viên | Gắn vào sau mỗi 3 chương |
| UC32 | Chấm điểm bài tập | Giáo viên | — |
| UC33 | Trả lời câu hỏi học sinh | Giáo viên | \<\<extend\>\> UC21 |
| UC34 | Xem lịch sử doanh thu | Giáo viên | Xem từng kỳ: kỳ nào, bao nhiêu, Admin nào xác nhận |

**Module 8 — Quản trị viên  (8 UC)**

Admin là người duy nhất thực hiện chuyển khoản. Hệ thống tổng hợp số liệu — Admin kiểm tra rồi chuyển tay.

| ID | Tên Use Case | Actor | Ghi chú |
| :---- | :---- | :---- | :---- |
| UC35 | Xem dashboard quản trị | Admin | Tổng tiền đang giữ, tổng cần chuyển kỳ này, cảnh báo trễ hạn, Tổng GMV, platform\_fee, teacher\_amount theo tháng và theo GV |
| UC36 | Xem danh sách tài khoản người dùng | Admin | — |
| UC37 | Mở và khóa tài khoản người dùng | Admin |  |
| UC38 | Duyệt khóa học | Admin | Approve / Reject / Needs Revision |
| UC39 | Xem và trả lời khiếu nại từ người dùng | Admin | \<\<extend\>\> UC12 |
| UC40 | Xác nhận đã chuyển khoản GV | Admin | Ghi nhận: ngày CK, nội dung CK, admin xác nhận — GV nhận thông báo |
| UC41 | Gửi thông báo đến người dùng | Admin | Học sinh, Phụ huynh, Giáo viên |

 

 

 


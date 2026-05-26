**BEE ACADEMY**

**USE CASE SPECIFICATION**

***Phiên bản 6.5  ·  48 Use Case  ·  9 Module  ·  7 Actor***

***© 2026 Bee Academy — Tài liệu nội bộ***

**Phần 1 — Danh sách Actor**

**7 actor. Giáo viên là đối tác cộng tác — xem doanh thu realtime nhưng nhận tiền thủ công từ Admin cuối kỳ theo hợp đồng dịch vụ đã ký.**

| ID | Actor | Loại | Mô tả |
| :---- | :---- | :---- | :---- |
| **A01** | **Guest (Khách)** | **Primary** | **Người dùng chưa đăng nhập, truy cập trang công khai** |
| **A02** | **Học sinh** | **Primary** | **Kế thừa Guest — mua khóa học, học tự do theo tiến độ cá nhân, làm quiz và kiểm tra** |
| **A03** | **Phụ huynh** | **Primary** | **Kế thừa Guest — theo dõi tiến độ học tập và thanh toán cho con** |
| **A04** | **Giáo viên** | **Primary** | **Tạo khóa học, upload tài liệu, tạo quiz/kiểm tra, nhập TK ngân hàng, xem báo cáo doanh thu và lịch sử nhận tiền** |
| **A05** | **Admin** | **Primary** | **Duyệt khóa học, xử lý yêu cầu, xác nhận chuyển khoản cho GV, báo cáo tổng** |
| **A06** | **AI Engine** | **External** | **Hệ thống AI — tạo câu hỏi tự động, đề xuất lộ trình học** |
| **A07** | **Payment Gateway** | **External** | **VNPay / MoMo — xử lý thanh toán, gửi webhook về backend** |

 

**Phần 2 — Danh sách Use Case theo Module**

**48 UC tổ chức thành 9 module. Tên UC theo quy tắc: Động từ \+ Danh từ. Không có tính năng livestream, lịch học cố định, hoặc chuyển tiền tự động.**

**Module 1 — Xác thực & Tài khoản  (5 UC)**

| ID | Tên Use Case | Actor | Ghi chú |
| :---- | :---- | :---- | :---- |
| **UC01** | **Đăng ký tài khoản** | **Guest** | **—** |
| **UC02** | **Đăng nhập hệ thống** | **Học sinh, PH, GV, Admin** | **—** |
| **UC03** | **Đăng xuất hệ thống** | **Học sinh, PH, GV, Admin** | **—** |
| **UC04** | **Đặt lại mật khẩu** | **Guest** | **—** |
| **UC05** | **Cập nhật hồ sơ cá nhân** | **Học sinh, PH, GV** | **—** |

 

**Module 2 — Tìm kiếm & Khóa học  (3 UC)**

| ID | Tên Use Case | Actor | Ghi chú |
| :---- | :---- | :---- | :---- |
| **UC06** | **Tìm kiếm khóa học** | **Guest** | **—** |
| **UC07** | **Xem chi tiết khóa học** | **Guest** | **—** |
| **UC08** | **Xem bài học thử** | **Guest** | **\<\<extend\>\> UC07 — khi isFree \= true** |

 

**Module 3 — Mua hàng & Thanh toán  (3 UC)**

**Tiền về thẳng TK công ty qua VNPay/MoMo. Hệ thống tự ghi nhận phần GV và phần nền tảng vào revenue\_splits. Admin chuyển thủ công cuối kỳ.**

| ID | Tên Use Case | Actor | Ghi chú |
| :---- | :---- | :---- | :---- |
| **UC09** | **Mua và thanh toán khóa học** | **Học sinh, PH** | **→ A07 VNPay/MoMo → tiền về TK công ty** |
| **UC10** | **Xem lịch sử mua khóa học** | **Học sinh, PH** | **—** |
| **UC11** | **Gửi khiếu nại đến Admin** | **Học sinh, PH** | **\<\<extend\>\> UC38** |

 

**Module 4 — Học tập  (8 UC)**

**Học tự do theo tiến độ cá nhân. Không có lịch cố định. Quiz chương tự mở sau khi hoàn thành chương; bài kiểm tra tự mở sau khi pass quiz 3 chương liên tiếp.**

| ID | Tên Use Case | Actor | Ghi chú |
| :---- | :---- | :---- | :---- |
| **UC12** | **Xem danh sách khóa học đã mua** | **Học sinh** | **—** |
| **UC13** | **Xem bài giảng & tài liệu** | **Học sinh** | **—** |
| **UC14** | **Tải tài liệu học tập** | **Học sinh** | **—** |
| **UC15** | **Nộp bài tập** | **Học sinh** | **—** |
| **UC16** | **Làm quiz chương** | **Học sinh** | **Tự mở sau khi hoàn thành 100% nội dung chương** |
| **UC17** | **Làm bài kiểm tra** | **Học sinh** | **Tự mở sau khi pass quiz 3 chương liên tiếp** |
| **UC18** | **Xem điểm & tiến độ học tập** | **Học sinh** | **\<\<extend\>\> UC22** |
| **UC19** | **Đánh giá khóa học** | **Học sinh** | **—** |

 

**Module 5 — Tương tác & Hỗ trợ  (3 UC)**

| ID | Tên Use Case | Actor | Ghi chú |
| :---- | :---- | :---- | :---- |
| **UC20** | **Gửi câu hỏi cho giáo viên** | **Học sinh** | **\<\<extend\>\> UC32** |
| **UC21** | **Chat AI hỗ trợ** | **Học sinh** | **→ A06 AI Engine** |
| **UC22** | **Nhận đề xuất lộ trình từ AI** | **Học sinh** | **\<\<extend\>\> UC18** |

 

**Module 6 — Phụ huynh  (6 UC)**

**Phụ huynh theo dõi tiến độ qua % hoàn thành chương và điểm quiz/kiểm tra. UC23, UC24, UC25 chỉ khả dụng khi tài khoản PH đã liên kết với tài khoản HS (status \= ACTIVE).**

| ID | Tên Use Case | Actor | Ghi chú |
| :---- | :---- | :---- | :---- |
| **UC23** | **Theo dõi tiến độ học tập của con** | **Phụ huynh** | **Chỉ khả dụng khi link ACTIVE** |
| **UC24** | **Liên hệ & nhận thông báo từ GV** | **Phụ huynh** | **Chỉ khả dụng khi link ACTIVE** |
| **UC25** | **Xem lịch sử thanh toán khóa học** | **Phụ huynh** | **Bao gồm thông tin thanh toán và tiến độ. Chỉ khả dụng khi link ACTIVE** |
| **UC47** | **Gửi lời mời liên kết con** | **Phụ huynh** | **PH nhập email HS → hệ thống gửi thông báo cho HS xác nhận** |
| **UC48** | **Chấp nhận / từ chối liên kết** | **Học sinh** | **HS tự quyết định — PENDING → ACTIVE hoặc REVOKED** |
| **UC49** | **Hủy liên kết tài khoản** | **Học sinh, Phụ huynh** | **Cả hai đều có quyền hủy** |

 

**Module 7 — Giáo viên  (10 UC)**

**GV tự nhập và cập nhật thông tin TK ngân hàng qua trang cá nhân. GV xem doanh thu realtime từ revenue\_splits và lịch sử các lần nhận tiền từ Admin. Không thao tác trực tiếp với thanh toán.**

| ID | Tên Use Case | Actor | Ghi chú |
| :---- | :---- | :---- | :---- |
| **UC26** | **Xem dashboard doanh thu** | **Giáo viên** | **Xem realtime từ revenue\_splits — tổng kỳ hiện tại, từng giao dịch, lịch sử nhận tiền** |
| **UC27** | **Tạo khóa học mới** | **Giáo viên** | **Submit để Admin duyệt trước khi xuất bản** |
| **UC28** | **Cập nhật bài giảng & tài liệu** | **Giáo viên** | **Upload video, PDF, slide** |
| **UC29** | **Tạo quiz chương** | **Giáo viên** | **Gắn vào cuối mỗi chương** |
| **UC30** | **Tạo bài kiểm tra** | **Giáo viên** | **Gắn vào sau mỗi 3 chương** |
| **UC31** | **Chấm điểm bài tập** | **Giáo viên** | **—** |
| **UC32** | **Trả lời câu hỏi học sinh** | **Giáo viên** | **\<\<extend\>\> UC20** |
| **UC33** | **Xem lịch sử doanh thu** | **Giáo viên** | **Xem từng kỳ: kỳ nào, bao nhiêu, Admin nào xác nhận** |
| **UC45** | **Nhập thông tin TK ngân hàng** | **Giáo viên** | **GV tự nhập khi đăng nhập với role GV. Bắt buộc để UC39 xuất được Excel** |
| **UC46** | **Cập nhật TK ngân hàng** | **Giáo viên** | **GV tự cập nhật — mỗi thay đổi ghi audit log: ai sửa, lúc nào, giá trị cũ** |

 

**Module 8 — Quản trị viên  (8 UC)**

**Admin là người duy nhất thực hiện chuyển khoản. Hệ thống tổng hợp số liệu — Admin kiểm tra rồi chuyển tay.**

| ID | Tên Use Case | Actor | Ghi chú |
| :---- | :---- | :---- | :---- |
| **UC34** | **Xem dashboard quản trị** | **Admin** | **Tổng tiền đang giữ, tổng cần chuyển kỳ này, cảnh báo trễ hạn** |
| **UC35** | **Cập nhật tài khoản người dùng** | **Admin** | **—** |
| **UC36** | **Duyệt khóa học** | **Admin** | **Approve / Reject / Needs Revision** |
| **UC37** | **Xem báo cáo tổng doanh thu** | **Admin** | **Tổng GMV, platform\_fee, teacher\_amount theo tháng và theo GV** |
| **UC38** | **Xử lý khiếu nại từ người dùng** | **Admin** | **\<\<extend\>\> UC11** |
| **UC39** | **Xuất báo cáo thanh toán doanh thu đến GV theo tháng** | **Admin** | **Danh sách GV \+ số tiền cần chuyển kỳ này, xuất Excel** |
| **UC40** | **Xác nhận đã chuyển khoản GV** | **Admin** | **Ghi nhận: ngày CK, nội dung CK, admin xác nhận — GV nhận thông báo** |
| **UC41** | **Gửi thông báo đến người dùng** | **Admin** | **Học sinh, Phụ huynh, Giáo viên** |

 

**Module 9 — Chứng chỉ  (2 UC)**

| ID | Tên Use Case | Actor | Ghi chú |
| :---- | :---- | :---- | :---- |
| **UC42** | **Cấp chứng chỉ hoàn thành** | **Hệ thống (tự động)** | **Tự động kích hoạt khi học sinh pass bài kiểm tra cuối khóa** |
| **UC43** | **Xem & tải chứng chỉ** | **Học sinh** | **Chỉ hiển thị nếu đã được cấp — xuất dạng PDF** |

 

 

 


BEE ACADEMY – USE CASE SPECIFICATION

Phần 1 — Danh sách Actor

Có 7 actor. Giáo viên là đối tác cộng tác — xem doanh thu realtime nhưng nhận tiền thủ công từ Admin cuối kỳ theo hợp đồng dịch vụ đã ký.

ID

Actor

Loại

Mô tả

A01

Guest (Khách)

Primary

Người dùng chưa đăng nhập, truy cập trang công khai

A02

Học sinh

Primary

Kế thừa Guest — mua khóa học, học tự do theo tiến độ cá nhân, làm quiz và kiểm tra

A03

Phụ huynh

Primary

Kế thừa Guest — theo dõi tiến độ học tập và thanh toán cho con

A04

Giáo viên

Primary

Tạo khóa học, upload tài liệu, tạo quiz/kiểm tra, nhập TK ngân hàng, xem báo cáo doanh thu và lịch sử nhận tiền

A05

Admin

Primary

Duyệt khóa học, xử lý yêu cầu, xác nhận chuyển khoản cho GV, báo cáo tổng

A06

AI Engine

External

Hệ thống AI — tạo câu hỏi tự động, đề xuất lộ trình học

A07

Payment Gateway

External

VNPay / MoMo — xử lý thanh toán, gửi webhook về backend





Phần 2 — Danh sách Use Case theo Module

Có 44 Use Case được tổ chức thành 8 module.



Module 1 — Xác thực \& Tài khoản (5 UC)

ID

Tên Use Case

Actor

UC01

Đăng ký tài khoản

Guest

UC02

Đăng nhập hệ thống

Học sinh, PH, GV, Admin

UC03

Đăng xuất hệ thống

Học sinh, PH, GV, Admin

UC04

Đặt lại mật khẩu

Guest

UC05

Cập nhật hồ sơ cá nhân

Học sinh, PH, GV





Module 2 — Tìm kiếm \& Khóa học (3 UC)

ID

Tên Use Case

Actor

Ghi chú

UC06

Tìm kiếm khóa học

Guest





UC07

Xem chi tiết khóa học

Guest





UC08

Xem bài học thử

Guest

<<extend>> UC07 khi isFree = true





Module 3 — Mua hàng \& Thanh toán (4 UC)

Tiền về thẳng tài khoản công ty qua VNPay/MoMo. Hệ thống tự ghi nhận phần giáo viên và phần nền tảng vào revenue\_splits. Admin chuyển thủ công cuối kỳ.

ID

Tên Use Case

Actor

Ghi chú

UC09

Mua khóa học

Học sinh, PH

VNPay/MoMo → tiền về TK công ty. <<include>> UC10

UC10

Thanh toán khóa học

Học sinh, PH





UC11

Xem lịch sử mua khóa học

Học sinh, PH





UC12

Gửi khiếu nại đến Admin

Học sinh, PH

<<extend>> UC39





Module 4 — Học tập (8 UC)

Học tự do theo tiến độ cá nhân. Không có lịch cố định.

Quiz chương tự mở sau khi hoàn thành chương.

Bài kiểm tra tự mở sau khi hoàn thành 100% nội dung chương.

ID

Tên Use Case

Actor

Ghi chú

UC13

Xem danh sách khóa học đã mua

Học sinh





UC14

Xem bài giảng \& tài liệu

Học sinh





UC15

Tải tài liệu học tập

Học sinh





UC16

Nộp bài tập

Học sinh





UC17

Làm kiểm tra

Học sinh

Tự mở sau khi hoàn thành 100% nội dung chương

UC18

Xem điểm \& tiến độ học tập

Học sinh





UC19

Đánh giá khóa học

Học sinh





UC20

Xem \& tải chứng chỉ

Học sinh

Chỉ hiển thị nếu đã được cấp, xuất PDF





Module 5 — Tương tác \& Hỗ trợ (3 UC)

ID

Tên Use Case

Actor

Ghi chú

UC21

Gửi câu hỏi cho giáo viên

Học sinh

<<extend>> UC36

UC22

Chat AI hỗ trợ

Học sinh

→ AI Engine

UC23

Nhận đề xuất lộ trình từ AI

Học sinh

<<extend>> UC18





Module 6 — Phụ huynh (6 UC)

Phụ huynh theo dõi tiến độ qua % hoàn thành chương và điểm quiz/kiểm tra.

UC24, UC25, UC26 chỉ khả dụng khi tài khoản phụ huynh đã liên kết với tài khoản học sinh (status = ACTIVE).

ID

Tên Use Case

Actor

Ghi chú

UC24

Theo dõi tiến độ học tập của con

Phụ huynh





UC25

Liên hệ \& nhận thông báo từ GV

Phụ huynh





UC26

Xem lịch sử thanh toán khóa học

Phụ huynh

Bao gồm thanh toán và tiến độ

UC27

Gửi lời mời liên kết con

Phụ huynh

Nhập email HS → hệ thống gửi thông báo

UC28

Chấp nhận / từ chối liên kết

Học sinh

PENDING → ACTIVE hoặc REVOKED

UC29

Hủy liên kết tài khoản

Học sinh, PH

Cả hai đều có quyền hủy





Module 7 — Giáo viên (8 UC)

Giáo viên tự nhập và cập nhật thông tin tài khoản ngân hàng qua trang cá nhân.

Giáo viên xem doanh thu realtime từ revenue\_splits và lịch sử các lần nhận tiền từ Admin.

Không thao tác trực tiếp với thanh toán.

ID

Tên Use Case

Actor

Ghi chú

UC30

Tạo khóa học mới

Giáo viên

Submit để Admin duyệt

UC31

Cập nhật bài giảng \& tài liệu

Giáo viên

Upload video, PDF, slide

UC32

Tạo question bank

Giáo viên





UC33

Cập nhật question bank

Giáo viên





UC34

Tạo bài kiểm tra

Giáo viên

Gắn sau mỗi 3 chương

UC35

Chấm điểm bài tập

Giáo viên





UC36

Trả lời câu hỏi học sinh

Giáo viên

<<extend>> UC21

UC37

Xem lịch sử doanh thu

Giáo viên

Xem từng kỳ nhận tiền





Module 8 — Quản trị viên (8 UC)

Admin là người duy nhất thực hiện chuyển khoản cho giáo viên.

ID

Tên Use Case

Actor

Ghi chú

UC38

Xem dashboard quản trị

Admin

Tổng tiền đang giữ, GMV, platform fee, teacher amount

UC39

Xem danh sách tài khoản người dùng

Admin





UC40

Mở và khóa tài khoản người dùng

Admin





UC41

Duyệt khóa học

Admin

Approve / Reject / Needs Revision

UC42

Xem và trả lời khiếu nại từ người dùng

Admin

<<extend>> UC12

UC43

Xác nhận đã chuyển khoản GV

Admin

Ghi nhận ngày CK, nội dung CK, gửi thông báo

UC44

Gửi thông báo đến người dùng

Admin

Học sinh, Phụ huynh, Giáo viên








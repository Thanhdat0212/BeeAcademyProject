---
description: Tổng quan dự án Bee Academy — mô tả sản phẩm, thông tin công ty, sitemap và các trang cần xây dựng. Áp dụng khi tạo mới trang, route, hoặc cần hiểu phạm vi dự án.
---

# Project Overview — Bee Academy

## Sản phẩm

**Bee Academy** là nền tảng bán khóa học trực tuyến dành cho học sinh cấp 2 (lớp 6–9), do công ty phát triển và phân phối. Mục tiêu: giao diện tối giản, hiện đại, chuyên nghiệp — thân thiện với cả học sinh lẫn phụ huynh.

## Thông tin công ty

| Trường | Giá trị |
|--------|---------|
| Tên công ty | BEE ACADEMY |
| Năm thành lập | 2026 |
| Email | thanhdatvv05@gmail.com |
| Điện thoại | +0334041795|
| Social | Facebook, Twitter |
| Copyright | © 2026 BEE ACADEMY, Mọi quyền được bảo lưu |

**Bee Academy** là nền tảng mới tập trung vào phân khúc học sinh THCS (lớp 6–9).

## Mô hình kinh doanh (UseCase v6.5 — Admin chuyển khoản thủ công)

- **Bán khóa học lẻ** (one-time purchase), truy cập trọn đời sau khi mua
- Giáo viên là đối tác cộng tác — tự tạo khóa học, submit Admin duyệt (Approve / Reject / Needs Revision)
- **Thanh toán VNPay / MoMo** — tiền về thẳng TK công ty
- Hệ thống tự ghi `revenue_splits`: phần GV + phần nền tảng cho mỗi giao dịch
- **Admin chuyển khoản thủ công cuối kỳ**: xuất Excel danh sách GV cần chuyển (UC39) → chuyển tay → xác nhận trên hệ thống (UC40) → GV nhận thông báo
- GV phải nhập TK ngân hàng (UC45) trước khi Admin xuất được Excel
- Phụ huynh liên kết với HS qua email mời (UC47-49), chỉ xem dữ liệu khi link `ACTIVE`
- Không có hoàn tiền — thay bằng khiếu nại (UC11 → UC38)
- Không livestream, không lịch học cố định; học tự do theo tiến độ cá nhân
- Giá: 99.000₫ – 1.000.000₫

## Sitemap

```
/ ........................ Trang chủ
/courses ................. Danh sách khóa học (filter, search)
/courses/:id ............. Chi tiết khóa học (UC07, UC08 bài học thử)
/checkout ................ Giỏ hàng & thanh toán
/payment-result .......... Kết quả thanh toán (VNPay/MoMo callback)

-- Auth --
/login
/register
/forgot-password ......... Quên mật khẩu (UC04)

-- Student Dashboard --
/courses ................. Khóa học đã mua + khám phá (UC12)
/orders .................. Lịch sử mua hàng (UC10)
/favorites ............... Danh sách yêu thích
/messages ................ Tin nhắn / hỏi GV (UC20) / chat AI (UC21)
/profile ................. Hồ sơ cá nhân (UC05)
/account ................. Tài khoản & bảo mật
/account/links ........... Xử lý lời mời liên kết PH (UC48)
/certificates ............ Xem & tải chứng chỉ PDF (UC43)
/complaints .............. Gửi khiếu nại đến Admin (UC11)

-- Teacher Portal (chưa xây — 10 trang) --
/teacher ................. Dashboard doanh thu realtime (UC26)
/teacher/courses ......... Tạo khóa học → submit duyệt (UC27)
/teacher/content ......... Upload video, PDF, slide (UC28)
/teacher/quiz ............ Tạo quiz chương (UC29)
/teacher/exam ............ Tạo bài kiểm tra sau mỗi 3 chương (UC30)
/teacher/grades .......... Chấm điểm bài tập (UC31)
/teacher/qa .............. Trả lời câu hỏi học sinh (UC32)
/teacher/revenue ......... Lịch sử các kỳ nhận tiền (UC33)
/teacher/bank ............ Nhập TK ngân hàng (UC45 — bắt buộc)
/teacher/bank/edit ....... Cập nhật TK + audit log (UC46)

-- Parent Portal (chưa xây — chỉ khả dụng khi link ACTIVE) --
/parent .................. Theo dõi tiến độ học của con (UC23)
/parent/contact .......... Liên hệ GV & nhận thông báo (UC24)
/parent/payments ......... Lịch sử thanh toán cho con (UC25)
/parent/link ............. Gửi lời mời liên kết bằng email HS (UC47)
/parent/link/manage ...... Hủy liên kết (UC49)

-- Admin --
/admin ................... Dashboard: tổng tiền giữ, cần chuyển kỳ này (UC34)
/admin/users ............. Quản lý tài khoản (UC35)
/admin/approvals ......... Duyệt khóa học (UC36)
/admin/reports ........... Báo cáo GMV / platform_fee / teacher_amount (UC37)
/admin/complaints ........ Xử lý khiếu nại HS/PH (UC38)
/admin/payouts/export .... Xuất Excel danh sách GV cần chuyển (UC39)
/admin/payouts/confirm ... Xác nhận đã chuyển khoản GV (UC40)
/admin/notifications ..... Gửi thông báo đến người dùng (UC41)
```

## Danh mục khóa học

- Toán học
- Ngữ văn
- Tiếng Anh
- Khoa học tự nhiên (Lý, Hóa, Sinh)
- Lịch sử & Địa lý
- Tin học
- Ôn thi vào lớp 10
- Kỹ năng mềm

## Chính sách

- Chính sách bảo mật (Privacy Policy)
- Điều khoản sử dụng (Terms & Conditions)
- Quy trình khiếu nại (thay cho hoàn tiền — UC11)

# Nội dung mẫu — Tạo khóa học & test Import câu hỏi / Quiz

Bộ dữ liệu mẫu để test toàn bộ luồng: **Tạo khóa học → Thêm chương → Import câu hỏi → Tạo quiz chương**.

---

## 1. Thông tin tạo khóa học (form "Tạo khóa học mới")

| Trường | Giá trị mẫu |
|---|---|
| **Tiêu đề** | Toán Đại Số Lớp 8 — Từ Cơ Bản Đến Nâng Cao |
| **Mô tả** | Khóa học bám sát chương trình Toán 8, tập trung vào đại số: nhân chia đa thức, hằng đẳng thức, phân thức và phương trình bậc nhất một ẩn. Mỗi chương có video bài giảng, ví dụ minh họa và quiz củng cố. Phù hợp học sinh lớp 8 muốn nắm chắc nền tảng và luyện thi học kỳ. |
| **Ảnh bìa** | (tùy chọn — bất kỳ ảnh JPG/PNG/WEBP ≤ 5MB) |
| **Môn học** | Toán học |
| **Lớp** | Lớp 8 |
| **Giá** | 299000 (₫) |

---

## 2. Cấu trúc chương & bài giảng gợi ý

Sau khi tạo khóa, vào **Bài giảng** thêm 3 chương sau (tên chương phải khớp để gắn câu hỏi đúng chương khi import):

### Chương 1 — Phép nhân và phép chia đa thức
- Bài 1: Nhân đơn thức với đa thức
- Bài 2: Bảy hằng đẳng thức đáng nhớ
- Bài 3: Phân tích đa thức thành nhân tử
- Bài 4: Chia đa thức cho đơn thức

### Chương 2 — Phân thức đại số
- Bài 1: Định nghĩa & điều kiện xác định
- Bài 2: Rút gọn phân thức
- Bài 3: Quy đồng & các phép tính trên phân thức

### Chương 3 — Phương trình bậc nhất một ẩn
- Bài 1: Phương trình bậc nhất một ẩn `ax + b = 0`
- Bài 2: Phương trình đưa được về bậc nhất
- Bài 3: Phương trình chứa ẩn ở mẫu

---

## 3. File câu hỏi để test Import Excel

Trang **Ngân hàng câu hỏi → Import Excel**. Định dạng các file đã đúng template hệ thống.

| File | Số câu | Dùng cho chương |
|---|---|---|
| `cauhoi_chuong1_phepnhanchia_dathuc.xlsx` | 8 | Chương 1 |
| `cauhoi_chuong2_phanthuc.xlsx` | 7 | Chương 2 |
| `cauhoi_chuong3_phuongtrinh.xlsx` | 7 | Chương 3 |
| `cauhoi_tatca_toan8.xlsx` | 22 | Gộp cả 3 chương (test import số lượng lớn) |

> Các file gồm cả câu **trắc nghiệm (TN)** lẫn **đúng/sai (DS)**, đủ 3 mức độ khó **D / TB / K** để test bộ lọc và bốc câu ngẫu nhiên cho quiz.

### Cách import
1. Mở **Ngân hàng câu hỏi** → nút **Import Excel**.
2. **Bước 2 — Gắn nhãn**: chọn **Khóa học** = *Toán Đại Số Lớp 8* (môn học tự khóa theo khóa), chọn **Lớp 8**, chọn **Chương** tương ứng với file.
3. **Bước 3**: kéo thả / chọn file `.xlsx`.
4. Xem preview (hợp lệ / lỗi) → nhấn **Nhập**.

---

## 4. Định dạng cột Excel (nếu muốn tự tạo thêm)

Hàng 1 là tiêu đề, dữ liệu từ hàng 2:

| Cột | Ý nghĩa | Giá trị hợp lệ |
|---|---|---|
| A | Nội dung câu hỏi | bắt buộc |
| B | Loại | `TN` = trắc nghiệm · `DS` = đúng/sai |
| C | Độ khó | `D` = dễ · `TB` = trung bình · `K` = khó |
| D | Đáp án A | bắt buộc với TN |
| E | Đáp án B | bắt buộc với TN |
| F | Đáp án C | tùy chọn |
| G | Đáp án D | tùy chọn |
| H | Đáp án đúng | `A` / `B` / `C` / `D` — với **DS**: `A` = Đúng, `B` = Sai |
| I | Giải thích | tùy chọn |

**Lưu ý DS (đúng/sai):** để trống cột D–G, chỉ điền cột H (`A` nếu mệnh đề đúng, `B` nếu sai).

---

## 5. Tạo Quiz chương

Sau khi import xong, vào **Quiz chương**:
1. Chọn khóa học + chương đã có câu hỏi.
2. Cấu hình: số câu mỗi lần làm, phân bổ độ khó, thời gian, điểm đạt.
3. Hệ thống **bốc ngẫu nhiên** từ ngân hàng theo cấu hình → học sinh làm bài → chấm tự động theo snapshot.

> Mỗi chương nên có tối thiểu số câu ≥ số câu cấu hình cho quiz. Các file mẫu (7–8 câu/chương) đủ cho quiz 5 câu/lần.

---

## 6. Sinh lại file (tùy chọn)

```bash
python samples/gen_sample_questions.py
```

Yêu cầu: `pip install openpyxl`. Sửa nội dung trong các list `CHUONG_1/2/3` của script để thêm câu hỏi.

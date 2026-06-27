# APITest Summary — Bee Academy (SWT301, Tuần 5)

Tổng hợp kết quả kiểm thử API qua Postman Collection (chạy bằng Newman/Collection Runner).

| Mục | Giá trị |
|---|---|
| Ngày chạy | 2026-06-26 |
| Environment | **BeeAcademy.Dev** (`baseUrl=http://localhost:8080`) |
| Công cụ | Postman Collection Runner / Newman 6 |
| Collection | `BeeAcademy.postman_collection.json` |
| Kết quả | **11 request · 16 assertion · 16 pass · 0 fail** |

## Kết quả theo endpoint (3 thư mục tự động: 0, 1, 2)

| # | Nhóm | Endpoint | Method | Loại test | Status | Assertion | Kết quả |
|---|---|---|---|---|---|---|---|
| 1 | 0. Public | `/api/health` | GET | Functional | 200 | 2/2 | ✅ Pass |
| 2 | 0. Public | `/api/courses` | GET | Functional | 200 | 2/2 | ✅ Pass |
| 3 | 0. Public | `/api/courses/{id}` | GET | Functional | — | 0/0 | ⚠️ Chưa kiểm (xem ghi chú 1) |
| 4 | 0. Public | `/api/categories` | GET | Functional | 200 | 2/2 | ✅ Pass |
| 5 | 1. Đăng nhập tự động | `/api/auth/register` | POST | Functional (đăng ký nhanh) | 200 | 2/2 | ✅ Pass |
| 6 | 1. Đăng nhập tự động | `/api/auth/login` | POST | Functional + lưu token | 200 | 2/2 | ✅ Pass |
| 7 | 1. Đăng nhập tự động | `/api/auth/refresh` | POST | Functional (chaining token) | 200 | 1/1 | ✅ Pass |
| 8 | 1. Đăng nhập tự động | `/api/me` | GET | Auth (Bearer token) | 200 | 1/1 | ✅ Pass |
| 9 | 1. Đăng nhập tự động | `/api/me/courses` | GET | Auth | 200 | 2/2 | ✅ Pass |
| 10 | 2. Phân quyền | `/api/teacher/courses` | GET | Negative (student bị chặn) | 403 | 1/1 | ✅ Pass |
| 11 | 2. Phân quyền | `/api/admin/courses/pending` | GET | Negative (student bị chặn) | 403 | 1/1 | ✅ Pass |

## Các loại kiểm thử đã bao phủ (theo lý thuyết Tuần 5)

- **Functional** — đúng status code 2xx + đúng cấu trúc envelope `{ success, message, data }`.
- **Authentication** — Bearer token (JWT) tự lưu sau login, dùng cho `/api/me`, `/api/me/courses`.
- **Chaining** — token từ `login` → dùng cho request sau; `refresh` lấy token mới.
- **Negative / Authorization** — student token gọi API teacher/admin → mong đợi **403** (đã đúng).

## Thư mục chạy tay (không tính vào số liệu tự động)

| Thư mục | Lý do chạy tay |
|---|---|
| 1A. Tài khoản giáo viên | Cần đăng nhập tài khoản GV thật (`myEmail`/`myPassword` để rỗng vì lý do bảo mật) |
| 3. Thủ công – OTP | Cần đọc OTP từ console backend (DEV_MODE) |
| 4. Nhập tay | Tự điền dữ liệu |

## Ghi chú

1. **`/api/courses/{id}` chưa kiểm được:** DB hiện chưa có khóa học `published` nào → collection không lấy được `courseId` (danh sách rỗng) → gọi `/api/courses/` với id rỗng trả 500. **Không phải lỗi API** — cần seed ít nhất 1 khóa học published rồi chạy lại để phủ endpoint này.

2. **Bug đã fix trong lúc test:** `/api/courses` ban đầu trả **500** do native query thống kê đánh giá dùng `AVG(rating)::float8` — Hibernate hiểu nhầm `:float8` (sau dấu `::` cast của PostgreSQL) là tham số đặt tên → `syntax error at or near ":"`. Đã sửa thành `CAST(AVG(rating) AS double precision)` trong `CourseRepository.findRatingStatsByCourseIds`. Sau fix: `/api/courses` trả **200**, toàn bộ assertion xanh.

## Cách chạy lại

```bash
# Trong backend/postman, cần backend chạy ở :8080
npx newman run BeeAcademy.postman_collection.json -e dev.postman_environment.json \
  --folder "0. Public (khong can token)" \
  --folder "1. Dang nhap tu dong (Runner xanh)" \
  --folder "2. Kiem tra phan quyen (xanh)"
```
Hoặc mở Postman → Collection Runner → chọn environment **BeeAcademy.Dev** → tích 3 thư mục 0, 1, 2 → Run.

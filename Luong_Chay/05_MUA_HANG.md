# Luồng Mua Hàng & Enrollment — UC09, UC10

Trạng thái: ⏳ Chưa triển khai — hiện dùng Mock

---

## Trạng thái hiện tại (Mock)

```
Student click "Thêm vào giỏ hàng"
    │
    ▼ (đã đăng nhập)
useCartStore.addToCart(course)
    → Lưu vào Zustand memory (KHÔNG persist localStorage)
    → Toast: "Đã thêm vào giỏ hàng"

Vào /checkout → click "Thanh toán"
    → navigate /payment-result?status=success
    → useCourseStore.enrollCourses([courseId])
    → purchasedIds.push(courseId)   ← mock enrollment, không gọi API
```

---

## Thiết kế luồng đầy đủ (sẽ triển khai Module 3)

### A. Thêm vào giỏ hàng

```
Student xem /courses/{id}
    │
    ▼ Nếu chưa đăng nhập:
    navigate /login, { state: { from: /courses/{id} } }
    → Sau login redirect về đúng trang khóa học

    ▼ Nếu đã đăng nhập:
useCartStore.addToCart(course)
    → Kiểm tra: chưa trong giỏ, chưa mua rồi
    → Thêm vào items[]
    → Toast xanh: "Đã thêm {title} vào giỏ"
```

### B. Checkout

```
User vào /checkout
    │
    ▼
CheckoutPage render giỏ hàng (items từ useCartStore)
    ├── Tổng tiền = sum(effectivePriceVnd)
    └── Nút "Thanh toán qua VNPay" / "Thanh toán qua MoMo"
    │
    ▼ User chọn phương thức + click "Thanh toán"
    │
    ▼
FE: POST /api/orders
    Body: { courseIds: [...], paymentMethod: "vnpay" }
    │
    ▼
OrderService.createOrder(studentId, courseIds, paymentMethod)
    ├── Validate: courses tồn tại, status=PUBLISHED, chưa mua
    ├── Tính tổng tiền (snapshot giá tại thời điểm mua)
    ├── INSERT vào bảng orders { id, studentId, totalVnd, status: "pending" }
    ├── INSERT order_items { orderId, courseId, priceVnd }
    └── Gọi VNPay/MoMo API để tạo payment URL
        → Trả { paymentUrl: "https://vnpay.vn/pay?token=..." }
    │
    ▼
FE: window.location.href = paymentUrl  (redirect sang VNPay/MoMo)
```

### C. Xử lý callback thanh toán

```
VNPay/MoMo xử lý xong → redirect về:
    http://localhost:3000/payment-result?status=success&orderId=...&signature=...
    │
    ▼
PaymentResultPage.tsx
    └── GET /api/orders/{orderId}/verify?signature=...
            │
            ▼
        OrderService.verifyPayment(orderId, signature)
            ├── Validate signature từ VNPay/MoMo (chống giả mạo callback)
            ├── UPDATE orders SET status = "paid"
            ├── INSERT enrollments cho mỗi course trong order:
            │       Enrollment.create(studentId, courseId, priceVnd)
            │       enrollmentRepository.save(enrollment)
            └── Trả { success: true, enrolledCourseIds: [...] }
    │
    ▼
FE:
    ├── useCourseStore.enrollCourses(enrolledCourseIds)  ← cập nhật local
    ├── useCartStore.clearCart()
    └── Hiển thị màn hình "Thanh toán thành công"
        → Nút "Bắt đầu học ngay" → navigate /courses/{firstCourseId}
```

### D. Xem lịch sử mua hàng (UC10)

```
User vào /orders
    │
    ▼
GET /api/orders?page=0&size=10
    │
    ▼
OrderController.listMyOrders(me, pageable)
    └── orderRepository.findByStudentIdOrderByCreatedAtDesc(studentId, pageable)
    → Trả PageResponse<OrderSummaryResponse>
        { orderId, createdAt, totalVnd, status, courses: [{title, thumbnailUrl}] }
    │
    ▼
OrdersPage render bảng đơn hàng với badge trạng thái
```

---

## Bảng cần tạo (SQL)

```sql
CREATE TABLE orders (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      UUID        NOT NULL REFERENCES profiles(id),
    total_vnd       INTEGER     NOT NULL,
    payment_method  TEXT        NOT NULL,  -- 'vnpay' | 'momo'
    status          TEXT        NOT NULL DEFAULT 'pending',  -- pending/paid/failed/refunded
    payment_ref     TEXT,                  -- mã giao dịch từ VNPay/MoMo
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at         TIMESTAMPTZ
);

CREATE TABLE order_items (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID    NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    course_id   UUID    NOT NULL REFERENCES courses(id),
    price_vnd   INTEGER NOT NULL,
    UNIQUE(order_id, course_id)
);
```

Bảng `enrollments` đã tạo ở bước fix bug trước.

---

## Lưu ý kỹ thuật

**VNPay signature validation:**
```
Nhận callback: ?vnp_Amount=...&vnp_TxnRef=...&vnp_SecureHash=...
Tính lại HMAC-SHA512 từ các params → so sánh với vnp_SecureHash
Khớp → thanh toán hợp lệ → cập nhật DB
```

**Idempotent callback:**
VNPay/MoMo có thể gọi callback nhiều lần cho cùng 1 giao dịch.
Backend kiểm tra `orders.status != "paid"` trước khi INSERT enrollments
→ Tránh duplicate enrollment.

---
description: Quy tắc ràng buộc bắt buộc của Bee Academy — screenshot so sánh, mobile-friendly, và scroll animation. Áp dụng sau mỗi thay đổi UI lớn và khi build bất kỳ component nào.
---

# Constraints — Bee Academy

## 1. Screenshot & so sánh sau mỗi thay đổi lớn

Sau khi hoàn thành một section hoặc component lớn:

- Chụp screenshot trên **desktop (1440px)** và **mobile (375px)**
- Đặt cạnh ảnh design gốc để kiểm tra độ chính xác
- **Không tiếp tục** sang phần tiếp theo nếu chưa so sánh

Công cụ chụp: Puppeteer script tại `C:\Users\ADMIN\Documents\screenshot.mjs`

## 2. Mobile-friendly bắt buộc

Mọi component phải hoạt động đúng trên tất cả breakpoint:

| Breakpoint | Kích thước |
|-----------|-----------|
| Mobile S | 375px |
| iPhone 14 | 390px |
| Tablet | 768px |
| Laptop | 1280px |
| Desktop | 1440px |

**Checklist:**
- Không có overflow ngang (`overflow-x: hidden` trên `body`)
- Text không bị cắt hoặc tràn container
- Touch target tối thiểu **44×44px** cho mọi button/link
- Ảnh dùng `sizes` prop phù hợp từng breakpoint

## 3. Scroll animation cho mọi section

Mọi section trên trang phải có hiệu ứng xuất hiện khi scroll vào viewport.

**Triển khai:**
- Dùng `Intersection Observer API` hoặc `Framer Motion`
- Không dùng thư viện nặng như AOS hay ScrollMagic

**Hiệu ứng chuẩn:**
```css
/* Fade-up cho cards */
opacity: 0 → 1
transform: translateY(20px) → translateY(0)
transition: 0.6s ease-out

/* Fade-in từ trái cho headings */
opacity: 0 → 1
transform: translateX(-20px) → translateX(0)
transition: 0.6s ease-out
```

**Stagger delay cho grid items:**
- Item 1: `delay: 0ms`
- Item 2: `delay: 100ms`
- Item 3: `delay: 200ms`
- Item 4: `delay: 300ms`

**Stats counter:** Đếm số từ 0 lên khi section vào viewport.

**Hiệu năng:**
- Dùng `will-change: transform` chỉ khi đang animate
- Không animate quá 8 element cùng lúc
- `duration` tối đa `700ms`, `easing: ease-out`

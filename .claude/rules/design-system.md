---
description: Design system của Bee Academy — màu sắc brand, typography, spacing, border radius, shadows và design principles. Áp dụng cho mọi thay đổi UI/CSS/Tailwind.
---

# Design System — Bee Academy

## Brand Colors

```css
--bee-yellow:       #F5A623   /* Primary brand — màu vàng ong, chỉ dùng cho CTA và accent */
--bee-yellow-light: #FFF3D6   /* Background nhạt cho highlight */
--bee-dark:         #1A1A2E   /* Headings, text chính */
--bee-gray:         #64748B   /* Text phụ, placeholder */
--bee-gray-light:   #F8FAFC   /* Background section xen kẽ */
--bee-white:        #FFFFFF
--bee-success:      #22C55E
--bee-error:        #EF4444

/* Accent — dùng tiết kiệm */
--bee-teal:         #0EA5E9
```

**Quy tắc màu sắc:**
- `bee-yellow` chỉ dùng cho CTA button, badge accent, highlight — không lạm dụng
- Không dùng quá 3 màu chính trong một section
- Nền trang: trắng (#FFFFFF), section xen kẽ dùng `bee-gray-light` (#F8FAFC)

## Typography

| Vai trò | Font | Weight | Size/Line-height |
|---------|------|--------|-----------------|
| Heading 1 | Plus Jakarta Sans | 700 | 48px/56px |
| Heading 2 | Plus Jakarta Sans | 700 | 36px/44px |
| Heading 3 | Plus Jakarta Sans | 600 | 24px/32px |
| Body | Inter | 400 | 16px/24px |
| Small | Inter | 400 | 14px/20px |
| Label | Inter | 500 | 12px/16px, uppercase, letter-spacing 0.08em |

Import từ Google Fonts: `Plus Jakarta Sans` (400–800) + `Inter` (400–600).

## Spacing & Radius

- **Base unit:** 4px — dùng bội số của 4
- **Section padding:** `py-16 lg:py-24`
- **Card radius:** `rounded-2xl` (16px)
- **Button radius:** `rounded-full` (pill style)
- **Container:** `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`

## Shadows

```css
--shadow-card:  0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
--shadow-hover: 0 8px 24px rgba(0,0,0,0.10);
```

Card mặc định dùng `shadow-card`, hover chuyển sang `shadow-hover` với `transition: box-shadow 0.3s ease`.

## Design Principles

1. **Tối giản trước hết** — mỗi element phải có lý do tồn tại, không dùng decorator thừa
2. **Card-based layout** — mọi nội dung khóa học đều dạng thẻ với hover shadow
3. **Màu vàng chỉ dùng cho CTA và accent** — không lạm dụng
4. **Mobile-first** — thiết kế từ 375px, scale lên desktop
5. **Accessibility** — contrast AA tối thiểu, focus ring rõ ràng, alt text đầy đủ
6. **Performance** — `next/image` cho mọi ảnh, lazy load, skeleton loading
7. **Tiếng Việt đầu tiên** — toàn bộ UI text bằng tiếng Việt

## Reference Layout (từ 4user.net)

- Header: logo trái, nav giữa, auth buttons phải — sticky khi scroll
- Hero: split layout, text trái + ảnh phải, nền subtle gradient
- Khóa học: grid 4 cột desktop / 2 cột tablet / 1 cột mobile
- Section headers: label nhỏ màu accent + heading lớn + link "Xem tất cả" bên phải
- Footer: 4 cột links + social icons + copyright

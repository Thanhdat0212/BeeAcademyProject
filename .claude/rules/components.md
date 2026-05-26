---
description: Danh sách component chuẩn của Bee Academy — tên, vị trí file, props chính. Áp dụng khi tạo hoặc sửa component, đặt tên file, hoặc import component vào trang.
---

# Component Library — Bee Academy

## Global Layout Components

| Component | File | Mô tả |
|-----------|------|-------|
| `<Header />` | `components/layout/Header.tsx` | Logo trái, nav giữa, search + auth phải, sticky khi scroll |
| `<Footer />` | `components/layout/Footer.tsx` | 4 cột links, socials, copyright |
| `<MobileNav />` | `components/layout/MobileNav.tsx` | Drawer menu cho mobile |

## Course Components

| Component | File | Mô tả |
|-----------|------|-------|
| `<CourseCard />` | `components/course/CourseCard.tsx` | Thumbnail, tên, giảng viên, rating, giá, badge |
| `<CourseGrid />` | `components/course/CourseGrid.tsx` | Responsive grid của CourseCard |
| `<CourseFilter />` | `components/course/CourseFilter.tsx` | Sidebar filter: danh mục, giá, cấp lớp, đánh giá |
| `<CourseHero />` | `components/course/CourseHero.tsx` | Hero chi tiết khóa học, CTA mua |
| `<CurriculumAccordion />` | `components/course/CurriculumAccordion.tsx` | Danh sách bài học theo chương |
| `<ReviewList />` | `components/course/ReviewList.tsx` | Danh sách đánh giá + tổng hợp sao |

## Home Section Components

Thứ tự render trên trang chủ (`app/(main)/page.tsx`):

1. `<HeroBanner />` — `components/home/HeroBanner.tsx`
2. `<StatsBar />` — `components/home/StatsBar.tsx` — animated counter khi scroll vào viewport
3. `<FeaturedCourses />` — `components/home/FeaturedCourses.tsx` — tabs theo danh mục
4. `<CategoryGrid />` — `components/home/CategoryGrid.tsx`
5. `<WhyChooseUs />` — `components/home/WhyChooseUs.tsx`
6. `<Testimonials />` — `components/home/Testimonials.tsx` — carousel
7. `<BlogPreview />` — `components/home/BlogPreview.tsx` — 3 bài mới nhất
8. `<CTABanner />` — `components/home/CTABanner.tsx`

## UI Primitives (shadcn/ui base)

| Component | Mô tả |
|-----------|-------|
| `<Badge />` | Pill label — màu vàng/xanh/đỏ tùy `variant` |
| `<StarRating />` | Hiển thị sao, prop `interactive` cho phép click |
| `<PriceTag />` | Giá gốc gạch ngang + giá sale, format VND |
| `<ProgressBar />` | Tiến độ hoàn thành khóa học (0–100%) |
| `<Avatar />` | Ảnh user, fallback initials nếu không có ảnh |
| `<SearchBar />` | Input tìm kiếm với autocomplete dropdown |

## Quy tắc component

- **Server Component mặc định** — chỉ thêm `"use client"` khi cần event handler, hooks, hay browser API
- **Không dùng `any`** — luôn define props interface rõ ràng
- **Không viết comment** giải thích WHAT — tên biến/component đã nói lên điều đó
- Props interface đặt ngay trên function component, không export riêng trừ khi cần dùng lại

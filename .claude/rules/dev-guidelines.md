---
description: Coding standards và folder structure của Bee Academy — TypeScript, Next.js App Router, API conventions, và tổ chức file. Áp dụng cho mọi code được viết trong dự án.
---

# Development Guidelines — Bee Academy

## TypeScript

- **Không dùng `any`** — luôn define type/interface rõ ràng
- **Không export type không cần thiết** — chỉ export khi dùng ở nhiều file
- Dùng `type` cho union/intersection, `interface` cho object shape
- Dùng Prisma generated types thay vì tự define lại

## React (v19)  App Router

- **Server Component mặc định** — chỉ thêm `"use client"` khi cần:
  - Event handlers (`onClick`, `onChange`, v.v.)
  - React hooks (`useState`, `useEffect`, v.v.)
  - Browser-only API (`window`, `localStorage`, v.v.)
- **API routes** đặt trong `app/api/` theo convention REST
- **Không dùng `pages/`** — toàn bộ dùng App Router

## Environment Variables

- Tất cả secret qua `.env.local` — **không commit vào git**
- Prefix `NEXT_PUBLIC_` chỉ cho biến cần expose ra client
- `.env.example` phải có key (không có value) cho mọi biến

## Images

- **Luôn dùng `next/image`** — không dùng `<img>` HTML thuần
- Phải có `sizes` prop phù hợp breakpoint:
  ```tsx
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
  ```
- `alt` text bắt buộc, mô tả nội dung ảnh bằng tiếng Việt

## Comments

- **Không viết comment** giải thích WHAT code làm — tên biến/hàm đã nói lên điều đó
- Chỉ viết comment khi WHY không rõ ràng: constraint ẩn, workaround, invariant tinh tế
- Không viết JSDoc cho mọi function — chỉ khi public API thực sự cần

## Folder Structure

```
bee-academy/
├── app/
│   ├── (auth)/             # login, register, forgot-password
│   ├── (main)/             # layout có Header + Footer
│   │   ├── page.tsx        # trang chủ
│   │   ├── courses/
│   │   ├── categories/
│   │   ├── blog/
│   │   ├── about/
│   │   └── contact/
│   ├── (dashboard)/        # layout student dashboard
│   ├── (admin)/            # layout admin panel
│   └── api/
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── course/             # course-specific components
│   ├── home/               # home section components
│   ├── layout/             # Header, Footer, MobileNav
│   └── shared/             # dùng chung nhiều nơi
├── lib/
│   ├── db.ts               # Prisma client singleton
│   ├── auth.ts             # NextAuth config
│   ├── utils.ts            # helper functions
│   └── validations/        # Zod schemas
├── hooks/                  # custom React hooks
├── store/                  # Zustand stores
├── types/                  # TypeScript global types
└── public/
    ├── images/
    └── icons/
```

## Naming Conventions

| Loại | Convention | Ví dụ |
|------|-----------|-------|
| Component file | PascalCase | `CourseCard.tsx` |
| Page file | lowercase | `page.tsx`, `layout.tsx` |
| Hook | camelCase với prefix `use` | `useCourses.ts` |
| Util function | camelCase | `formatPrice.ts` |
| Zod schema | camelCase với suffix `Schema` | `courseSchema.ts` |
| Zustand store | camelCase với suffix `Store` | `cartStore.ts` |
| API route | REST noun, lowercase | `app/api/courses/route.ts` |

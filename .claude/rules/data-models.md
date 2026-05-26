---
description: Data models Prisma của Bee Academy — schema tham khảo cho Course, Enrollment và các entity liên quan. Áp dụng khi viết Prisma schema, API routes, hoặc TypeScript types cho database.
---

# Data Models — Bee Academy

## Prisma Schema

```prisma
model Course {
  id          String   @id @default(cuid())
  slug        String   @unique
  title       String
  description String
  thumbnail   String   // Cloudinary URL
  price       Int      // VND, lưu dạng số nguyên (vd: 299000)
  salePrice   Int?     // null = không giảm giá
  category    Category @relation(fields: [categoryId], references: [id])
  categoryId  String
  grade       Int[]    // [6], [7], [6,7], [6,7,8,9], v.v.
  lessons     Lesson[]
  reviews     Review[]
  enrollments Enrollment[]
  isPublished Boolean  @default(false)
  isFeatured  Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Enrollment {
  id        String   @id @default(cuid())
  user      User     @relation(fields: [userId], references: [id])
  userId    String
  course    Course   @relation(fields: [courseId], references: [id])
  courseId  String
  progress  Int      @default(0) // % hoàn thành (0–100)
  paidAt    DateTime @default(now())
  @@unique([userId, courseId])
}

model Category {
  id      String   @id @default(cuid())
  slug    String   @unique
  name    String   // "Toán học", "Tiếng Anh", v.v.
  icon    String?  // emoji hoặc Cloudinary icon URL
  courses Course[]
}

model Lesson {
  id        String  @id @default(cuid())
  course    Course  @relation(fields: [courseId], references: [id])
  courseId  String
  title     String
  videoUrl  String  // Cloudinary video URL
  duration  Int     // giây
  order     Int
  isFree    Boolean @default(false) // bài học xem thử miễn phí
}

model Review {
  id        String   @id @default(cuid())
  user      User     @relation(fields: [userId], references: [id])
  userId    String
  course    Course   @relation(fields: [courseId], references: [id])
  courseId  String
  rating    Int      // 1–5
  comment   String?
  createdAt DateTime @default(now())
  @@unique([userId, courseId])
}
```

## Quy tắc lưu trữ

- **Giá tiền:** luôn lưu dạng `Int` (số nguyên VND), không dùng `Float` hay `Decimal`
- **Slug:** tự sinh từ title, lowercase, dấu gạch ngang, không dấu tiếng Việt
- **Thumbnail/Video:** lưu Cloudinary URL đầy đủ, không lưu path tương đối
- **Grade:** mảng Int cho phép một khóa học thuộc nhiều lớp (vd: `[8, 9]` cho khóa ôn thi)

## TypeScript types tương ứng

```ts
// Dùng Prisma generated types, không tự define lại
import type { Course, Enrollment, Category } from '@prisma/client'

// Khi cần partial type cho UI
type CourseCard = Pick<Course, 'id' | 'slug' | 'title' | 'thumbnail' | 'price' | 'salePrice'> & {
  category: Pick<Category, 'name' | 'slug'>
  avgRating: number
  reviewCount: number
}
```

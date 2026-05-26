---
description: Tech stack chính thức của Bee Academy. Áp dụng khi cài package, tạo config, chọn thư viện, hoặc setup project mới.
---

# Tech Stack — Bee Academy

## Cấu trúc dự án

Dự án gồm hai thư mục độc lập:

```
HocAI/
├── frontend/    # React(v19) — giao diện người dùng
└── backend/     # Spring Boot — REST API
```

## Frontend Stack

| Layer | Công nghệ | Ghi chú |
|-------|-----------|---------|
| Framework | React (v19) (App Router) | Server Components mặc định |
| Styling | Tailwind CSS v3 | Không dùng CSS modules hay styled-components |
| UI Components | shadcn/ui | Chỉ add component cần dùng |
| Icons | Lucide React | Không dùng FontAwesome hay heroicons |
| Fonts | Google Fonts | Plus Jakarta Sans + Inter |
| State | Zustand | Chỉ cho client state; server state dùng React Query |
| Forms | React Hook Form + Zod | Zod cho cả validation lẫn TypeScript types |
| HTTP Client | Axios | Gọi REST API từ backend |
| Animation | Framer Motion | Không dùng GSAP hay AOS |
| Date | date-fns với locale/vi | Không dùng moment.js |
| Storage | Cloudinary | Cho ảnh và video thumbnail |
| Deployment | Vercel | |

## Backend Stack

| Layer | Công nghệ | Ghi chú |
|-------|-----------|---------|
| Language | Java 17 | LTS version |
| Framework | Spring Boot 3.2 | |
| Architecture | MVC (Model-View-Controller) | View = JSON response |
| Database | MySQL 8 | |
| ORM | Spring Data JPA + Hibernate | |
| Security | Spring Security + JWT | |
| Build tool | Maven | pom.xml |
| Validation | Jakarta Validation (Bean Validation) | |
| Boilerplate | Lombok | |
| Payment | VNPay / MoMo | Tiền về TK công ty; hệ thống ghi `revenue_splits`; Admin chuyển tay GV cuối kỳ (UC39-40) |
| Email | JavaMailSender | SMTP |
| Deployment | Railway hoặc Render | |

## Backend — MVC Package Structure

```
com.beeacademy.backend
├── controller/      # Nhận HTTP request, trả response (C)
├── service/         # Business logic
├── repository/      # Truy vấn database (extends JpaRepository)
├── model/           # JPA Entity — ánh xạ bảng MySQL (M)
├── dto/
│   ├── request/     # Object nhận dữ liệu từ client
│   └── response/    # Object trả về cho client (V)
├── config/          # Spring Security, CORS, JWT config
├── exception/       # GlobalExceptionHandler, custom exceptions
└── BeeAcademyApplication.java
```

## Quy tắc chọn thư viện

- **Không thêm dependency mới** nếu đã có thư viện trong stack có thể làm được
- Backend không dùng thư viện nặng ngoài Spring ecosystem
- Frontend ưu tiên thư viện nhẹ, tree-shakeable

## Formatting utilities (Frontend)

```ts
// Currency
Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })

// Date
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
format(date, 'dd/MM/yyyy', { locale: vi })
```

## Formatting utilities (Backend)

```java
// Currency
NumberFormat.getCurrencyInstance(new Locale("vi", "VN")).format(price)

// Date
DateTimeFormatter.ofPattern("dd/MM/yyyy")
```

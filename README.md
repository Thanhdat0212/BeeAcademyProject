# 🐝 Bee Academy

> An online course marketplace for Vietnamese middle school students (grades 6–9) — built with **Java Spring Boot 3** and **React 19**.

![Java](https://img.shields.io/badge/Java-17-ED8B00?logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2-6DB33F?logo=springboot&logoColor=white)
![React](https://img.shields.io/badge/React-19-20232A?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwindcss&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-316192?logo=postgresql&logoColor=white)

## 📖 Overview

Bee Academy is a full-stack e-learning platform where teachers create and sell video courses, students learn at their own pace, parents monitor their children's progress, and admins moderate content and manage payouts.

**Business model:** one-time course purchases with lifetime access. Payments go to the company account via PayOS; the system records revenue splits per transaction, and admins transfer teachers' shares manually at the end of each period.

## ✨ Key Features

### 🎓 Student
- Browse and search published courses, watch preview lessons for free
- Purchase courses via **PayOS** payment gateway (QR code / bank transfer)
- Watch lecture videos served through **signed URLs** (private storage, 1-hour TTL)
- Take chapter quizzes with randomized questions and instant grading
- Manage profile, avatar, order history, and favorites

### 👨‍🏫 Teacher
- Create courses with chapters and lessons, upload videos and documents
- Build a **question bank** (difficulty levels, usage tracking) and configure per-chapter quizzes
- Submit courses for admin review (approve / reject / request revision workflow)
- Track revenue in real time and view payout history
- Answer student Q&A

### 👪 Parent
- Link to a child's account via email invitation (must be accepted to activate)
- Monitor learning progress, quiz scores, and payment history
- Contact teachers directly

### 🛡️ Admin
- Review and moderate submitted courses with full approval history
- Dashboard of held funds and pending payouts
- Export payout lists and confirm manual transfers to teachers
- Handle student/parent complaints

## 🏗️ Architecture

```
HocAI/
├── frontend/   React 19 + Vite + TypeScript + Tailwind CSS v4 (Material Design 3 tokens)
└── backend/    Spring Boot 3.2 REST API (MVC), stateless JWT security
```

| Concern | Implementation |
|---|---|
| Authentication | Supabase GoTrue — email/password + OTP registration + Google OAuth; JWT verified with **ES256 (ECDSA P-256)** via JWKS |
| Database | PostgreSQL (Supabase) with Spring Data JPA / Hibernate |
| File storage | Supabase Storage — private bucket for videos (signed URLs), public bucket for documents |
| Payments | PayOS — webhook + API verification fallback; revenue split recorded per order |
| Quiz integrity | Question snapshot stored as **JSONB** at attempt start, so later edits to the question bank never affect submitted attempts |
| State (FE) | Zustand v5 with localStorage persistence for auth |
| Email | SMTP (JavaMailSender) for OTP and notifications |

## 🚀 Getting Started

### Prerequisites
- Java 17, Maven
- Node.js 20+
- A [Supabase](https://supabase.com) project (database + auth + storage)

### Backend

```bash
cd backend
# create .env with your Supabase credentials (see keys below)
mvn spring-boot:run        # starts on http://localhost:8080
```

Required `backend/.env` keys:

```
SUPABASE_URL=               SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=  SUPABASE_JWT_SECRET=
SUPABASE_DB_HOST=           SUPABASE_DB_PASSWORD=
MAIL_USERNAME=              MAIL_PASSWORD=
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

Then run the SQL migrations in `backend/*.sql` on the Supabase SQL Editor and create two storage buckets: `course-videos` (private) and `course-docs` (public).

### Frontend

```bash
cd frontend
npm install
npm run dev                # starts on http://localhost:3000
```

## 👥 Team

Group project — School of Software Engineering.

| Member | GitHub |
|---|---|
| Vo Van Thanh Dat | [@Thanhdat0212](https://github.com/Thanhdat0212) |

## 📄 License

This project was built for educational purposes.

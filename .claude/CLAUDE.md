# CLAUDE.md — Bee Academy

Tài liệu này ghi lại trạng thái hiện tại của **toàn bộ dự án** (frontend + backend), những gì đã hoàn thành, quyết định kiến trúc quan trọng và những phần còn dang dở.

Cập nhật lần cuối: 2026-05-26

---

## Tech Stack thực tế

### Frontend

> **Lưu ý:** File `rules/tech-stack.md` mô tả Next.js + Spring Boot, nhưng dự án **thực tế đang dùng:**

| Layer | Công nghệ |
|---|---|
| Framework | **React 19 + Vite 6** (không phải Next.js) |
| Routing | **React Router DOM v7** |
| Styling | **Tailwind CSS v4** với CSS variables Material Design 3 |
| State | **Zustand v5** (persist localStorage cho auth) |
| Animation | **motion/react** (alias của Framer Motion) |
| Icons | Lucide React |
| Toast | react-hot-toast (`notify` wrapper tại `src/lib/toast.ts`) |
| HTTP | Axios với `apiClient` singleton + interceptor tự gắn Bearer token |

### Backend

| Layer | Công nghệ |
|---|---|
| Language | Java 17 |
| Framework | Spring Boot 3.2 |
| Architecture | MVC, Spring Security (stateless JWT) |
| Database | PostgreSQL qua Supabase |
| Auth Provider | Supabase GoTrue (JWT ES256 / ECDSA P-256) |
| Email | JavaMailSender (SMTP Gmail) |
| Env loader | spring-dotenv (đọc `backend/.env`) |
| Build | Maven |

### CSS Variables (Material Design 3)
Dùng trong toàn bộ UI — **không dùng màu Tailwind trực tiếp cho surface/text:**
- `bg-surface`, `bg-surface-container`, `bg-surface-container-lowest`, `bg-surface-container-low`, `bg-surface-container-high`
- `text-on-surface`, `text-on-surface-variant`
- `border-outline-variant`
- `bg-primary`, `text-on-primary`, `text-primary`

---

## Cấu trúc File

### Frontend
```
frontend/src/
├── App.tsx                          ← Router toàn bộ app
├── api/
│   ├── client.ts                    ← apiClient (axios singleton + interceptor)
│   └── authService.ts               ← login, register, logout, refresh, syncOAuthProfile
├── store/
│   ├── useAuthStore.ts              ← isLoggedIn, user, tokens — persist localStorage
│   ├── useCourseStore.ts            ← purchasedIds, enrollCourses, favoritedIds, toggleFavorite
│   └── useCartStore.ts              ← items, addToCart, removeFromCart, clearCart, getTotal
├── types/
│   └── api.ts                       ← ApiResponse, AuthTokenPayload, UserSummary, OAuthSyncPayload, ...
├── components/
│   ├── DashboardHeader.tsx          ← Header sticky, search autocomplete, avatar → sidebar dropdown
│   ├── DashboardSidebar.tsx         ← Sidebar 8 mục, dual-mode: floating + column
│   └── PageBanner.tsx               ← Banner gradient tím h-40, SVG illustration
├── pages/
│   ├── common/
│   │   ├── LandingPage.tsx
│   │   ├── Login.tsx                ← Email/password + Google OAuth button
│   │   ├── Register.tsx
│   │   └── OAuthCallbackPage.tsx    ← ✅ Xử lý hash từ Supabase OAuth callback
│   ├── student/
│   │   ├── CoursesPage.tsx          ← ✅ Hoàn chỉnh
│   │   ├── CourseDetailPage.tsx     ← ✅ Hoàn chỉnh
│   │   ├── CheckoutPage.tsx         ← ✅ Hoàn chỉnh (mock)
│   │   ├── PaymentResultPage.tsx    ← ✅ Hoàn chỉnh (mock)
│   │   ├── OrdersPage.tsx           ← ✅ Hoàn chỉnh
│   │   ├── MessagesPage.tsx         ← ✅ Hoàn chỉnh
│   │   ├── ProfilePage.tsx          ← ✅ Hoàn chỉnh
│   │   ├── FavoritesPage.tsx        ← ✅ Hoàn chỉnh
│   │   ├── AccountPage.tsx          ← ✅ Hoàn chỉnh
│   │   └── ComingSoonPage.tsx
│   ├── admin/
│   │   └── DashboardAdmin.tsx       ← ✅ Cơ bản hoàn chỉnh (mock data)
│   └── teacher/
│       ├── DashboardTeacher.tsx
│       ├── QuizPage.tsx
│       └── ... (các trang teacher khác — xem bên dưới)
└── data/
    └── mockCourses.ts               ← MOCK_COURSES (dùng tạm, cần thay bằng API)
```

### Backend
```
backend/src/main/java/com/beeacademy/backend/
├── controller/
│   ├── AuthController.java          ← /api/auth/** (UC01-UC04 + OAuth)
│   └── ...
├── service/
│   ├── AuthService.java             ← Business logic auth
│   ├── OtpService.java              ← OTP 6 số, TTL 5 phút, DEV_MODE log to console
│   └── ...
├── client/
│   └── AuthProviderClient.java      ← Gọi Supabase GoTrue REST API
├── config/
│   ├── JwtAuthenticationFilter.java ← Verify JWT ES256 (JWKS) + HS256 fallback
│   ├── SecurityConfig.java          ← Spring Security stateless
│   └── SupabaseProperties.java      ← @ConfigurationProperties("supabase")
├── security/
│   ├── AuthenticatedUser.java       ← record(userId, email, role)
│   └── CurrentUser.java             ← Static helper lấy user từ SecurityContext
├── dto/
│   ├── request/
│   │   ├── LoginRequest.java
│   │   ├── RegisterRequest.java
│   │   ├── OAuthSyncRequest.java    ← fullName, avatarUrl (nullable)
│   │   ├── RequestOtpRequest.java
│   │   ├── VerifyOtpRequest.java
│   │   └── ...
│   └── response/
│       ├── ApiResponse.java
│       ├── AuthTokenResponse.java
│       └── UserSummaryResponse.java
├── model/
│   └── Profile.java                 ← JPA entity, ánh xạ bảng profiles
├── repository/
│   └── ProfileRepository.java
└── exception/
    ├── BusinessException.java
    ├── UnauthorizedException.java   ← Default 401 (đã sửa từ 403)
    └── GlobalExceptionHandler.java
```

---

## UseCase v6.5 — Business Model (Admin chuyển khoản thủ công)

> **Phiên bản UseCase hiện tại: v6.5** (thay thế v6.3). Tài liệu gốc: `BEE ACADEMY.md`.

| Hạng mục | v6.3 (cũ) | v6.5 (hiện tại) |
|---|---|---|
| Mô hình | Marketplace + Stripe Connect | **Admin giữ tiền, chuyển khoản thủ công cuối kỳ** |
| Thanh toán | Stripe Connect (auto split) | **VNPay / MoMo** — tiền về TK công ty |
| Chia doanh thu | Tự động qua Stripe | Hệ thống ghi `revenue_splits`, **Admin chuyển tay** |
| Số UC | 40 (8 module) | **48 (9 module, 7 actor)** |
| TK GV | Stripe Connect | GV tự nhập **TK ngân hàng** (UC45-46) |
| Phụ huynh | Cơ bản | **Module riêng 6 UC** — link mời/chấp nhận (UC47-49) |
| Chứng chỉ | Không | **Module 9** — tự cấp khi pass cuối khóa (UC42-43) |
| Khiếu nại | Không | **UC11** thay cho hoàn tiền |
| Livestream / lịch cố định | — | **Không có** |

---

## Routes đã đăng ký (App.tsx)

### Auth / Common Routes

| Route | Component | Trạng thái |
|---|---|---|
| `/` | LandingPage | ✅ |
| `/login` | Login | ✅ (email/password + Google button) |
| `/register` | Register | ✅ |
| `/auth/callback` | OAuthCallbackPage | ✅ Google OAuth callback |

### Student Routes

| Route | Component | Trạng thái |
|---|---|---|
| `/courses` | CoursesPage | ✅ Hoàn chỉnh (mock data) |
| `/courses/:id` | CourseDetailPage | ✅ Hoàn chỉnh (mock data) |
| `/checkout` | CheckoutPage | ✅ Mock |
| `/payment-result` | PaymentResultPage | ✅ Mock |
| `/orders` | OrdersPage | ✅ |
| `/favorites` | FavoritesPage | ✅ |
| `/messages` | MessagesPage | ✅ |
| `/profile` | ProfilePage | ✅ (chưa gọi API) |
| `/account` | AccountPage | ✅ (chưa gọi API) |
| `/account/type` | ComingSoonPage | ⏳ Placeholder |
| `/account/photo` | AvatarPage | ✅ Hoàn chỉnh |

### Teacher Routes

| Route | Component | Trạng thái |
|---|---|---|
| `/teacher` | DashboardTeacher | ⏳ Skeleton |
| `/teacher/quiz` | QuizPage | ⏳ Skeleton |
| `/teacher/bank` | BankPage | ⏳ Skeleton |
| `/teacher/complaints` | ComplaintsPage (teacher) | ⏳ Skeleton |
| `/teacher/content` | ContentPage | ⏳ Skeleton |
| `/teacher/courses` | CoursesPage (teacher) | ⏳ Skeleton |
| `/teacher/exam` | ExamPage | ⏳ Skeleton |
| `/teacher/grades` | GradesPage | ⏳ Skeleton |
| `/teacher/qa` | QAPage | ⏳ Skeleton |
| `/teacher/quiz/:chapterId` | QuizChapterPage | ⏳ Skeleton |
| `/teacher/revenue` | RevenuePage | ⏳ Skeleton |

### Admin Routes

| Route | Component | Trạng thái |
|---|---|---|
| `/admin` | DashboardAdmin | ✅ Cơ bản (mock data) |
| `/admin/users` | ComingSoonPage | ⏳ |
| `/admin/courses` | ComingSoonPage | ⏳ |
| `/admin/reports` | ComingSoonPage | ⏳ |
| `/admin/complaints` | ComingSoonPage | ⏳ |

---

## Trạng thái Backend — Auth Module ✅

Tất cả endpoint trong `/api/auth/**` đã hoàn thành và hoạt động:

| Endpoint | Mô tả | Trạng thái |
|---|---|---|
| `POST /api/auth/register/request-otp` | Gửi OTP 6 số đến email | ✅ |
| `POST /api/auth/register/verify-otp` | Xác minh OTP + tạo tài khoản | ✅ |
| `POST /api/auth/register` | Đăng ký trực tiếp (không OTP) | ✅ |
| `POST /api/auth/login` | Đăng nhập email/password | ✅ |
| `POST /api/auth/logout` | Đăng xuất (revoke refresh token) | ✅ |
| `POST /api/auth/refresh` | Đổi refresh_token lấy access_token mới | ✅ |
| `POST /api/auth/reset-password` | Gửi email reset password | ✅ |
| `POST /api/auth/change-password` | Đổi mật khẩu (cần JWT) | ✅ |
| `POST /api/auth/oauth/sync` | Sync profile sau Google OAuth (cần JWT) | ✅ |

---

## Lưu ý quan trọng cho phát triển tiếp theo

### JWT & Supabase

**Supabase dùng ES256 (ECDSA P-256), KHÔNG phải HS256.**

- Public key lấy từ JWKS endpoint: `{SUPABASE_URL}/auth/v1/.well-known/jwks.json` (không phải `/.well-known/jwks.json`)
- `JwtAuthenticationFilter` tự fetch JWKS khi khởi động, build `es256Verifier`
- HS256 verifier vẫn có như fallback (self-hosted Supabase)
- Thuật toán được detect tự động từ JWT header field `alg`
- **Nếu ES256 verifier = null** (JWKS fetch thất bại khi startup): JWT của Supabase production sẽ không pass. Kiểm tra log: `ES256 verifier sẵn sàng (kid=...)`

### OTP & Email

- `OtpService` có flag `DEV_MODE` (`app.dev-mode: ${DEV_MODE:false}` trong `application.yml`)
- Khi `DEV_MODE=true`: nếu SMTP lỗi, **swallow exception và log OTP ra console** thay vì crash
- `backend/.env` hiện có `DEV_MODE=true` — nhớ đổi thành `false` khi deploy production
- **Gmail App Password đã bị xóa** khỏi `backend/.env` — cần tạo lại App Password mới tại myaccount.google.com → Security → App passwords trước khi bật email thực
- Email gửi từ `thuthuycan5@gmail.com` (cấu hình trong `MAIL_USERNAME`)

### Google OAuth Flow

Luồng hoàn chỉnh:
1. User click "Tiếp tục với Google" → `window.location.href = buildGoogleOAuthUrl()` (trong `Login.tsx`)
2. URL: `{SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=http://localhost:3000/auth/callback`
3. Google consent → Supabase xử lý → redirect về `/auth/callback#access_token=...&refresh_token=...`
4. `OAuthCallbackPage` parse hash → tạo **standalone axios instance riêng** (không dùng `apiClient`) để tránh interceptor ghi đè token cũ
5. Gọi `POST /api/auth/oauth/sync` với Bearer token OAuth mới
6. Backend verify ES256 JWT → `CurrentUser.required()` → `syncOAuthProfile()` (idempotent)
7. Frontend nhận `UserSummary` → `loginWithTokens()` → redirect `/courses`

**Tại sao không dùng `apiClient` trong OAuthCallbackPage:**
`apiClient` có request interceptor tự đọc token từ Zustand store. Nếu user trước đó đã login bằng email/password, Zustand persist sẽ còn token cũ → interceptor ghi đè token OAuth mới → backend nhận JWT cũ → 401. Giải pháp: `axios.create()` riêng trong `OAuthCallbackPage`.

### `syncOAuthProfile` là Idempotent

Google user đăng nhập lần đầu **không cần đăng ký trước** — `syncOAuthProfile` tự tạo profile với `role = STUDENT`. Gọi lại nhiều lần với cùng `userId` đều an toàn.

### Backend `.env` Structure

File `backend/.env` (không commit — đã gitignore) cần có:
```
SUPABASE_URL=https://...supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...         # base64 string (dùng cho HS256 fallback)
SUPABASE_DB_HOST=...
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USERNAME=postgres
SUPABASE_DB_PASSWORD=...
MAIL_USERNAME=thuthuycan5@gmail.com
MAIL_PASSWORD=...               # Gmail App Password (cần tạo lại)
SERVER_PORT=8080
CORS_ALLOWED_ORIGINS=http://localhost:3000
DEV_MODE=true                   # Đổi false khi deploy
```

### `UnauthorizedException` mặc định 401

File `exception/UnauthorizedException.java` đã được sửa để default `HttpStatus.UNAUTHORIZED` (401), không phải 403. Nếu muốn trả 403 (đã login nhưng không có quyền), dùng constructor 3 tham số: `new UnauthorizedException("code", "msg", HttpStatus.FORBIDDEN)`.

---

## Bug đã biết cần sửa

### `course_status` enum mismatch — ảnh hưởng `/api/courses`

Log lỗi: `ERROR: invalid input value for enum course_status: "PUBLISHED"`

**Nguyên nhân:** Java enum `CourseStatus.PUBLISHED` serialize thành chuỗi `"PUBLISHED"` (uppercase), nhưng Postgres enum `course_status` có thể lưu lowercase (`"published"`). Spring Data JPA gặp mismatch khi query.

**Cách sửa:** Thêm `@Enumerated(EnumType.STRING)` vào field trong entity, hoặc thêm `@Column` converter, hoặc đổi Postgres enum values sang uppercase cho khớp. Cần kiểm tra schema thực tế trong Supabase.

---

## Trạng thái tích hợp Frontend ↔ Backend

| Phần | Trạng thái |
|---|---|
| Auth (login/register/logout/refresh) | ✅ Đã kết nối qua `authService.ts` |
| Google OAuth | ✅ Hoạt động end-to-end |
| Danh sách khóa học (`/courses`) | ❌ Vẫn dùng `MOCK_COURSES` |
| Chi tiết khóa học (`/courses/:id`) | ❌ Vẫn dùng `MOCK_COURSES` |
| Profile / Account (save) | ❌ Chưa gọi API — chỉ update local store |
| Checkout / Payment | ❌ Mock, chưa tích hợp VNPay/MoMo |
| Teacher portal | ❌ Skeleton UI, chưa có API |

---

## Còn lại cần làm (theo thứ tự ưu tiên)

### Ưu tiên cao
1. **Fix `course_status` enum bug** — backend không load được khóa học
2. **Kết nối `/api/courses`** — thay `MOCK_COURSES` bằng API call thực
3. **Authentication guard** — redirect về `/login` nếu chưa đăng nhập cho các route cần auth
4. **`useAuthStore` integration** — hiện đang dùng mock user mặc định, cần sync với JWT thực sau khi login

### Ưu tiên trung bình
5. **Profile / Account API** — `ProfilePage.handleSave` và `AccountPage.handleSave` gọi API thực
6. **Teacher portal** — 10 trang (UC26–UC33, UC45–UC46)
7. **Admin pages** — UC35–UC41 (users, approvals, reports, complaints, payouts, notifications)
8. **VNPay / MoMo checkout** — thay mock

### Ưu tiên thấp hơn
9. **Parent portal** — 5 trang (UC23–UC25, UC47, UC49)
10. **Chứng chỉ** — UC42–UC43 (`/certificates`)
11. **Upload ảnh đại diện** — `/account/photo` ➔ ✅ Đã hoàn thành và kết nối API
12. **`useCartStore` persist localStorage**
13. **Search header** — kết nối API thay vì search MOCK_COURSES

---

## Quyết định kiến trúc quan trọng

### 1. Sidebar student là floating dropdown, không cố định trên trang
**Quyết định**: `DashboardSidebar` chỉ xuất hiện khi click avatar trong header.

**Lý do**: Không chiếm diện tích màn hình thường xuyên, user chủ động truy cập.

**Cách thực hiện**: prop `floating=true` bỏ `sticky`, tăng shadow. Header render bên trong `AnimatePresence`.

### 2. Một component DashboardSidebar duy nhất cho cả 2 chế độ
**Quyết định**: Không tạo `DropdownMenu` riêng — dùng lại `DashboardSidebar` với `floating={true}`.

**Lý do**: Đảm bảo `MENU_ITEMS` luôn đồng nhất. Chỉ có 1 nguồn dữ liệu.

### 3. Luồng mua hàng: "Thêm vào giỏ" chỉ khi đã đăng nhập
**Quyết định**: Nút "Thêm vào giỏ hàng" trong `MarketingView`:
- Chưa login → `navigate('/login', { state: { from: /courses/:id } })` — không toast
- Đã login → `addToCart` + toast

### 4. Login redirect dùng `location.state.from`
**Quyết định**: Sau login thành công, `navigate(location.state?.from ?? '/courses', { replace: true })`.

**Lý do**: User nhấn "Thêm vào giỏ" khi chưa login → sang login → sau khi login quay đúng về trang khóa học vừa xem.

### 5. OAuthCallbackPage dùng standalone axios, không dùng apiClient
**Quyết định**: `axios.create()` riêng trong `OAuthCallbackPage` thay vì import `apiClient`.

**Lý do**: `apiClient` có interceptor tự đọc token từ Zustand persist — nếu có session cũ sẽ ghi đè token OAuth mới, gây 401.

### 6. syncOAuthProfile idempotent — Google user không cần đăng ký trước
**Quyết định**: Backend tự tạo profile `STUDENT` nếu chưa tồn tại khi Google OAuth sync.

**Lý do**: Không thể yêu cầu user đã đăng nhập bằng Google lại phải làm thêm bước đăng ký — UX quá tệ.

### 7. Admin sidebar: gộp Học viên + Giáo viên → "Quản lý người dùng"
**Quyết định**: Một mục "Quản lý người dùng" thay cho 2 mục riêng biệt.

**Lý do**: Đơn giản hóa sidebar, quản lý theo vai trò (role-based) trong cùng một trang.

### 8. Toolbar B/I dùng Markdown syntax
**Quyết định**: Toolbar Bold/Italic trong ProfilePage chèn `**text**` / `*text*` vào textarea thuần.

**Lý do**: Không muốn thêm rich text editor (Quill, TipTap) cho MVP.

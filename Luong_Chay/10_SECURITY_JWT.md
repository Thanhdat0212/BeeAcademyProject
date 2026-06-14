# Luồng Security & JWT — Cross-cutting

Trạng thái: ✅ Đã triển khai đầy đủ

---

## 1. Kiến trúc xác thực

```
Browser                  Spring Boot              Supabase GoTrue
    │                        │                         │
    │──── Request + JWT ────►│                         │
    │                        │                         │
    │                   JwtAuthenticationFilter         │
    │                   (OncePerRequestFilter)          │
    │                        │                         │
    │                   Đọc "Authorization: Bearer {token}"
    │                        │                         │
    │                   JWT.decode(token)               │
    │                   → Lấy header.alg               │
    │                        │                         │
    │              ┌─────────┴──────────┐              │
    │          alg=ES256           alg=HS256            │
    │              │                    │               │
    │         es256Verifier        hs256Verifier        │
    │         (ECDSA P-256)        (HMAC SHA-256)       │
    │         build từ JWKS        build từ             │
    │         endpoint             SUPABASE_JWT_SECRET  │
    │              │                    │               │
    │              └─────────┬──────────┘              │
    │                   verify(token)                   │
    │                        │                         │
    │              ┌──────────────────┐                │
    │          Hợp lệ          Không hợp lệ            │
    │              │                    │               │
    │         buildAuthenticatedUser  log.warn          │
    │         setSecurityContext      (không throw)     │
    │              │                    │               │
    │         filterChain.doFilter() → tiếp tục        │
```

---

## 2. Khởi tạo JWT Verifiers khi startup

```
Khi Spring Boot khởi động:

JwtAuthenticationFilter(SupabaseProperties props):
    │
    ├── buildEs256Verifier(props.url()):
    │       URL = "{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
    │       → HTTP GET để lấy JWKS (JSON Web Key Set)
    │       → Parse public key ECDSA P-256 (kid, x, y)
    │       → Build JWTVerifier với Algorithm.ECDSA256(publicKey)
    │       → Log: "ES256 verifier sẵn sàng (kid=...)"
    │
    │       [Nếu JWKS fetch thất bại]:
    │           → es256Verifier = null
    │           → Log ERROR: "Không thể khởi tạo ES256 verifier"
    │           → JWT của Supabase production sẽ KHÔNG pass!
    │
    └── buildHs256Verifier(props.jwtSecret()):
            → props.jwtSecret() = SUPABASE_JWT_SECRET (base64 encoded)
            → Algorithm.HMAC256(Base64.decode(jwtSecret))
            → Build JWTVerifier
            → Dùng làm fallback cho self-hosted Supabase
```

---

## 3. Mỗi request đến

```
Request: GET /api/courses/detail/{id}
    Header: Authorization: Bearer eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ1c2VyLWlkIn0.sig
    │
    ▼
JwtAuthenticationFilter.doFilterInternal():
    │
    ├── Trích xuất token từ header:
    │       header.startsWith("Bearer ") → token = header.substring(7)
    │
    ├── JWT.decode(token) → DecodedJWT unverified (CHƯA verify)
    │       → Đọc header.alg = "ES256"
    │
    ├── selectVerifier("ES256") → trả es256Verifier
    │       (nếu "HS256" → trả hs256Verifier)
    │       (nếu alg lạ → trả null → skip)
    │
    ├── es256Verifier.verify(token) → DecodedJWT decoded (đã verify)
    │       [Nếu expired / tampered → ném JWTVerificationException → log.warn + continue]
    │
    ├── buildAuthenticatedUser(decoded):
    │       userId = UUID.fromString(decoded.getSubject())
    │       email  = decoded.getClaim("email").asString()
    │       role   = decoded.getClaim("user_metadata").get("role") // "student"
    │       → new AuthenticatedUser(userId, email, role)
    │
    ├── setSecurityContext(user, request):
    │       authentication = new UsernamePasswordAuthenticationToken(user, null, [])
    │       SecurityContextHolder.getContext().setAuthentication(authentication)
    │
    └── filterChain.doFilter(request, response) → đến Controller
```

---

## 4. Phân quyền tại Controller

```
Cách 1: CurrentUser.required() — ném 401 nếu chưa xác thực
    AuthController.changePassword():
        AuthenticatedUser me = CurrentUser.required();
        // me.userId(), me.email(), me.role() đã sẵn sàng

Cách 2: CurrentUser.optional() — trả null nếu guest
    CourseController.getCourseDetail():
        AuthenticatedUser me = CurrentUser.optional();
        // null = guest, non-null = đã đăng nhập

Cách 3: @PreAuthorize("hasRole('parent')") — Spring Security annotation
    ParentController:
        @PreAuthorize("hasRole('parent')")
        // Tự động ném 403 nếu role != parent
```

---

## 5. Public routes (không cần JWT)

Cấu hình trong SecurityConfig:

```java
.requestMatchers(
    "/api/auth/**",          // đăng ký, đăng nhập, logout, refresh, reset password
    "/api/courses",          // danh sách khóa học (guest xem được)
    "/api/courses/**",       // chi tiết khóa học (guest thấy bài miễn phí)
    "/api/categories",       // danh sách môn học
    "/api/health"            // health check
).permitAll()
.anyRequest().authenticated()
```

Lưu ý: Route `GET /api/courses/**` là public, nhưng **phân quyền xem video** 
vẫn do `CourseService.canUserAccessAllVideos()` xử lý dựa trên `CurrentUser.optional()`.

---

## 6. Token lifecycle

```
accessToken:
    └── Phát hành bởi Supabase GoTrue
    └── Thuật toán: ES256 (ECDSA P-256)
    └── TTL: ~1 giờ (cấu hình trong Supabase Dashboard)
    └── Claims: sub (userId), email, user_metadata.role, exp, iat

refreshToken:
    └── Phát hành bởi Supabase GoTrue
    └── TTL: ~7-30 ngày (cấu hình trong Supabase Dashboard)
    └── Dùng để lấy accessToken mới: POST /api/auth/refresh
    └── Rotation: mỗi lần refresh → refreshToken cũ bị revoke, trả cái mới

Lưu trữ phía FE (localStorage — ⚠️ XSS risk):
    bee-academy-auth:
        {
            isLoggedIn: true,
            accessToken: "eyJ...",
            refreshToken: "eyJ...",
            user: { name, email, avatar, role }
        }

Kế hoạch nâng cấp (Production):
    → accessToken trong memory (không persist), refreshToken trong httpOnly cookie
    → BE set cookie: Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Strict
```

---

## 7. Xử lý lỗi xác thực

```
Tình huống 1: Token hết hạn
    → HTTP 401
    → Axios interceptor bắt 401
    → Tự động gọi POST /api/auth/refresh
    → Nếu refresh thành công → retry request gốc
    → Nếu refresh fail (refresh token hết hạn) → logout + redirect /login

Tình huống 2: Token giả mạo / signature sai
    → JWTVerificationException → log.warn + skip setSecurityContext
    → Request tiếp tục nhưng SecurityContext = anonymous
    → Controller gọi CurrentUser.required() → ném UnauthorizedException 401

Tình huống 3: Role không đủ quyền
    → @PreAuthorize fail → Spring ném AccessDeniedException
    → GlobalExceptionHandler map → HTTP 403

Tình huống 4: JWKS fetch fail khi startup
    → es256Verifier = null
    → Mọi ES256 JWT đều bị skip (không verify được)
    → Tất cả request cần auth → 401
    → Kiểm tra log: "Không thể khởi tạo ES256 verifier"
    → Fix: kiểm tra SUPABASE_URL, SUPABASE_ANON_KEY trong .env
```

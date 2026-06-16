# UnitTest Summary — Bee Academy Week 4

## Tổng quan

| Loại | Số lượng | Framework |
|---|---|---|
| Unit Tests | 12 | JUnit 5 + Mockito |
| Integration Tests | 8 | JUnit 5 + Spring Boot Test + MockMvc |
| **Tổng** | **20** | |

---

## 1. Unit Tests

### QuestionService — `QuestionServiceTest.java`

**Class được test:** `com.beeacademy.backend.service.QuestionService`

| Mã TC | Tên test | Kịch bản | Kết quả mong đợi |
|---|---|---|---|
| TC01 | `createQuestion_ShouldReturnResponse_WhenValidRequest` | Happy path: 1 đáp án đúng | Trả `QuestionResponse` |
| TC02 | `createQuestion_ShouldThrow_WhenNoCorrectAnswer` | Không có đáp án đúng | `BusinessException` |
| TC03 | `createQuestion_ShouldThrow_WhenMultipleCorrectAnswers` | 2 đáp án đúng | `BusinessException` |
| TC04 | `createQuestion_ShouldThrow_WhenCategoryNotFound` | Category UUID không tồn tại | `ResourceNotFoundException` |
| TC05 | `deleteQuestion_ShouldDeactivate_WhenUsageCountPositive` | Câu hỏi đã dùng (usageCount > 0) | Soft-delete: status = inactive |
| TC06 | `deleteQuestion_ShouldHardDelete_WhenUsageCountZero` | Câu hỏi chưa dùng (usageCount = 0) | Hard-delete: gọi `repository.delete()` |
| TC07 | `bulkCreateQuestions_ShouldThrow_WhenExceeds200` | Import 201 câu cùng lúc | `BusinessException` |

**Mocks được dùng:** `QuestionRepository`, `CategoryRepository`, `QuestionChoiceRepository`

---

### ApprovalService — `ApprovalServiceTest.java`

**Class được test:** `com.beeacademy.backend.service.ApprovalService`

| Mã TC | Tên test | Kịch bản | Kết quả mong đợi |
|---|---|---|---|
| TC08 | `approve_ShouldPublishCourse_WhenPending` | Course ở PENDING_REVIEW | Status → PUBLISHED, lưu ApprovalHistory action="approved" |
| TC09 | `reject_ShouldThrow_WhenCommentBlank` | Comment null hoặc khoảng trắng | `BusinessException` (không truy cập DB) |
| TC10 | `revise_ShouldSaveHistoryWithCorrectAction_WhenCommentProvided` | Yêu cầu sửa với comment | Status → NEEDS_REVISION, history action="needs_revision" |
| TC11 | `approve_ShouldThrow_WhenCourseNotPending` | Course ở DRAFT | `BusinessException` "không ở trạng thái chờ duyệt" |
| TC12 | `approve_ShouldThrow_WhenCourseNotFound` | courseId không tồn tại | `ResourceNotFoundException` "COURSE_NOT_FOUND" |

**Mocks được dùng:** `CourseRepository`, `ProfileRepository`, `ApprovalHistoryRepository`

---

## 2. Integration Tests

### HealthController — `HealthControllerIntegrationTest.java`

**Stack:** Spring Boot + H2 + MockMvc (không cần auth)

| Mã IT | Tên test | Request | Kết quả mong đợi |
|---|---|---|---|
| IT01 | `health_ShouldReturn200_WhenCalled` | `GET /api/health` | 200, `data.db="up"`, `data.status="ok"` |
| IT02 | `health_ShouldReturn200_WithoutAuthentication` | `GET /api/health` (không có token) | 200 (public endpoint) |

---

### AdminApprovalController — `AdminApprovalControllerIntegrationTest.java`

**Stack:** Spring Boot + H2 + MockMvc + `RequestPostProcessor` (inject `AuthenticatedUser`)

**Dữ liệu test (`@BeforeEach`):** Tạo Profile admin + teacher + 1 Course ở PENDING_REVIEW trong H2

| Mã IT | Tên test | Request | Kết quả mong đợi |
|---|---|---|---|
| IT03 | `getPendingCourses_ShouldReturn200_WhenAdminAuthenticated` | `GET /api/admin/courses/pending` (as admin) | 200, `data.items` là array |
| IT04 | `approveCourse_ShouldReturn200_WhenPendingCourse` | `POST /api/admin/courses/{id}/approve` (as admin) | 200, message "Đã duyệt và xuất bản..." |
| IT05 | `rejectCourse_ShouldReturn400_WhenCommentBlank` | `POST /api/admin/courses/{id}/reject` body: `{"comment":""}` | 400 Bad Request |
| IT06 | `getPendingCourses_ShouldReturn401_WhenUnauthenticated` | `GET /api/admin/courses/pending` (không có token) | 401 hoặc 403 |

---

### QuestionController — `QuestionControllerIntegrationTest.java`

**Stack:** Spring Boot + H2 + MockMvc + `RequestPostProcessor` (inject `AuthenticatedUser`)

**Dữ liệu test (`@BeforeEach`):** Tạo Profile teacher + Category trong H2

| Mã IT | Tên test | Request | Kết quả mong đợi |
|---|---|---|---|
| IT07 | `listQuestions_ShouldReturn200_WhenTeacherAuthenticated` | `GET /api/teacher/questions` (as teacher) | 200, `data.items` là array |
| IT08 | `createQuestion_ShouldReturn200_WhenValidRequest` | `POST /api/teacher/questions` (as teacher) với body hợp lệ | 200, trả `data.difficulty`, `data.choices` |
| IT09 | `createQuestion_ShouldReturn400_WhenContentBlank` | `POST /api/teacher/questions` với `content: ""` | 400 Bad Request |
| IT10 | `listQuestions_ShouldReturn401_WhenUnauthenticated` | `GET /api/teacher/questions` (không có token) | 401 hoặc 403 |

---

## 3. Kỹ thuật đặc biệt

### Tại sao dùng `RequestPostProcessor` thay vì `@WithMockUser`?

`CurrentUser.required()` trong code thực tế kiểm tra `principal instanceof AuthenticatedUser`. Nếu dùng `@WithMockUser`, Spring Security tạo principal là `User` (không phải `AuthenticatedUser`) → `CurrentUser.required()` ném exception.

**Giải pháp:**
```java
private RequestPostProcessor asAdmin() {
    AuthenticatedUser adminUser = new AuthenticatedUser(adminId, "admin@beeacademy.vn", "admin");
    return authentication(new UsernamePasswordAuthenticationToken(
            adminUser, null,
            List.of(new SimpleGrantedAuthority("ROLE_admin"))
    ));
}
```

### H2 Compatibility Adaptations

| Vấn đề PostgreSQL | Giải pháp |
|---|---|
| `@ColumnTransformer(write="?::course_status")` | Xóa, dùng `@Enumerated(EnumType.STRING)` |
| `int[] grades` với `@JdbcTypeCode(SqlTypes.ARRAY)` | String "6,7,8" — parse khi cần |
| ECDSA JWKS filter | Không có trong project này |

---

## 4. Cách chạy và xem kết quả

```bash
# Chạy toàn bộ test
cd week4-testing
mvn test

# Xem report JaCoCo
start target/site/jacoco/index.html
```

> Xem `GUIDE.md` để biết chi tiết cách đọc report và các lệnh chạy riêng lẻ.

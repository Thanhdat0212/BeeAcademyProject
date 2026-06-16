# GUIDE — Bee Academy Week 4 Unit Testing

## Mục đích
Project độc lập (tách biệt hoàn toàn với backend chính) phục vụ bài tập Lab 4.
Chứa unit test + integration test cho `QuestionService` và `ApprovalService`.

---

## Cấu trúc project

```
week4-testing/
├── pom.xml                          ← H2 + JaCoCo + Spring Boot 3.2
├── GUIDE.md                         ← file này
├── UnitTest_Summary.md              ← danh sách test cases
└── src/
    ├── main/java/com/beeacademy/backend/
    │   ├── BeeAcademyTestApp.java   ← main class
    │   ├── config/
    │   │   ├── SecurityConfig.java  ← Spring Security (stateless, no JWT)
    │   │   └── GlobalExceptionHandler.java
    │   ├── security/                ← AuthenticatedUser, CurrentUser
    │   ├── exception/               ← BusinessException, ResourceNotFoundException
    │   ├── model/                   ← JPA entities (H2-compatible)
    │   ├── repository/              ← Spring Data JPA interfaces
    │   ├── dto/                     ← request/response records
    │   ├── service/
    │   │   ├── QuestionService.java ← TESTED
    │   │   └── ApprovalService.java ← TESTED
    │   └── controller/
    │       ├── HealthController.java
    │       ├── QuestionController.java
    │       └── AdminApprovalController.java
    └── test/
        ├── resources/application-test.yml
        └── java/com/beeacademy/backend/
            ├── service/
            │   ├── QuestionServiceTest.java   ← 7 unit tests (TC01–TC07)
            │   └── ApprovalServiceTest.java   ← 5 unit tests (TC08–TC12)
            └── controller/
                ├── HealthControllerIntegrationTest.java       (IT01–IT02)
                ├── AdminApprovalControllerIntegrationTest.java (IT03–IT06)
                └── QuestionControllerIntegrationTest.java     (IT07–IT10)
```

---

## Khác biệt so với backend chính (H2-adaptation)

| Vấn đề PostgreSQL | Giải pháp trong project này |
|---|---|
| `@ColumnTransformer(write="?::course_status")` | Xóa, dùng `@Enumerated(EnumType.STRING)` |
| `@JdbcTypeCode(SqlTypes.ARRAY)` cho `int[] grades` | Lưu dạng String "6,7,8", parse lại khi cần |
| `@ColumnTransformer` cho difficulty/type/status | Xóa, lưu VARCHAR thông thường |
| `spring-dotenv` đọc `.env` Supabase | Không dùng, H2 JDBC trực tiếp |
| JWT filter fetch JWKS | Không có, dùng `RequestPostProcessor` trong test |

---

## Cách chạy test

### Yêu cầu
- Java 21+
- Maven 3.8+
- Không cần `.env` file hay kết nối Supabase

### Chạy toàn bộ test + tạo JaCoCo report

```bash
cd week4-testing
mvn test
```

### Chạy riêng unit tests (nhanh, ~2-3 giây)

```bash
mvn test -Dtest="QuestionServiceTest,ApprovalServiceTest"
```

### Chạy riêng integration tests

```bash
mvn test -Dtest="*IntegrationTest"
```

### Chạy một test case cụ thể

```bash
mvn test -Dtest="QuestionServiceTest#createQuestion_ShouldReturnResponse_WhenValidRequest"
```

---

## Xem JaCoCo HTML Report

Sau khi chạy `mvn test`, report được tạo tại:

```
week4-testing/target/site/jacoco/index.html
```

**Mở report:**
- Windows: double-click file `target/site/jacoco/index.html` hoặc dùng lệnh:
  ```bash
  start target/site/jacoco/index.html
  ```
- macOS/Linux:
  ```bash
  open target/site/jacoco/index.html
  ```

**Đọc report:**
| Màu | Ý nghĩa |
|---|---|
| 🟢 Xanh lá | Code đã được test (covered) |
| 🔴 Đỏ | Code chưa được test (uncovered) |
| 🟡 Vàng | Covered một phần (partial branch) |

**Các metric quan trọng:**
- **Instructions**: % câu lệnh bytecode đã chạy qua
- **Branches**: % nhánh điều kiện đã test (if/else, switch)
- **Lines**: % dòng code đã được thực thi
- **Methods**: % phương thức đã được gọi

---

## Ý nghĩa từng file test

### Unit Tests (dùng Mockito — không cần Spring, không cần DB)

#### `QuestionServiceTest.java`
| Test | Mục đích |
|---|---|
| TC01 `createQuestion_ShouldReturnResponse_WhenValidRequest` | Happy path: tạo câu hỏi đúng input → trả `QuestionResponse` |
| TC02 `createQuestion_ShouldThrow_WhenNoCorrectAnswer` | Không có đáp án đúng → `BusinessException` |
| TC03 `createQuestion_ShouldThrow_WhenMultipleCorrectAnswers` | Nhiều hơn 1 đáp án đúng → `BusinessException` |
| TC04 `createQuestion_ShouldThrow_WhenCategoryNotFound` | Category UUID không tồn tại → `ResourceNotFoundException` |
| TC05 `deleteQuestion_ShouldDeactivate_WhenUsageCountPositive` | Câu hỏi đã dùng → soft-delete (status=inactive) |
| TC06 `deleteQuestion_ShouldHardDelete_WhenUsageCountZero` | Câu hỏi chưa dùng → hard-delete khỏi DB |
| TC07 `bulkCreateQuestions_ShouldThrow_WhenExceeds200` | Import > 200 câu cùng lúc → `BusinessException` |

#### `ApprovalServiceTest.java`
| Test | Mục đích |
|---|---|
| TC08 `approve_ShouldPublishCourse_WhenPending` | Admin duyệt → status PUBLISHED + ghi history |
| TC09 `reject_ShouldThrow_WhenCommentBlank` | Từ chối mà không có lý do → `BusinessException` |
| TC10 `revise_ShouldSaveHistoryWithCorrectAction_WhenCommentProvided` | Yêu cầu sửa → history action="needs_revision" |
| TC11 `approve_ShouldThrow_WhenCourseNotPending` | Course không ở PENDING_REVIEW → `BusinessException` |
| TC12 `approve_ShouldThrow_WhenCourseNotFound` | Course UUID không tồn tại → `ResourceNotFoundException` |

### Integration Tests (dùng Spring Boot + H2 + MockMvc)

#### `HealthControllerIntegrationTest.java`
| Test | Mục đích |
|---|---|
| IT01 `health_ShouldReturn200_WhenCalled` | Endpoint public, H2 up → `{"status":"ok","db":"up"}` |
| IT02 `health_ShouldReturn200_WithoutAuthentication` | Không cần JWT → vẫn 200 |

#### `AdminApprovalControllerIntegrationTest.java`
| Test | Mục đích |
|---|---|
| IT03 `getPendingCourses_ShouldReturn200_WhenAdminAuthenticated` | Admin xem danh sách → 200 + array |
| IT04 `approveCourse_ShouldReturn200_WhenPendingCourse` | Admin duyệt → 200 + message |
| IT05 `rejectCourse_ShouldReturn400_WhenCommentBlank` | Từ chối không có lý do → 400 |
| IT06 `getPendingCourses_ShouldReturn401_WhenUnauthenticated` | Không có auth → 401/403 |

#### `QuestionControllerIntegrationTest.java`
| Test | Mục đích |
|---|---|
| IT07 `listQuestions_ShouldReturn200_WhenTeacherAuthenticated` | GET danh sách → 200 + array |
| IT08 `createQuestion_ShouldReturn200_WhenValidRequest` | POST hợp lệ → 200 + câu hỏi mới |
| IT09 `createQuestion_ShouldReturn400_WhenContentBlank` | Content rỗng → 400 validation |
| IT10 `listQuestions_ShouldReturn401_WhenUnauthenticated` | Không auth → 401/403 |

---

## Tại sao Integration Test chậm hơn Unit Test?

### Thời gian thực tế (ví dụ)
| Loại test | Thời gian |
|---|---|
| Unit Tests (12 tests) | ~0.5 – 1 giây |
| Integration Tests (8 tests) | ~8 – 15 giây |

### Nguyên nhân

**Unit Test nhanh vì:**
- Không khởi động Spring container
- Không tạo H2 database / schema
- Mockito trả kết quả ngay lập tức (in-memory)
- Mỗi test độc lập, không I/O

**Integration Test chậm vì:**
1. **Spring Boot startup**: load toàn bộ `ApplicationContext` — scan bean, khởi tạo JPA, register controllers (~3-5 giây cho lần đầu)
2. **H2 schema creation**: JPA tạo tất cả bảng từ entity annotations (`ddl-auto: create-drop`)
3. **HTTP request pipeline**: qua Spring Security filter chain → DispatcherServlet → controller → service → repository → H2
4. **Transaction management**: `@Transactional` bắt đầu, commit/rollback sau mỗi test
5. **`@DirtiesContext`**: rebuild Spring context giữa các test class (nếu có)

**Kết luận**: Unit Test chỉ test logic thuần (service) nên cực kỳ nhanh. Integration Test test toàn bộ stack nên mất thêm thời gian setup — đây là sự đánh đổi (trade-off) để có độ tin cậy cao hơn.

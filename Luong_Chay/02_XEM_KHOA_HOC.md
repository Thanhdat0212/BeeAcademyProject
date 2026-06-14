# Luồng Xem Khóa Học — UC06, UC07, UC08

Trạng thái: ✅ Đã triển khai (backend hoàn chỉnh, frontend kết nối API thật)

---

## 1. Duyệt danh sách khóa học (UC06)

```
User vào /courses (có thể kèm query params)
    │
    ▼
CoursesPage.tsx
    ├── Fetch categories: GET /api/categories
    │       → CategoryController.listAll()
    │       → categoryRepository.findAllByOrderByDisplayOrderAsc()
    │       → Trả List<CategoryResponse> [Toán học, Tiếng Anh, ...]
    │       → Render tabs bộ lọc môn học
    │
    └── Fetch courses: GET /api/courses?subject=toan-hoc&grade=8&q=đại+số&page=0&size=12
            │
            ▼
        CourseController.searchCourses()
            └── CourseService.searchCourses(subjectSlug, grade, keyword, pageable)
                    │
                    ▼
                Compose Specification:
                    Specification.where(onlyPublished())          ← BẮT BUỘC, luôn áp
                        .and(matchCategorySlug("toan-hoc"))       ← bỏ qua nếu null
                        .and(matchGrade(8))                       ← bỏ qua nếu null
                        .and(matchKeyword("đại số"))              ← ILIKE %đại+số%
                    │
                    ▼
                courseRepository.findAll(spec, pageable)
                    → SQL: SELECT * FROM courses
                           WHERE status = 'published'::course_status
                             AND category.slug = 'toan-hoc'
                             AND 8 = ANY(grades)
                             AND (LOWER(title) LIKE '%đại số%'
                               OR LOWER(description) LIKE '%đại số%')
                           ORDER BY created_at DESC
                           LIMIT 12 OFFSET 0
                    │
                    ▼
                Map Page<Course> → PageResponse<CourseSummaryResponse>
                    └── Mỗi course: {id, slug, title, thumbnailUrl, categoryName,
                                     teacherName, grades, priceVnd, salePriceVnd,
                                     effectivePriceVnd, isOnSale, totalLessons, ...}
            │
            ▼
        Trả ApiResponse<PageResponse<CourseSummaryResponse>>
    │
    ▼
CoursesPage render grid courses
    ├── Đánh dấu "Đã mua" nếu courseId ∈ useCourseStore.purchasedIds  [⚠️ Mock local]
    ├── Đánh dấu "Yêu thích" nếu courseId ∈ useCourseStore.favoritedIds
    └── Phân trang theo PageResponse.totalPages
```

**Bug đã fix:** `onlyPublished()` dùng `CourseStatus.PUBLISHED.toDbValue()` ("published" lowercase)
thay vì enum object → tránh lỗi `invalid input value for enum course_status: "PUBLISHED"`.

---

## 2. Xem chi tiết khóa học (UC07)

```
User click vào khóa học → navigate /courses/{uuid}
    │
    ▼
CourseDetailPage.tsx
    └── courseService.getDetail(id)
            → GET /api/courses/{id}
            │
            ▼
        CourseController.getCourseDetail(id)
            ├── AuthenticatedUser me = CurrentUser.optional()
            │       → null nếu guest (không có JWT)
            │       → AuthenticatedUser nếu đã đăng nhập
            └── CourseService.getCourseDetail(id, me)
                    ├── courseRepository.findWithCategoryAndTeacherById(id)
                    │       → JOIN FETCH category + teacher (tránh N+1)
                    │       → Ném ResourceNotFoundException nếu không tìm thấy → 404
                    │
                    ├── canUserAccessAllVideos(course, me)  ← UC08
                    │       (xem mục 3 bên dưới)
                    │
                    └── CourseDetailResponse.fromEntity(course, canSeeAllVideos)
                            ├── Map chapters: course.getChapters() (LAZY → trigger fetch)
                            └── Mỗi chapter → ChapterResponse.fromEntity(chapter, canSeeAllVideos)
                                    └── Mỗi lesson → LessonResponse.fromEntity(lesson, includeUrl)
                                            includeUrl = canSeeAllVideos || lesson.isFree
                                            → videoUrl = null nếu includeUrl=false
    │
    ▼
adaptCourseDetail(detail) → map backend DTO → UI Course object
    │
    ▼
Kiểm tra purchasedIds.includes(course.id)   [⚠️ Zustand local — sẽ đổi sang enrollment API]
    ├── true  → render <LearningView course={course} />
    └── false → render <MarketingView course={course} />
```

---

## 3. Phân quyền xem video (UC08)

```
canUserAccessAllVideos(course, me):

    Bước 1: me == null (Guest)
        → return false
        → Học sinh chỉ thấy URL của lesson isFree=true
        → Các lesson trả: { videoUrl: null, isFree: false }

    Bước 2: me.role == "admin"
        → return true
        → Admin thấy tất cả video (cần preview để duyệt nội dung)

    Bước 3: course.teacher.id == me.userId
        → return true
        → Giáo viên sở hữu khóa xem lại bài của mình

    Bước 4: enrollmentRepository.existsByUserIdAndCourseId(me.userId, course.id)
        → true  → return true  (đã mua → xem toàn bộ)
        → false → return false (chưa mua → chỉ xem bài miễn phí)
```

**Sơ đồ tác động của canSeeAllVideos:**

```
canSeeAllVideos = false:
    Chương 1
    ├── Bài 1: "Giới thiệu" (isFree=true)  → videoUrl = "https://..."  ← thấy được
    ├── Bài 2: "Phần 2" (isFree=false)     → videoUrl = null           ← bị ẩn
    └── Bài 3: "Phần 3" (isFree=false)     → videoUrl = null           ← bị ẩn

canSeeAllVideos = true:
    Chương 1
    ├── Bài 1: "Giới thiệu" (isFree=true)  → videoUrl = "https://..."  ← thấy
    ├── Bài 2: "Phần 2" (isFree=false)     → videoUrl = "https://..."  ← thấy
    └── Bài 3: "Phần 3" (isFree=false)     → videoUrl = "https://..."  ← thấy
```

**Ghi chú tương lai (Phase 2 — Upload):**
Khi video được upload lên private bucket Supabase, `videoUrl` sẽ là **Signed URL** (TTL 1 giờ)
thay vì permanent URL. Backend sẽ gọi:
```
POST /storage/v1/object/sign/course-videos/{storagePath}
Body: { "expiresIn": 3600 }
→ signed URL tự hết hạn sau 1 giờ
```

---

## 4. Tìm kiếm khóa học qua Header

```
User gõ từ khóa vào SearchBar trong DashboardHeader
    │
    ▼ (debounce 300ms)
    │
CoursesPage nhận query param ?q={keyword}
    └── Tự động gọi lại GET /api/courses?q={keyword}
        → matchKeyword() Specification → ILIKE search title + description
```

---

## 5. Luồng xem khóa học đã mua (Learning View)

```
Student (đã đăng nhập + đã mua) → /courses/{uuid}
    │
    ▼
CourseDetailPage: isEnrolled = purchasedIds.includes(course.id)
    → true → render LearningView
    │
    ▼
LearningView hiển thị:
    ├── Video player (videoUrl đầy đủ từ API)
    ├── Curriculum sidebar: tất cả chapters + lessons
    ├── Nút "Hoàn thành bài" → completedLessons trong useCourseStore [Local mock]
    └── Tiến độ học: completedLessons.length / totalLessons * 100%
```

**⚠️ Giới hạn hiện tại:**
- `purchasedIds` là Zustand local state — không đồng bộ với DB
- Sau khi refresh trang, nếu `purchasedIds` không persist → mất trạng thái "đã mua"
- Module 3 (Thanh toán) sẽ thay bằng `GET /api/my-courses` từ bảng `enrollments`

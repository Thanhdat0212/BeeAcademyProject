# Luồng Giáo Viên Đăng Khóa Học — UC27, UC28

Trạng thái: ⏳ Kế hoạch Phase 1–2 (chưa triển khai)

---

## Tổng quan vòng đời khóa học

```
GV tạo khóa                                          Admin duyệt
     │                                                    │
  DRAFT ──[submit]──► PENDING_REVIEW ──[approve]──► APPROVED ──[auto-publish]──► PUBLISHED
     ▲                      │                [reject] │
     │                 [revise]              │         ▼
     │                      │               │      REJECTED
     └──────────────── NEEDS_REVISION ◄──────

Chỉ cho phép sửa nội dung khi status ∈ {DRAFT, NEEDS_REVISION}
```

---

## 1. Tạo khóa học mới

```
GV vào /teacher/courses/new → điền form
    │
    ▼
FE: POST /api/teacher/courses
    Header: Authorization: Bearer {accessToken}  (role=teacher)
    Body: {
        title: "Toán Đại Số Lớp 8",
        description: "...",
        categoryId: "uuid-toan-hoc",
        grades: [8],
        priceVnd: 299000,
        salePriceVnd: null
    }
    │
    ▼
TeacherCourseController → TeacherCourseService.createCourse(teacherId, req)
    ├── Validate: categoryId tồn tại
    ├── Sinh slug từ title: "toan-dai-so-lop-8"
    │       Nếu slug đã tồn tại → thêm suffix "-2", "-3"...
    ├── Course mới: status = DRAFT, teacher = currentUser
    └── INSERT INTO courses { id, slug, title, ..., status: 'draft', teacher_id }
    │
    ▼
Trả CourseResponse { id, slug, status: "DRAFT", ... }
    │
    ▼
FE: navigate /teacher/courses/{id}/content
    → Bước tiếp theo: thêm chương và bài giảng
```

---

## 2. Quản lý chương và bài giảng

```
GV vào /teacher/content (hoặc /teacher/courses/{id})
    │
    ▼
    ├── [Thêm chương]
    │       FE: POST /api/teacher/courses/{id}/chapters
    │           Body: { title: "Chương 1: Hằng đẳng thức", position: 1 }
    │           │
    │           ▼
    │       ChapterController → TeacherCourseService.addChapter(courseId, teacherId, req)
    │           ├── Verify: course thuộc teacher, status ∈ {DRAFT, NEEDS_REVISION}
    │           └── INSERT INTO chapters { id, course_id, title, position }
    │
    ├── [Thêm bài giảng vào chương]
    │       FE: POST /api/teacher/chapters/{chId}/lessons
    │           Body: { title: "Bài 1: (a+b)²", position: 1, isFree: false }
    │           │
    │           ▼
    │       LessonController → TeacherCourseService.addLesson(chapterId, teacherId, req)
    │           └── INSERT INTO lessons { id, chapter_id, title, position, is_free }
    │
    ├── [Sửa thứ tự] → PATCH /api/teacher/chapters/{id}/reorder
    │       Body: { newPosition: 2 }
    │
    └── [Xóa chương] → DELETE /api/teacher/chapters/{id}
            → CASCADE xóa tất cả lessons + documents trong chương
```

---

## 3. Upload video bài giảng

```
GV chọn file MP4 → drag & drop vào ô upload của lesson
    │
    ▼
FE: Hiển thị progress bar ngay lập tức

FE: POST /api/upload/video/{courseId}/{chapterId}/{lessonId}
    Header: Authorization: Bearer {accessToken}
    Body: multipart/form-data { file: <video.mp4> }
    │
    ▼
UploadController → ContentUploadService.uploadVideo(courseId, chapterId, lessonId, bytes, mime)
    │
    ├── Validate:
    │       MIME: video/mp4 | video/webm | video/quicktime
    │       Size: ≤ 500MB (cấu hình spring.servlet.multipart.max-file-size)
    │       Verify: lesson thuộc courseId, course thuộc teacherId
    │
    ├── Build storage path:
    │       "{courseId}/{chapterId}/{lessonId}.mp4"
    │
    ├── SupabaseStorageClient.upload(
    │       bucket = "course-videos",   ← PRIVATE bucket (không ai truy cập trực tiếp)
    │       path   = "{courseId}/{chapterId}/{lessonId}.mp4",
    │       contentType = "video/mp4",
    │       bytes  = file.getBytes()
    │   )
    │   → PUT {SUPABASE_URL}/storage/v1/object/course-videos/{path}
    │
    ├── UPDATE lessons SET video_storage_path = '{path}' WHERE id = {lessonId}
    │       [Lưu PATH, không phải URL — video là private, cần signed URL khi xem]
    │
    └── Trả { storagePath: "{courseId}/{chapterId}/{lessonId}.mp4" }
    │
    ▼
FE: Cập nhật UI — thumbnail preview video, progress = 100%
    → Hiển thị icon "Video đã upload" ✓
```

**Tại sao lưu `storagePath` thay vì `videoUrl`?**

Video nằm trong **private bucket**. Không có URL cố định. Mỗi khi học sinh xem,
backend sẽ generate **Signed URL** (TTL 1 giờ). Xem chi tiết ở `02_XEM_KHOA_HOC.md`.

**Cấu hình cần thêm vào `application.yml`:**
```yaml
spring:
  servlet:
    multipart:
      max-file-size: 500MB
      max-request-size: 500MB
```

---

## 4. Upload tài liệu (PDF, PPTX)

```
GV chọn file PDF/PPTX → upload đính kèm bài giảng
    │
    ▼
FE: POST /api/upload/document/{lessonId}
    Body: multipart/form-data { file: <tai-lieu.pdf>, name: "Tài liệu chương 1" }
    │
    ▼
ContentUploadService.uploadDocument(lessonId, filename, bytes, mime)
    │
    ├── Validate: MIME ∈ {application/pdf, application/vnd.ms-powerpoint, ...}
    │             Size ≤ 50MB
    │
    ├── Build path: "{lessonId}/{uuid}-{sanitized_filename}.pdf"
    │       Sanitize: loại bỏ ký tự đặc biệt, giới hạn 100 chars
    │
    ├── SupabaseStorageClient.upload(
    │       bucket = "course-docs",   ← PUBLIC bucket (tài liệu OK để public)
    │       path   = "{lessonId}/{uuid}.pdf"
    │   )
    │   → Trả publicUrl trực tiếp (không cần signed URL)
    │
    ├── INSERT INTO course_documents {
    │       id, lesson_id, name, file_url: publicUrl,
    │       file_type: "pdf", file_size_bytes, position
    │   }
    │
    └── Trả { id, name, fileUrl, fileType }
    │
    ▼
FE: Thêm file vào danh sách tài liệu của bài giảng
    → Hiển thị tên file + icon PDF + nút xóa
```

---

## 5. Nộp khóa học để duyệt

```
GV xem lại khóa học → click "Nộp duyệt"
    │
    ▼
FE: POST /api/teacher/courses/{id}/submit
    │
    ▼
TeacherCourseService.submitForReview(courseId, teacherId)
    │
    ├── Validate state: status ∈ {DRAFT, NEEDS_REVISION}
    │       → ném BusinessException nếu sai
    │
    ├── Validate nội dung tối thiểu:
    │       ≥ 1 chapter
    │       Mỗi chapter ≥ 1 lesson
    │       Thumbnail đã upload
    │
    ├── UPDATE courses SET status = 'pending_review'
    │
    └── Gửi email thông báo đến Admin (danh sách email admin)
            Subject: "[Bee Academy] Khóa học mới chờ duyệt: {title}"
            Body: GV {name} vừa nộp khóa "{title}" để duyệt.
    │
    ▼
FE: Toast "Đã nộp khóa học để duyệt. Chúng tôi sẽ phản hồi trong 2-3 ngày làm việc."
    → Course card hiển thị badge "Chờ duyệt" (màu vàng)
```

---

## 6. Xem trạng thái duyệt và lịch sử

```
GV vào /teacher/courses
    │
    ▼
GET /api/teacher/courses
    → Trả danh sách khóa của GV kèm status + approvalHistory mới nhất
    │
    ▼
Render badge theo status:
    DRAFT          → "Bản nháp"   (xám)
    PENDING_REVIEW → "Chờ duyệt" (vàng)
    APPROVED       → "Đã duyệt"  (xanh)
    REJECTED       → "Bị từ chối" (đỏ)
    NEEDS_REVISION → "Cần sửa"   (cam)
    PUBLISHED      → "Đã xuất bản" (xanh đậm)
    │
    ▼
GV click vào khóa có status NEEDS_REVISION hoặc REJECTED
    → Xem comment của Admin trong timeline lịch sử duyệt
    → GET /api/teacher/courses/{id}/approval-history
    → Trả List<ApprovalHistoryResponse> { action, comment, adminName, createdAt }
    │
    ▼
GV sửa nội dung (status cho phép vì NEEDS_REVISION)
    → Submit lại → PENDING_REVIEW một lần nữa
```

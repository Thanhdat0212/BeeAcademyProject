# Luồng Admin Duyệt Khóa Học — UC36, UC38

Trạng thái: ⏳ Kế hoạch Phase 3 (chưa triển khai)

---

## 1. Admin xem hàng chờ duyệt

```
Admin vào /admin/approvals
    │
    ▼
GET /api/admin/courses/pending
    │
    ▼
AdminApprovalController → ApprovalService.getPendingCourses(pageable)
    └── courseRepository.findAll(
            Specification.where(hasStatus(PENDING_REVIEW)),
            pageable
        )
        ORDER BY created_at ASC  ← FIFO: nộp trước duyệt trước
    │
    ▼
Trả PageResponse<PendingCourseResponse> {
    id, title, teacherName, categoryName,
    totalChapters, totalLessons, submittedAt
}
    │
    ▼
FE render bảng queue với:
    ├── Tên khóa học + GV tạo
    ├── Ngày nộp (bao lâu rồi)
    ├── Số chương / bài giảng
    └── Nút "Xem & Duyệt"
```

---

## 2. Admin xem chi tiết khóa học để duyệt

```
Admin click "Xem & Duyệt" → /admin/approvals/{courseId}
    │
    ▼
GET /api/admin/courses/{courseId}
    → Trả CourseDetailResponse đầy đủ (chapters, lessons, documents)
    → Video: Admin thuộc role "admin" → canSeeAllVideos = true
             → Signed URL được generate cho mọi video → Admin xem preview được
    │
    ▼
FE CourseReviewPage render:
    ├── Thông tin khóa học (title, category, grades, price)
    ├── Curriculum accordion (chapters → lessons)
    ├── Video player cho từng bài (signed URL)
    ├── Tài liệu đính kèm (PDF download links)
    ├── Lịch sử duyệt (nếu đã từng duyệt trước đó)
    └── Panel hành động:
            [Textarea: Nhận xét cho GV]
            [Từ chối]  [Yêu cầu sửa]  [Duyệt]
```

---

## 3. Duyệt khóa học (Approve)

```
Admin điền nhận xét (tùy chọn) → click "Duyệt"
    │
    ▼
FE: POST /api/admin/courses/{courseId}/approve
    Body: { comment: "Nội dung tốt, cho phép xuất bản." }
    │
    ▼
AdminApprovalController → ApprovalService.approve(courseId, adminId, comment)
    │
    ├── Load course, verify status == PENDING_REVIEW
    │
    ├── UPDATE courses SET status = 'published'
    │       (auto-publish: APPROVED → PUBLISHED ngay)
    │
    ├── INSERT course_approval_history {
    │       course_id, admin_id, action: 'approved',
    │       comment, created_at
    │   }
    │
    └── Gửi email thông báo GV:
            To: teacher.email
            Subject: "[Bee Academy] ✅ Khóa học được duyệt: {title}"
            Body: Chúc mừng! Khóa "{title}" đã được Admin duyệt và xuất bản.
                  Học sinh có thể tìm thấy và mua khóa học từ bây giờ.
    │
    ▼
FE: Toast "Đã duyệt khóa học thành công"
    → Course được chuyển ra khỏi queue
    → Redirect về /admin/approvals
```

---

## 4. Từ chối (Reject)

```
Admin điền lý do → click "Từ chối"
    │
    ▼
FE: POST /api/admin/courses/{courseId}/reject
    Body: { comment: "Video chất lượng thấp, âm thanh không rõ. Vui lòng quay lại." }
    │       [Comment bắt buộc khi reject]
    ▼
ApprovalService.reject(courseId, adminId, comment)
    ├── UPDATE courses SET status = 'rejected'
    ├── INSERT course_approval_history { action: 'rejected', comment }
    └── Gửi email GV:
            Subject: "[Bee Academy] ❌ Khóa học chưa được duyệt: {title}"
            Body: Khóa "{title}" chưa được duyệt vì: {comment}
                  Bạn có thể tạo khóa học mới nếu muốn cải thiện.
```

---

## 5. Yêu cầu sửa (Needs Revision)

```
Admin điền hướng dẫn sửa → click "Yêu cầu sửa"
    │
    ▼
FE: POST /api/admin/courses/{courseId}/revise
    Body: { comment: "Cần bổ sung thêm bài tập thực hành cho chương 2." }
    │
    ▼
ApprovalService.requestRevision(courseId, adminId, comment)
    ├── UPDATE courses SET status = 'needs_revision'
    │       [Khác REJECTED: GV vẫn được sửa và submit lại]
    ├── INSERT course_approval_history { action: 'needs_revision', comment }
    └── Gửi email GV:
            Subject: "[Bee Academy] ⚠️ Cần chỉnh sửa khóa học: {title}"
            Body: Yêu cầu sửa đổi: {comment}
                  Vui lòng chỉnh sửa và nộp lại để được duyệt.
    │
    ▼
GV nhận email → vào /teacher/courses/{id}
    → Status: "Cần sửa" (cam)
    → Xem comment của Admin
    → Sửa nội dung (cho phép vì status = NEEDS_REVISION)
    → Click "Nộp lại" → status = PENDING_REVIEW → quay lại queue
```

---

## 6. State machine đầy đủ

```
         submit()              approve()
DRAFT ──────────► PENDING_REVIEW ──────────► PUBLISHED
  ▲                    │                         │
  │              revise()│  reject()              │ archive()
  │                    ▼       ▼                  ▼
  └────── NEEDS_REVISION  REJECTED            ARCHIVED
               │
               └──[submit()]──► PENDING_REVIEW (lại)
```

**Validate server-side:**

| Hành động | Status hiện tại cho phép |
|---|---|
| Sửa nội dung course | DRAFT, NEEDS_REVISION |
| Submit | DRAFT, NEEDS_REVISION |
| Approve | PENDING_REVIEW |
| Reject | PENDING_REVIEW |
| Needs Revision | PENDING_REVIEW |
| Archive | PUBLISHED |
| Delete | DRAFT |

---

## 7. Lịch sử duyệt (Timeline)

```
GET /api/teacher/courses/{id}/approval-history
→ Trả List<ApprovalHistoryResponse> theo thứ tự thời gian

Ví dụ response:
[
  { action: "needs_revision", comment: "Cần thêm bài tập", adminName: "Admin Bee", at: "2026-05-20 10:00" },
  { action: "approved",       comment: "Đã đủ nội dung",   adminName: "Admin Bee", at: "2026-05-22 14:30" }
]
```

FE render dưới dạng timeline dọc với icon màu theo action:
- `approved` → ✅ xanh
- `rejected` → ❌ đỏ
- `needs_revision` → ⚠️ cam

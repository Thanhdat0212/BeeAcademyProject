# Luồng Phụ Huynh — UC23, UC24, UC25, UC47, UC49

Trạng thái: ✅ Backend hoàn chỉnh / ⚠️ Frontend còn skeleton

---

## 1. Kiến trúc phân quyền

Tất cả endpoint `/api/parent/**` đều bị chặn bởi:
```java
@PreAuthorize("hasRole('parent')")
```
→ Chỉ JWT có claim `role = "parent"` mới qua được. Nếu student/teacher gọi → 403.

---

## 2. Xem danh sách con đã liên kết (UC23)

```
Phụ huynh đăng nhập (role=parent) → vào /parent
    │
    ▼
ParentDashboard.tsx mount
    └── useAuthStore.fetchLinkedStudents()
            → parentService.getLinkedChildren()
            → GET /api/parent/children
              Header: Authorization: Bearer {accessToken}
            │
            ▼
        ParentController.getLinkedChildren()
            └── ParentService.getLinkedChildren(me)
                    ├── linkRepository.findByIdParentId(me.userId())
                    │       → SELECT psl.*, s.*
                    │         FROM parent_student_links psl
                    │         JOIN profiles s ON psl.student_id = s.id
                    │         WHERE psl.parent_id = {parentId}
                    └── Map mỗi link → LinkedStudentResponse
                            { id, name, avatarUrl, code: "", grade: "" }
                            [⚠️ grade rỗng — profiles chưa có cột grade]
    │
    ▼
useAuthStore.set({ linkedStudents: mapped })
    → persist vào localStorage (tránh gọi API lại khi reload)
    │
    ▼
ParentDashboard render:
    ├── Dropdown chọn "con" từ linkedStudents
    └── Hiển thị thông tin con đang chọn
```

---

## 3. Xem báo cáo tiến độ của con (UC23)

```
Phụ huynh chọn một con trong dropdown
    │
    ▼
FE: parentService.getChildOverview(studentId)
    → GET /api/parent/children/{studentId}/overview
    │
    ▼
ParentController.getChildOverview(studentId)
    └── ParentService.getChildOverview(me, studentId)
            │
            ├── Kiểm tra quyền: existsByIdParentIdAndIdStudentId(parentId, studentId)
            │       → false → ném BusinessException ACCESS_DENIED (403)
            │       → true  → tiếp tục
            │
            ├── Tải thông tin học sinh: profileRepository.findById(studentId)
            │
            └── Build ChildOverviewResponse:
                    { studentName, grade: "",    ← chưa có
                      avgProgress: 0.0,          ← chờ Module 4 (enrollments)
                      activeCourses: 0,          ← chờ Module 4
                      completedCourses: 0,       ← chờ Module 4
                      latestQuizScore: 0.0,      ← chờ Phase 6 (quiz_attempts)
                      latestExamScore: 0.0,      ← chờ tương lai
                      weeklyActivityHours: [0×7] ← chờ tương lai }
    │
    ▼
FE render biểu đồ + stats (hiện tại toàn bộ = 0)
```

**TODO khi Module hoàn thiện:**
- `avgProgress` ← tính từ bảng `enrollments` (completedLessons / totalLessons)
- `activeCourses` / `completedCourses` ← COUNT từ `enrollments`
- `latestQuizScore` ← MAX(score) từ `quiz_attempts` gần nhất
- `weeklyActivityHours` ← GROUP BY day_of_week từ `quiz_attempts.started_at`

---

## 4. Gỡ liên kết con (UC49)

```
Phụ huynh click "Gỡ liên kết" trên card con
    │
    ▼
FE: useAuthStore.unlinkStudent(studentId)
    → parentService.unlinkStudent(studentId)
    → DELETE /api/parent/children/{studentId}
    │
    ▼
ParentController.unlinkStudent(studentId)
    └── ParentService.unlinkStudent(me, studentId)
            ├── Tìm liên kết: findByIdParentIdAndIdStudentId(parentId, studentId)
            │       → ném LINK_NOT_FOUND (404) nếu không tồn tại
            └── linkRepository.delete(link)
                    → DELETE FROM parent_student_links
                      WHERE parent_id = {parentId} AND student_id = {studentId}
    │
    ▼
FE: filter bỏ studentId khỏi linkedStudents trong Zustand + localStorage
    → Con biến mất khỏi danh sách ngay lập tức (optimistic update)
```

---

## 5. Liên kết con bằng email (UC47) — ⏳ Chưa triển khai

**Thiết kế dự kiến:**

```
Phụ huynh vào /parent/link → nhập email của tài khoản học sinh
    │
    ▼
FE: POST /api/parent/link-request
    Body: { studentEmail }
    │
    ▼
Backend:
    ├── Tìm profile theo email: profileRepository.findUserIdByEmail(studentEmail)
    ├── Kiểm tra role = STUDENT (không cho link tài khoản teacher/admin)
    ├── Gửi email mời đến học sinh với link xác nhận
    │       Link: /account/links?token={inviteToken}
    └── Lưu pending invite vào DB (bảng parent_link_invitations)
    │
    ▼
Học sinh nhận email → click link → vào /account/links
    │
    ▼
FE: POST /api/student/link-accept
    Body: { token }
    │
    ▼
Backend:
    ├── Validate token (chưa hết hạn, đúng studentId)
    ├── ParentStudentLink.createLink(parent, student)
    └── INSERT vào parent_student_links
```

**Bảng cần tạo:**
```sql
CREATE TABLE parent_link_invitations (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id   UUID        NOT NULL REFERENCES profiles(id),
    student_email TEXT      NOT NULL,
    token       TEXT        NOT NULL UNIQUE,
    status      TEXT        NOT NULL DEFAULT 'pending',  -- pending/accepted/rejected/expired
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 6. Xem khóa học của con (UC25) — ⏳ Chưa triển khai

**Thiết kế dự kiến:**
```
GET /api/parent/children/{studentId}/courses
    → Trả danh sách khóa học student đang học (từ enrollments)
    → Kèm tiến độ từng khóa
```

---

## 7. Liên hệ giáo viên (UC24) — ⏳ Chưa triển khai

```
GET /api/parent/children/{studentId}/teachers
    → Danh sách GV của các khóa con đang học

POST /api/messages
    → Gửi tin nhắn đến GV
```

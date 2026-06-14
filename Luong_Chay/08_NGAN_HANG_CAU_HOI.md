# Luồng Ngân Hàng Câu Hỏi — UC29

Trạng thái: ⏳ Kế hoạch Phase 4 (chưa triển khai)

---

## 1. Cấu trúc dữ liệu câu hỏi

```
Question (câu hỏi gốc)
├── teacher_id         → GV tạo ra
├── category_id        → Môn học (Toán, Văn, Anh...)
├── chapter_id         → Chương cụ thể (null = cấp môn học, dùng cho nhiều chương)
├── content            → Đề bài (Markdown, hỗ trợ LaTeX cho công thức)
├── explanation        → Giải thích tại sao đáp án đúng (hiển thị sau khi nộp)
├── difficulty         → 'easy' | 'medium' | 'hard'
├── type               → 'multiple_choice' | 'true_false'
├── tags               → TEXT[] mảng tag tự do ["hằng đẳng thức", "lớp 8"]
├── status             → 'active' | 'inactive'
└── usage_count        → Đã dùng bao nhiêu lần (tăng khi student làm quiz)

QuestionChoice (đáp án lựa chọn) — 1-N với Question
├── question_id
├── content    → Nội dung lựa chọn (A, B, C, D)
├── is_correct → Đáp án đúng hay không
└── position   → Thứ tự hiển thị (1=A, 2=B, 3=C, 4=D)
```

---

## 2. Tạo câu hỏi mới

```
GV vào /teacher/bank/new
    │
    ▼
FE render QuestionFormPage:
    ├── [Select] Môn học → tự load chapters của môn đó
    ├── [Select] Chương (tùy chọn — null = câu hỏi cấp môn)
    ├── [Textarea] Đề bài (Markdown editor, preview realtime)
    ├── [Select] Độ khó: Dễ / Trung bình / Khó
    ├── [Select] Loại câu: Trắc nghiệm 4 đáp án / Đúng-Sai
    ├── [4 Input] Nội dung đáp án A, B, C, D
    ├── [Radio] Chọn đáp án đúng
    ├── [Textarea] Giải thích đáp án (tùy chọn)
    └── [Nút] Lưu câu hỏi
    │
    ▼
FE: POST /api/teacher/questions
    Body: {
        categoryId: "uuid-toan",
        chapterId: "uuid-chuong-1",  // null nếu không chọn chương
        content: "Rút gọn biểu thức $(a+b)^2 - 2ab$",
        explanation: "$(a+b)^2 = a^2 + 2ab + b^2$ nên $(a+b)^2 - 2ab = a^2 + b^2$",
        difficulty: "medium",
        type: "multiple_choice",
        tags: ["hằng đẳng thức"],
        choices: [
            { content: "$a^2 + b^2$",  isCorrect: true,  position: 1 },
            { content: "$a^2 - b^2$",  isCorrect: false, position: 2 },
            { content: "$2ab$",         isCorrect: false, position: 3 },
            { content: "$(a-b)^2$",    isCorrect: false, position: 4 }
        ]
    }
    │
    ▼
QuestionController → QuestionService.createQuestion(teacherId, req)
    ├── Validate: choices.size ∈ [2, 4]
    ├── Validate: đúng 1 choice có isCorrect=true
    ├── Validate: categoryId tồn tại, chapterId (nếu có) thuộc category đúng
    ├── INSERT INTO questions { ... }
    └── INSERT INTO question_choices (4 rows)
    │
    ▼
Trả QuestionResponse { id, content, difficulty, choices, ... }
    → FE toast: "Đã thêm câu hỏi vào ngân hàng"
    → Redirect /teacher/bank
```

---

## 3. Duyệt ngân hàng câu hỏi

```
GV vào /teacher/bank
    │
    ▼
GET /api/teacher/questions?categoryId=...&chapterId=...&difficulty=hard&status=active&page=0
    │
    ▼
QuestionService.listByFilter(teacherId, filter, pageable)
    └── Specification filter:
            ├── teacher_id = {teacherId}          ← chỉ xem câu của mình
            ├── category_id = {categoryId}         ← filter môn (nếu chọn)
            ├── chapter_id = {chapterId}           ← filter chương (nếu chọn)
            ├── difficulty = {difficulty}           ← filter độ khó
            └── status = {status}
    │
    ▼
FE render bảng câu hỏi:
    ┌─────────────────┬──────────┬────────────┬──────────┬────────────┐
    │ Đề bài (preview)│ Môn/Chương│ Độ khó     │ Đã dùng  │ Thao tác  │
    ├─────────────────┼──────────┼────────────┼──────────┼────────────┤
    │ Rút gọn (a+b)²  │ Toán/Chương1 │ Trung bình │ 23 lần  │ Sửa Xóa  │
    │ Tính giá trị... │ Toán/Chương2 │ Khó        │ 5 lần   │ Sửa Xóa  │
    └─────────────────┴──────────┴────────────┴──────────┴────────────┘

Bên phải: Widget thống kê ngân hàng theo chương:
    Chương 1:  [Dễ: 8] [Trung bình: 15] [Khó: 5]  Tổng: 28 câu
    Chương 2:  [Dễ: 3] [Trung bình: 6]  [Khó: 2]  Tổng: 11 câu
```

---

## 4. Thống kê ngân hàng theo chương

```
GV vào /teacher/quiz/:chapterId (trang cấu hình quiz)
    │
    ▼
GET /api/teacher/chapters/{chapterId}/question-stats
    │
    ▼
QuestionService.countByDifficulty(chapterId)
    → SELECT difficulty, COUNT(*) FROM questions
      WHERE chapter_id = {chapterId} AND status = 'active'
      GROUP BY difficulty
    → Trả { easy: 8, medium: 15, hard: 5 }
    │
    ▼
FE hiển thị cảnh báo nếu ngân hàng thiếu câu theo config quiz:
    Config: easy=3, medium=5, hard=2
    Ngân hàng: easy=8✓, medium=15✓, hard=1✗
    → ⚠️ "Chương này thiếu câu Khó (cần 2, hiện có 1)"
```

---

## 5. Sửa / Xóa câu hỏi

```
[Sửa]
    FE: PUT /api/teacher/questions/{id}
        Body: { content, explanation, difficulty, choices }
        │
        ▼
    QuestionService.updateQuestion(id, teacherId, req)
        ├── Verify: question thuộc teacherId
        ├── UPDATE questions SET content=..., difficulty=..., updated_at=NOW()
        └── DELETE + INSERT question_choices (thay thế toàn bộ)

[Xóa (soft delete)]
    FE: DELETE /api/teacher/questions/{id}
        │
        ▼
    QuestionService.deactivate(id, teacherId)
        → UPDATE questions SET status = 'inactive'
        [Không hard delete — giữ lịch sử cho quiz_attempts đã làm]
```

---

## 6. Quy tắc quan trọng

**Không cho phép xóa câu hỏi đã được dùng trong quiz:**

Nếu `usage_count > 0`, chỉ được deactivate (status=inactive), không xóa hoàn toàn.
Lý do: `quiz_attempts.questions_snapshot` lưu JSONB tham chiếu câu hỏi này —
xóa đi sẽ mất khả năng hiển thị lại kết quả cho student.

**Câu hỏi cấp môn vs cấp chương:**

- `chapter_id = null`: câu hỏi tổng quát toàn môn → dùng cho kỳ thi cuối môn
- `chapter_id = {uuid}`: câu hỏi theo chương → dùng cho quiz từng chương

Khi cấu hình quiz của một chương, hệ thống **chỉ lấy câu** có `chapter_id = {chapterId}`.

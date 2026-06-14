# Luồng Quiz & Kiểm Tra — UC29, UC30, UC31

Trạng thái: ⏳ Kế hoạch Phase 5–6 (chưa triển khai)

---

## 1. Giáo viên cấu hình quiz cho chương

```
GV vào /teacher/quiz/{chapterId}
    │
    ▼
FE load:
    ├── GET /api/teacher/chapters/{chapterId}/quiz-config  → config hiện tại (nếu có)
    └── GET /api/teacher/chapters/{chapterId}/question-stats
            → { easy: 8, medium: 15, hard: 5 }
    │
    ▼
FE render form cấu hình:

    Tổng số câu:      [====●=====] 10  (slider 5–30)

    Phân bổ độ khó:
        Câu Dễ:       [ 3 ]   ← Ngân hàng có: 8 câu  ✓
        Câu TB:       [ 5 ]   ← Ngân hàng có: 15 câu ✓
        Câu Khó:      [ 2 ]   ← Ngân hàng có: 5 câu  ✓
        Tổng:         10/10   ✓ (phải bằng Tổng số câu)

    Thời gian:        ○ Không giới hạn  ● Có giới hạn: [30] phút

    Điểm đạt:         [===●======] 6.0 / 10  (slider 5.0–9.0, step 0.5)

    Tùy chọn:         [✓] Trộn thứ tự câu hỏi
                      [✓] Trộn thứ tự đáp án

    Số lần làm lại:   ○ Không giới hạn  ● Tối đa: [3] lần
    │
    ▼
FE: PUT /api/teacher/chapters/{chapterId}/quiz-config
    Body: {
        totalQuestions: 10,
        easyCount: 3, mediumCount: 5, hardCount: 2,
        timeLimitMinutes: 30,
        passingScore: 6.0,
        shuffleQuestions: true,
        shuffleChoices: true,
        maxAttempts: 3
    }
    │
    ▼
QuizService.saveConfig(chapterId, teacherId, req)
    ├── Validate: easyCount + mediumCount + hardCount == totalQuestions
    ├── Warn (không block): nếu ngân hàng thiếu câu theo độ khó
    └── UPSERT quiz_configs (INSERT nếu chưa có, UPDATE nếu đã có — UNIQUE chapter_id)
    │
    ▼
FE: Toast "Đã lưu cấu hình quiz"
```

---

## 2. Học sinh bắt đầu làm quiz

```
Học sinh học xong chương → click "Làm Quiz Chương X"
    │
    ▼ (phải đã login + đã mua khóa học)
    │
FE: POST /api/student/chapters/{chapterId}/quiz/start
    Header: Authorization: Bearer {accessToken}
    │
    ▼
QuizService.startAttempt(studentId, chapterId)
    │
    ├── Bước 1: Kiểm tra enrollment
    │       enrollmentRepository.existsByUserIdAndCourseId(studentId, course.id)
    │       → false → ném 403 FORBIDDEN "Bạn chưa mua khóa học này"
    │
    ├── Bước 2: Load cấu hình quiz
    │       quizConfigRepository.findByChapterId(chapterId)
    │       → null → ném 404 "Chương này chưa có quiz"
    │
    ├── Bước 3: Kiểm tra số lần đã làm
    │       attemptCount = attemptRepository.countByStudentAndConfig(studentId, configId)
    │       if (config.maxAttempts != null && attemptCount >= config.maxAttempts):
    │           → ném 403 "Bạn đã hết lượt làm quiz"
    │
    ├── Bước 4: Lấy câu hỏi từ ngân hàng (RANDOMIZE)
    │       ┌─────────────────────────────────────────────────────────────┐
    │       │  THUẬT TOÁN RANDOM:                                         │
    │       │                                                             │
    │       │  easy_pool = query(chapter_id, difficulty='easy', active)  │
    │       │  Collections.shuffle(easy_pool)                            │
    │       │  selected_easy = easy_pool[0 : min(easyCount, pool.size)] │
    │       │                                                             │
    │       │  medium_pool = query(chapter_id, 'medium', active)        │
    │       │  Collections.shuffle(medium_pool)                          │
    │       │  selected_medium = medium_pool[0 : min(mediumCount, ...)] │
    │       │                                                             │
    │       │  hard_pool = query(chapter_id, 'hard', active)            │
    │       │  Collections.shuffle(hard_pool)                            │
    │       │  selected_hard = hard_pool[0 : min(hardCount, ...)]       │
    │       │                                                             │
    │       │  final_questions = selected_easy + medium + hard           │
    │       │  if (config.shuffleQuestions):                             │
    │       │      Collections.shuffle(final_questions)                  │
    │       │                                                             │
    │       │  if (config.shuffleChoices):                               │
    │       │      Mỗi câu: Collections.shuffle(question.choices)        │
    │       └─────────────────────────────────────────────────────────────┘
    │
    ├── Bước 5: Build JSONB snapshot (LƯU ĐÁP ÁN ĐÚNG vào DB)
    │       {
    │           "q1-uuid": {
    │               "content": "Rút gọn (a+b)²...",
    │               "choices": [
    │                   {"id": "c1", "content": "a²+b²", "isCorrect": true, "position": 1},
    │                   {"id": "c2", "content": "a²-b²", "isCorrect": false, "position": 2},
    │                   ...
    │               ],
    │               "explanation": "Vì (a+b)² = a² + 2ab + b²..."
    │           },
    │           "q2-uuid": { ... }
    │       }
    │       → INSERT INTO quiz_attempts {
    │               student_id, quiz_config_id,
    │               questions_snapshot: {jsonb},
    │               attempt_number: attemptCount + 1,
    │               started_at: NOW()
    │           }
    │
    └── Bước 6: Trả câu hỏi cho FE (ĐÃ ẨN is_correct + explanation)
            {
                attemptId: "uuid",
                timeLimitMinutes: 30,
                questions: [
                    {
                        id: "q1-uuid",
                        content: "Rút gọn (a+b)²...",
                        choices: [
                            { id: "c1", content: "a²+b²",  position: 1 },
                            { id: "c2", content: "a²-b²",  position: 2 },
                            { id: "c3", content: "2ab",     position: 3 },
                            { id: "c4", content: "(a-b)²",  position: 4 }
                        ]
                    },
                    { id: "q2-uuid", ... }
                ]
            }
            [is_correct và explanation KHÔNG có trong response]
```

---

## 3. Học sinh làm bài

```
FE QuizPage.tsx render:
    ├── Đồng hồ đếm ngược: 30:00 → 29:59 → ...
    │       → Auto submit khi hết giờ
    ├── Thanh tiến độ: Câu 1/10, Câu 2/10...
    ├── Nội dung câu hỏi (render Markdown + LaTeX nếu có)
    ├── 4 lựa chọn A B C D dạng radio button
    └── Nút: [Câu trước] [Câu tiếp] [Nộp bài]

State local trong component:
    answers: { "q1-uuid": "c1", "q2-uuid": "c3", ... }
    currentQuestionIndex: 3
    timeRemaining: 1740 (giây)
    hasSubmitted: false
```

---

## 4. Nộp bài và chấm điểm

```
Học sinh click "Nộp bài" (hoặc hết giờ → auto submit)
    │
    ▼ Confirm dialog: "Bạn còn 3 câu chưa trả lời. Nộp bài?"
    │
FE: POST /api/student/quiz/{attemptId}/submit
    Body: {
        answers: {
            "q1-uuid": "c1",   ← choiceId đã chọn
            "q2-uuid": "c3",
            "q3-uuid": null,   ← câu bỏ trống
            ...
        }
    }
    │
    ▼
QuizService.submitAttempt(attemptId, studentId, answers)
    │
    ├── Load quiz_attempt: verify belongsTo studentId, chưa submitted
    │
    ├── Load questions_snapshot từ DB (nguồn sự thật — có đáp án đúng)
    │
    ├── Chấm điểm:
    │       correct = 0
    │       details = []
    │       for each question in snapshot:
    │           studentChoice = answers[question.id]    // null nếu bỏ trống
    │           correctChoice = snapshot.choices.find(c => c.isCorrect).id
    │           isRight = (studentChoice == correctChoice)
    │           if isRight: correct++
    │           details.push({
    │               questionId, studentAnswer: studentChoice,
    │               correctAnswer: correctChoice,
    │               isCorrect: isRight,
    │               explanation: snapshot.explanation
    │           })
    │
    ├── score = (correct / totalQuestions) * 10  → làm tròn 1 chữ số
    │       VD: 7/10 * 10 = 7.0
    │
    ├── passed = (score >= quizConfig.passingScore)
    │       VD: 7.0 >= 6.0 → true
    │
    ├── UPDATE quiz_attempts SET
    │       answers = {jsonb},
    │       score = 7.0, passed = true,
    │       submitted_at = NOW()
    │
    ├── UPDATE questions SET usage_count = usage_count + 1
    │       WHERE id IN (keys of snapshot)   ← batch update
    │
    └── Trả QuizResultResponse {
                score: 7.0, passed: true,
                correct: 7, total: 10,
                attemptNumber: 1,
                details: [
                    { questionId, content, studentAnswer, correctAnswer, isCorrect, explanation },
                    ...
                ]
            }
```

---

## 5. Trang kết quả

```
FE: navigate /quiz/{attemptId}/result
    │
    ▼
QuizResultPage render:
    ┌─────────────────────────────────────┐
    │          7.0 / 10                   │
    │        ✅ ĐẠT (≥ 6.0)              │
    │  Đúng: 7/10  |  Thời gian: 18:42  │
    └─────────────────────────────────────┘

    Từng câu:
    ├── Câu 1 ✅  "Rút gọn (a+b)²..."
    │   Bạn chọn: A. a²+b²  ← Đáp án đúng (xanh)
    │   [▼ Giải thích] Vì (a+b)² = a² + 2ab + b²...
    │
    ├── Câu 2 ❌  "Tính giá trị..."
    │   Bạn chọn: B. 12      ← Sai (đỏ)
    │   Đáp án đúng: C. 18   ← (xanh)
    │   [▼ Giải thích] Áp dụng công thức...
    │
    └── ...

    [Làm lại]  [Về khóa học]
```

---

## 6. Giáo viên xem thống kê quiz

```
GV vào /teacher/grades (trang chấm điểm)
    │
    ▼
GET /api/teacher/chapters/{chapterId}/quiz-stats
    → Trả thống kê tổng hợp:
        {
            totalAttempts: 45,
            avgScore: 6.8,
            passRate: 73%,        ← 33/45 bài đạt
            scoreDistribution: {
                "0-4": 5,
                "4-6": 7,
                "6-8": 20,
                "8-10": 13
            },
            hardestQuestions: [   ← câu hỏi bị sai nhiều nhất
                { questionId, content, correctRate: 32% },
                ...
            ]
        }
    │
    ▼
FE render:
    ├── Biểu đồ phân phối điểm (bar chart)
    ├── Tỷ lệ đạt (doughnut chart)
    └── Danh sách câu hỏi khó → GV cân nhắc sửa nội dung hoặc giải thích kỹ hơn
```

---

## 7. Tóm tắt luồng tổng thể

```
GV tạo câu hỏi (ngân hàng)
        ↓
GV cấu hình quiz cho chương
        ↓
Student mua khóa học
        ↓
Student hoàn thành bài học trong chương
        ↓
Student bắt đầu quiz → system random từ ngân hàng
        ↓
Student làm bài (timer, navigation)
        ↓
Student nộp bài → system chấm điểm
        ↓
Student xem kết quả + giải thích
        ↓
GV xem thống kê tổng hợp
```

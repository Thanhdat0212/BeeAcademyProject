import type { ExamType } from '../../../api/examService';
import type { QuestionMetadata, QuestionType } from '../../../api/questionService';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface ExamQuestion {
  id: string;
  questionVersionId?: string | null;
  text: string;
  type: QuestionType;
  options: string[];
  correctIndices: number[];
  metadata?: QuestionMetadata | null;
  explanation?: string;
  points: number;
  difficulty: Difficulty;  // ← thêm so với Quiz
}

// Cài đặt 1 bài kiểm tra
export interface Exam {
  name: string;
  scopeStartChapterId?: string;
  placementChapterId?: string;
  examType: ExamType;
  description?: string;        // Hướng dẫn / mô tả cho HS đọc trước khi làm
  durationMinutes: number;
  passScorePercent: number;
  objectiveSectionPoints: number;
  essaySectionPoints: number;

  // ── Cài đặt làm bài (đặc thù Exam) ──
  maxAttempts: number;         // Số lần làm tối đa (vd 1, 2)
  shuffleQuestions: boolean;   // Xáo trộn thứ tự câu hỏi cho mỗi HS
  shuffleOptions: boolean;     // Xáo trộn thứ tự lựa chọn A/B/C/D
  showAnswerAfterSubmit: boolean; // Có cho HS xem đáp án sau khi nộp không
  requireFullscreen: boolean;
  blockCopyPaste: boolean;

  questions: ExamQuestion[];
}

// Ref nhẹ đến chương — chỉ cần id/title/order để hiển thị
export interface ChapterRef {
  id: string;
  title: string;
  order: number;
}

// 1 khóa học chứa nhiều chương + map exam theo slot
export interface CourseInfo {
  id: string;
  title: string;
  chapters: ChapterRef[];
  // Dùng Record<slotIndex, Exam> thay vì array để dễ tra theo slot
  // (slot 0 → exams[0], slot 1 → exams[1]...)
  // Slot nào chưa có exam thì key đó không tồn tại.
  exams: Record<number, Exam>;
}

// Slot đã được tính từ chapters — không lưu trong state, derive khi render
export interface ExamSlot {
  slotIndex: number;
  label: string;
  defaultName: string;
  chapters: ChapterRef[];
  scopeStartChapter?: ChapterRef;
  placementChapter?: ChapterRef;
  exam?: Exam;                 // undefined = chưa tạo
}

export interface ChapterRandomConfig {
  multipleChoiceCount: number;
  trueFalseCount: number;
  fillInBlankCount: number;
  essayCount: number;
}

export interface ChapterQuestionCount {
  totalActive: number;
  multipleChoiceCount: number;
  trueFalseCount: number;
  fillInBlankCount: number;
  essayCount: number;
}

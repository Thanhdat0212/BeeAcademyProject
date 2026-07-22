import {
  BarChart2,
  BookOpen,
  ClipboardList,
  Database,
  FileText,
  GraduationCap,
  HelpCircle,
  Landmark,
  LayoutDashboard,
  Lock,
  Megaphone,
  PenSquare,
  Star,
  UserCircle,
} from 'lucide-react';
import type {
  ExamConfigRequest,
  ExamConfigResponse,
  ExamQuestionPayload,
  ExamType,
} from '../../../api/examService';
import type { QuestionType } from '../../../api/questionService';
import type { TeacherCourseDetailResponse } from '../../../api/teacherCourseService';
import type {
  ChapterRandomConfig,
  ChapterRef,
  CourseInfo,
  Exam,
  ExamQuestion,
  ExamSlot,
} from './examTypes';

export function defaultChapterRandomConfig(totalCount = 10): ChapterRandomConfig {
  const essayCount = Math.min(2, totalCount);
  const fillInBlankCount = totalCount >= 4 ? 1 : 0;
  const trueFalseCount = totalCount >= 3 ? Math.min(2, totalCount - essayCount - fillInBlankCount) : 0;
  const multipleChoiceCount = Math.max(0, totalCount - essayCount - fillInBlankCount - trueFalseCount);
  return {
    multipleChoiceCount,
    trueFalseCount,
    fillInBlankCount,
    imageQuestionCount: 0,
    essayCount,
  };
}

export const FIXED_EXAM_TYPES = [
  { slotIndex: 0, label: 'Giữa kỳ 1', defaultName: 'Bài kiểm tra giữa kỳ 1' },
  { slotIndex: 1, label: 'Cuối kỳ 1', defaultName: 'Bài kiểm tra cuối kỳ 1' },
  { slotIndex: 2, label: 'Giữa kỳ 2', defaultName: 'Bài kiểm tra giữa kỳ 2' },
  { slotIndex: 3, label: 'Cuối kỳ 2', defaultName: 'Bài kiểm tra cuối kỳ 2' },
] as const;

export function defaultExamType(slotIndex: number): ExamType {
  return slotIndex === 3 ? 'final_exam' : 'chapter_test';
}

export function resolveExamType(
    chapters: ChapterRef[],
    placementChapterId?: string,
    slotIndex = 0,
): ExamType {
  if (chapters.length === 0) return defaultExamType(slotIndex);
  const placementIndex = findPlacementIndex(chapters, placementChapterId, slotIndex);
  return placementIndex === chapters.length - 1 ? 'final_exam' : 'chapter_test';
}

export function defaultMidtermPlacementIndex(slotIndex: number, chapterCount: number): number {
  if (chapterCount <= 1) return 0;
  return Math.min(defaultPlacementIndex(slotIndex, chapterCount), chapterCount - 2);
}

export function examTypeDisplayLabel(examType: ExamType): string {
  if (examType === 'final_exam') return 'Bài cuối kỳ';
  if (examType === 'chapter_test') return 'Bài giữa kỳ';
  return 'Quiz';
}

export function syncExamTypeWithPlacement(
    exam: Exam,
    chapters: ChapterRef[],
    slotIndex: number,
): Exam {
  const resolvedType = resolveExamType(chapters, exam.placementChapterId, slotIndex);
  return {
    ...exam,
    examType: resolvedType,
  };
}

export function formatPoints(points: number): string {
  if (Number.isInteger(points)) return String(points);
  return points.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

export const OBJECTIVE_EXAM_TYPES: QuestionType[] = [
  'multiple_choice',
  'true_false',
  'image_question',
  'formula_question',
  'audio_question',
];

export const MANUAL_EXAM_TYPES: QuestionType[] = [
  'essay',
  'essay_short',
  'essay_long',
  'file_upload',
];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Trắc nghiệm',
  true_false: 'Đúng / Sai',
  fill_in_blank: 'Điền chỗ trống',
  matching: 'Nối cột',
  essay: 'Tự luận',
  essay_short: 'Tự luận ngắn',
  essay_long: 'Tự luận dài',
  image_question: 'Câu hỏi hình ảnh',
  formula_question: 'Câu hỏi công thức',
  audio_question: 'Câu hỏi audio',
  file_upload: 'Nộp file / ảnh',
};

export function isObjectiveExamType(type: QuestionType) {
  return OBJECTIVE_EXAM_TYPES.includes(type);
}

export function isManualExamType(type: QuestionType) {
  return MANUAL_EXAM_TYPES.includes(type);
}

export function isDirectExamQuestion(question: ExamQuestion) {
  return question.id.startsWith('manual-')
    || question.metadata?.sourceType === 'direct_exam'
    || question.metadata?.createdInExam === true;
}

export function makeLocalQuestionId(prefix: string) {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

export function createDirectExamQuestion(points: number): ExamQuestion {
  return {
    id: makeLocalQuestionId('manual'),
    questionVersionId: null,
    text: '',
    type: 'multiple_choice',
    options: ['', '', '', ''],
    correctIndices: [0],
    metadata: {
      sourceType: 'direct_exam',
      createdInExam: true,
    },
    explanation: '',
    points,
    difficulty: 'medium',
  };
}

export function countExamQuestionsByType(questions: ExamQuestion[]) {
  return {
    multipleChoice: questions.filter(q => q.type === 'multiple_choice').length,
    trueFalse: questions.filter(q => q.type === 'true_false').length,
    fillInBlank: questions.filter(q => q.type === 'fill_in_blank').length,
    imageQuestion: questions.filter(q => q.type === 'image_question').length,
    essay: questions.filter(q => isManualExamType(q.type)).length,
  };
}

export function chapterObjectiveCount(config: ChapterRandomConfig) {
  return config.multipleChoiceCount + config.trueFalseCount + config.fillInBlankCount
    + config.imageQuestionCount;
}

export function chapterTotalCount(config: ChapterRandomConfig) {
  return chapterObjectiveCount(config) + config.essayCount;
}

export function questionTypeLabel(type: QuestionType, correctCount = 0) {
  if (type === 'multiple_choice') {
    return correctCount > 1 ? 'Trắc nghiệm nhiều đáp án' : 'Trắc nghiệm 1 đáp án';
  }
  return QUESTION_TYPE_LABELS[type];
}

export function questionSelectionLabel(question: ExamQuestion, index: number) {
  const preview = question.text.trim() || 'Chưa có nội dung';
  return `Câu ${index + 1} - ${preview}`;
}

export function orderExamQuestionsObjectiveFirst(questions: ExamQuestion[]): ExamQuestion[] {
  return [
    ...questions.filter(question => !isManualExamType(question.type)),
    ...questions.filter(question => isManualExamType(question.type)),
  ];
}

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 2 — NAV_ITEMS (đồng bộ sidebar teacher)
// ═══════════════════════════════════════════════════════════════════
export const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Tổng quan',         path: '/teacher',          },
  { icon: BookOpen,        label: 'Khóa học của tôi',  path: '/teacher/courses',  },
  { icon: Star,            label: 'Đánh giá khóa học', path: '/teacher/reviews',  },
  { icon: FileText,        label: 'Bài giảng',          path: '/teacher/content',  },
  { icon: PenSquare,       label: 'Quiz chương',        path: '/teacher/quiz',     },
  { icon: Database,        label: 'Ngân hàng câu hỏi',  path: '/teacher/questions',},
  { icon: GraduationCap,   label: 'Bài kiểm tra',       path: '/teacher/exam',     },
  { icon: ClipboardList,   label: 'Chấm điểm',          path: '/teacher/grades',   },
  { icon: HelpCircle,      label: 'Hỏi & Đáp',          path: '/teacher/qa',       },
  { icon: Megaphone,       label: 'Khiếu nại',          path: '/teacher/complaints',},
  { icon: BarChart2,       label: 'Doanh thu',          path: '/teacher/revenue',  },
  { icon: Landmark,        label: 'TK ngân hàng',       path: '/teacher/bank',     },
  { icon: UserCircle,      label: 'Hồ sơ',              path: '/teacher/profile',  },
  { icon: Lock,            label: 'Tài khoản',           path: '/teacher/account',  },
];

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 3 — HELPER: 4 mốc kiểm tra cố định do giáo viên đặt vị trí
// ═══════════════════════════════════════════════════════════════════
export function computeSlots(chapters: ChapterRef[], exams: Record<number, Exam>): ExamSlot[] {
  if (chapters.length === 0) return [];
  return FIXED_EXAM_TYPES.map(type => {
    const exam = exams[type.slotIndex];
    const placementChapter = getPlacementChapter(chapters, exam, type.slotIndex);
    const scopeStartChapter = getScopeStartChapter(chapters, exams, exam, type.slotIndex, placementChapter?.id);
    return {
      slotIndex: type.slotIndex,
      label: type.label,
      defaultName: type.defaultName,
      scopeStartChapter,
      placementChapter,
      chapters: chaptersForExamSlot(
        chapters,
        exams,
        type.slotIndex,
        scopeStartChapter?.id,
        placementChapter?.id,
      ),
      exam,
    };
  });
}

export function getPlacementChapter(
    chapters: ChapterRef[],
    exam: Exam | undefined,
    slotIndex: number,
): ChapterRef | undefined {
  const bySavedPlacement = exam?.placementChapterId
      ? chapters.find(chapter => chapter.id === exam.placementChapterId)
      : undefined;
  return bySavedPlacement ?? chapters[defaultPlacementIndex(slotIndex, chapters.length)];
}

export function getScopeStartChapter(
    chapters: ChapterRef[],
    exams: Record<number, Exam>,
    exam: Exam | undefined,
    slotIndex: number,
    placementChapterId?: string,
): ChapterRef | undefined {
  const bySavedStart = exam?.scopeStartChapterId
      ? chapters.find(chapter => chapter.id === exam.scopeStartChapterId)
      : undefined;
  if (bySavedStart) return bySavedStart;

  const currentIndex = findPlacementIndex(chapters, placementChapterId, slotIndex);
  const previousIndex = FIXED_EXAM_TYPES
    .filter(type => type.slotIndex < slotIndex)
    .map(type => findPlacementIndex(chapters, exams[type.slotIndex]?.placementChapterId, type.slotIndex))
    .filter(index => index >= 0 && index < currentIndex)
    .reduce((max, index) => Math.max(max, index), -1);
  return chapters[Math.max(0, Math.min(currentIndex, previousIndex + 1))];
}

export function chaptersForExamSlot(
    chapters: ChapterRef[],
    exams: Record<number, Exam>,
    slotIndex: number,
    scopeStartChapterId?: string,
    placementChapterId?: string,
): ChapterRef[] {
  if (chapters.length === 0) return [];
  const currentIndex = findPlacementIndex(chapters, placementChapterId, slotIndex);
  const savedStartIndex = scopeStartChapterId
    ? chapters.findIndex(chapter => chapter.id === scopeStartChapterId)
    : -1;
  const fallbackStart = getScopeStartChapter(
    chapters,
    exams,
    exams[slotIndex],
    slotIndex,
    placementChapterId,
  );
  const fromIndex = savedStartIndex >= 0 && savedStartIndex <= currentIndex
    ? savedStartIndex
    : findPlacementIndex(chapters, fallbackStart?.id, slotIndex);
  return chapters.slice(fromIndex, currentIndex + 1);
}

export function findPlacementIndex(
    chapters: ChapterRef[],
    placementChapterId: string | undefined,
    slotIndex: number,
): number {
  const savedIndex = placementChapterId
      ? chapters.findIndex(chapter => chapter.id === placementChapterId)
      : -1;
  return savedIndex >= 0 ? savedIndex : defaultPlacementIndex(slotIndex, chapters.length);
}

export function defaultPlacementIndex(slotIndex: number, chapterCount: number): number {
  if (chapterCount <= 0) return -1;
  const index = slotIndex === 0
      ? Math.ceil(chapterCount * 0.25) - 1
      : slotIndex === 1
      ? Math.ceil(chapterCount * 0.50) - 1
      : slotIndex === 2
      ? Math.ceil(chapterCount * 0.75) - 1
      : chapterCount - 1;
  return Math.max(0, Math.min(chapterCount - 1, index));
}

export function examFromResponse(response: ExamConfigResponse): Exam {
  const questions = response.questions.map(questionFromPayload);
  const objectiveSectionPoints = questions
    .filter(question => !isManualExamType(question.type))
    .reduce((sum, question) => sum + question.points, 0);
  const essaySectionPoints = questions
    .filter(question => isManualExamType(question.type))
    .reduce((sum, question) => sum + question.points, 0);
  return redistributeQuestionPoints({
    name: response.name,
    scopeStartChapterId: response.scopeStartChapterId,
    placementChapterId: response.placementChapterId,
    examType: response.examType ?? defaultExamType(response.slotIndex),
    description: response.description ?? '',
    durationMinutes: response.durationMinutes,
    passScorePercent: response.passScorePercent,
    objectiveSectionPoints: objectiveSectionPoints > 0 ? objectiveSectionPoints : 6,
    essaySectionPoints: essaySectionPoints > 0 ? essaySectionPoints : 4,
    maxAttempts: response.maxAttempts,
    shuffleQuestions: response.shuffleQuestions,
    shuffleOptions: response.shuffleOptions,
    showAnswerAfterSubmit: response.showAnswerAfterSubmit,
    requireFullscreen: response.requireFullscreen ?? false,
    blockCopyPaste: response.blockCopyPaste ?? false,
    questions: orderExamQuestionsObjectiveFirst(questions),
  });
}

export function questionFromPayload(payload: ExamQuestionPayload): ExamQuestion {
  return {
    id: payload.id,
    questionVersionId: payload.questionVersionId ?? null,
    text: payload.text,
    type: payload.type,
    options: [...(payload.options ?? [])],
    correctIndices: [...(payload.correctIndices ?? [])],
    metadata: payload.metadata ?? null,
    explanation: payload.explanation ?? '',
    points: payload.points,
    difficulty: payload.difficulty,
  };
}

export function redistributeQuestionPoints(exam: Exam): Exam {
  const objectiveCount = exam.questions.filter(question => !isManualExamType(question.type)).length;
  const essayCount = exam.questions.filter(question => isManualExamType(question.type)).length;
  const objectivePoint = objectiveCount > 0 ? exam.objectiveSectionPoints / objectiveCount : 0;
  const essayPoint = essayCount > 0 ? exam.essaySectionPoints / essayCount : 0;

  return {
    ...exam,
    questions: exam.questions.map(question => ({
      ...question,
      points: isManualExamType(question.type) ? essayPoint : objectivePoint,
    })),
  };
}

export function examToRequest(exam: Exam, confirmUnderTenQuestions = false): ExamConfigRequest {
  return {
    name: exam.name.trim(),
    scopeStartChapterId: exam.scopeStartChapterId ?? '',
    placementChapterId: exam.placementChapterId ?? '',
    examType: exam.examType,
    description: exam.description?.trim() || null,
    durationMinutes: exam.durationMinutes,
    passScorePercent: exam.passScorePercent,
    maxAttempts: exam.maxAttempts,
    shuffleQuestions: exam.shuffleQuestions,
    shuffleOptions: exam.shuffleOptions,
    showAnswerAfterSubmit: exam.showAnswerAfterSubmit,
    requireFullscreen: exam.requireFullscreen,
    blockCopyPaste: exam.blockCopyPaste,
    confirmUnderTenQuestions,
    questions: orderExamQuestionsObjectiveFirst(exam.questions).map(q => ({
      id: q.id,
      questionVersionId: q.questionVersionId ?? null,
      text: q.text.trim(),
      type: q.type,
      options: isObjectiveExamType(q.type) ? q.options.map(opt => opt.trim()) : [],
      correctIndices: isObjectiveExamType(q.type) ? q.correctIndices : [],
      metadata: q.metadata ?? null,
      explanation: q.explanation?.trim() || null,
      points: q.points,
      difficulty: q.difficulty,
    })),
  };
}

export function courseInfoFromDetail(
    detail: TeacherCourseDetailResponse,
    exams: ExamConfigResponse[],
): CourseInfo {
  return {
    id: detail.id,
    title: detail.title,
    chapters: detail.chapters
      .map(chapter => ({
        id: chapter.id,
        title: chapter.title,
        order: chapter.position,
      }))
      .sort((a, b) => a.order - b.order),
    exams: exams.reduce<Record<number, Exam>>((acc, exam) => {
      acc[exam.slotIndex] = examFromResponse(exam);
      return acc;
    }, {}),
  };
}

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 4 — SUB-COMPONENT: ExamQuestionCard
// ═══════════════════════════════════════════════════════════════════
/**
 * ExamQuestionCard — Card chứa 1 câu hỏi của bài kiểm tra.
 * Khác QuestionCard của Quiz: có thêm trường "Mức độ khó".
 * Tách thành component vì lặp lại N lần và có state gập/mở riêng.
 *
 * Props:
 *   - question: dữ liệu câu hỏi exam
 *   - index: thứ tự câu trong list (để label "Câu 1", "Câu 2"...)
 *   - onChange: callback khi user sửa bất kỳ field nào
 *   - onDelete: callback khi xóa câu hỏi
 */

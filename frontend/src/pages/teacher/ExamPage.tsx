import TeacherNotificationBell from '../../components/TeacherNotificationBell';
/**
 * TeacherExamPage — Trang "Bài kiểm tra" cho Giáo viên (UC30)
 *
 * Khác biệt cốt lõi so với Quiz chương (UC29):
 *   - Quiz:    gắn vào CUỐI MỖI CHƯƠNG       → mục đích củng cố
 *   - Exam:    giáo viên chọn vị trí sau chương → mục đích đánh giá học kỳ
 *   - Học sinh: chỉ mở exam khi pass quiz trong phạm vi chương của bài kiểm tra
 *
 * Cấu trúc "slot":
 *   - Hệ thống có 4 slot cố định: giữa kỳ 1, cuối kỳ 1, giữa kỳ 2, cuối kỳ 2.
 *   - Mỗi slot có DUY NHẤT 1 exam. GV chọn vị trí chương cho từng slot.
 *
 * Luồng chính:
 *   1. GV chọn khóa học
 *   2. Bên trái: danh sách 4 bài kiểm tra cố định
 *   3. Click slot → form mở ở panel phải:
 *      - Slot đã có exam → load vào form
 *      - Slot chưa có → khởi tạo form rỗng
 *   4. Form 3 phần:
 *      a) Cài đặt chung: tên, mô tả, thời gian, điểm đạt
 *      b) Cài đặt làm bài: lần làm lại, xáo trộn, hiện đáp án
 *      c) Danh sách câu hỏi (có thêm trường "Mức độ khó")
 *   5. "Lưu bài kiểm tra" → commit; "Hủy" → đóng form không lưu
 */

import {
  AlertTriangle,
  Eye,
  GraduationCap,
  Loader2,
  Lock,
  LogOut, Menu,
  Plus,
  Repeat,
  Save,
  Shuffle,
  Trash2,
  X
} from 'lucide-react';
import { motion } from 'motion/react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type {
  ExamDifficulty,
  ExamType
} from '../../api/examService';
import * as examService from '../../api/examService';
import type { QuestionMetadata } from '../../api/questionService';
import * as questionService from '../../api/questionService';
import { notify } from '../../lib/toast';
import { useAuthStore } from '../../store/useAuthStore';
import type {
  ChapterQuestionCount,
  ChapterRandomConfig,
  ExamQuestion,
  ExamSlot
} from './exam/examTypes';
import {
  chapterObjectiveCount,
  chaptersForExamSlot,
  chapterTotalCount,
  computeSlots,
  countExamQuestionsByType,
  createDirectExamQuestion,
  defaultChapterRandomConfig,
  defaultExamType,
  defaultMidtermPlacementIndex,
  examFromResponse,
  examToRequest,
  examTypeDisplayLabel,
  formatPoints,
  isManualExamType,
  isObjectiveExamType,
  NAV_ITEMS,
  orderExamQuestionsObjectiveFirst,
  questionFromPayload,
  questionSelectionLabel,
  questionTypeLabel,
  redistributeQuestionPoints,
  resolveExamType,
  syncExamTypeWithPlacement
} from './exam/examUtils';
import { useTeacherExamCourses } from './exam/hooks/useTeacherExamCourses';
import BrandLogo from '../../components/BrandLogo';

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 1 — TYPES
// ═══════════════════════════════════════════════════════════════════

// Mức độ khó của câu hỏi — đặc thù của Exam
// Lý do thêm: bài kiểm tra cần phân bố câu Dễ/TB/Khó hợp lý
// để đánh giá đúng năng lực HS, không phải tất cả cùng mức.
const ExamQuestionCard = lazy(() => import('./exam/ExamQuestionCard'));

export default function TeacherExamPage() {
  // ── State chính ─────────────────────────────────────────────────
  // data: nguồn sự thật về khóa/chương/exam đã commit
  const {
    data,
    setData,
    selectedCourseId,
    setSelectedCourseId,
    selectedSlotIndex,
    setSelectedSlotIndex,
    form,
    setForm,
    loading,
  } = useTeacherExamCourses();
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [randomizing, setRandomizing] = useState(false);
  const [chapterRandomConfigs, setChapterRandomConfigs] =
    useState<Record<string, ChapterRandomConfig>>({});
  const [chapterStats, setChapterStats] =
    useState<Record<string, ChapterQuestionCount>>({});
  const [loadingChapterStats, setLoadingChapterStats] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiQuestionType, setAiQuestionType] =
    useState<'multiple_choice' | 'true_false' | 'fill_in_blank' | 'essay'>('multiple_choice');
  const [aiDifficulty, setAiDifficulty] = useState<ExamDifficulty>('medium');
  const [aiQuestionCount, setAiQuestionCount] = useState(5);

  // Sidebar mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);


  // ── Derived ─────────────────────────────────────────────────────
  const currentCourse = data.find(c => c.id === selectedCourseId);
  // Tính lại slots mỗi lần render — rẻ vì chỉ là chia mảng
  const slots = currentCourse ? computeSlots(currentCourse.chapters, currentCourse.exams) : [];
  const currentSlot = slots.find(s => s.slotIndex === selectedSlotIndex);
  const resolvedFormExamType = form && currentCourse && currentSlot
    ? resolveExamType(currentCourse.chapters, form.placementChapterId, currentSlot.slotIndex)
    : form?.examType ?? 'chapter_test';

  // Tổng điểm — hiển thị để GV biết bài kiểm tra đáng bao nhiêu
  const totalPoints = form?.questions.reduce((sum, q) => sum + q.points, 0) ?? 0;
  const formQuestionCounts = countExamQuestionsByType(form?.questions ?? []);
  const formMultipleChoiceCount = formQuestionCounts.multipleChoice;
  const formTrueFalseCount = formQuestionCounts.trueFalse;
  const formFillInBlankCount = formQuestionCounts.fillInBlank;
  const formImageQuestionCount = formQuestionCounts.imageQuestion;
  const formEssayCount = formQuestionCounts.essay;
  const formObjectiveCount = formMultipleChoiceCount + formTrueFalseCount + formFillInBlankCount
    + formImageQuestionCount;
  const pointBalanceValid = Math.abs(totalPoints - 10) <= 0.001;
  const selectedScopeChapters = currentCourse && currentSlot
    ? chaptersForExamSlot(
      currentCourse.chapters,
      currentCourse.exams,
      currentSlot.slotIndex,
      form?.scopeStartChapterId ?? currentSlot.scopeStartChapter?.id,
      form?.placementChapterId ?? currentSlot.placementChapter?.id,
    )
    : [];
  const scopeStartChapter = selectedScopeChapters[0];
  const scopeEndChapter = selectedScopeChapters[selectedScopeChapters.length - 1];
  const selectedQuestion = form?.questions[selectedQuestionIndex] ?? null;
  const activeChapterConfigs = selectedScopeChapters.map(chapter => ({
    chapter,
    config: chapterRandomConfigs[chapter.id] ?? defaultChapterRandomConfig(),
    stats: chapterStats[chapter.id],
  }));
  const multipleChoiceRandomTotal = activeChapterConfigs.reduce((sum, item) =>
    sum + item.config.multipleChoiceCount, 0);
  const trueFalseRandomTotal = activeChapterConfigs.reduce((sum, item) =>
    sum + item.config.trueFalseCount, 0);
  const fillInBlankRandomTotal = activeChapterConfigs.reduce((sum, item) =>
    sum + item.config.fillInBlankCount, 0);
  const imageQuestionRandomTotal = activeChapterConfigs.reduce((sum, item) =>
    sum + item.config.imageQuestionCount, 0);
  const objectiveRandomTotal = activeChapterConfigs.reduce((sum, item) =>
    sum + chapterObjectiveCount(item.config), 0);
  const essayRandomTotal = activeChapterConfigs.reduce((sum, item) =>
    sum + item.config.essayCount, 0);
  const chapterRandomTotal = objectiveRandomTotal + essayRandomTotal;
  const objectivePointPerQuestion = objectiveRandomTotal > 0 && form
    ? form.objectiveSectionPoints / objectiveRandomTotal
    : 0;
  const essayPointPerQuestion = essayRandomTotal > 0 && form
    ? form.essaySectionPoints / essayRandomTotal
    : 0;
  const randomSectionPointsTotal = form
    ? form.objectiveSectionPoints + form.essaySectionPoints
    : 0;
  const randomSplitValid =
    objectiveRandomTotal > 0
    && essayRandomTotal > 0
    && Math.abs(randomSectionPointsTotal - 10) <= 0.001;
  const chapterRandomWarnings = activeChapterConfigs.flatMap(item => {
    if (!item.stats) return [];
    const warnings: Array<{ key: string; chapterTitle: string; typeLabel: string; need: number; have: number }> = [];
    if (item.config.multipleChoiceCount > item.stats.multipleChoiceCount) {
      warnings.push({
        key: `${item.chapter.id}-multiple_choice`,
        chapterTitle: item.chapter.title,
        typeLabel: 'trắc nghiệm',
        need: item.config.multipleChoiceCount,
        have: item.stats.multipleChoiceCount,
      });
    }
    if (item.config.trueFalseCount > item.stats.trueFalseCount) {
      warnings.push({
        key: `${item.chapter.id}-true_false`,
        chapterTitle: item.chapter.title,
        typeLabel: 'đúng/sai',
        need: item.config.trueFalseCount,
        have: item.stats.trueFalseCount,
      });
    }
    if (item.config.fillInBlankCount > item.stats.fillInBlankCount) {
      warnings.push({
        key: `${item.chapter.id}-fill_in_blank`,
        chapterTitle: item.chapter.title,
        typeLabel: 'điền chỗ trống',
        need: item.config.fillInBlankCount,
        have: item.stats.fillInBlankCount,
      });
    }
    if (item.config.imageQuestionCount > item.stats.imageQuestionCount) {
      warnings.push({
        key: `${item.chapter.id}-image_question`,
        chapterTitle: item.chapter.title,
        typeLabel: 'câu hỏi hình ảnh',
        need: item.config.imageQuestionCount,
        have: item.stats.imageQuestionCount,
      });
    }
    if (item.config.essayCount > item.stats.essayCount) {
      warnings.push({
        key: `${item.chapter.id}-essay`,
        chapterTitle: item.chapter.title,
        typeLabel: 'tự luận',
        need: item.config.essayCount,
        have: item.stats.essayCount,
      });
    }
    return warnings;
  });

  useEffect(() => {
    if (!form || form.questions.length === 0) {
      setSelectedQuestionIndex(0);
      return;
    }
    setSelectedQuestionIndex(prev => Math.min(prev, form.questions.length - 1));
  }, [form?.questions.length]);

  useEffect(() => {
    if (!form || form.questions.length === 0) return;
    const redistributed = redistributeQuestionPoints(form);
    const hasPointMismatch = form.questions.some((question, index) =>
      Math.abs(question.points - redistributed.questions[index].points) > 0.001);
    if (hasPointMismatch) {
      setForm(redistributed);
    }
  }, [
    form?.questions.length,
    form?.objectiveSectionPoints,
    form?.essaySectionPoints,
    formObjectiveCount,
    formEssayCount,
  ]);

  useEffect(() => {
    if (!currentSlot || selectedScopeChapters.length === 0) {
      setChapterStats({});
      return;
    }

    let cancelled = false;
    setLoadingChapterStats(true);
    Promise.all(
      selectedScopeChapters.map(async chapter => {
        const stats = await questionService.getExamSupportedQuestionStats(chapter.id);
        return [chapter.id, {
          totalActive: stats.totalActive,
          multipleChoiceCount: stats.multipleChoiceCount,
          trueFalseCount: stats.trueFalseCount,
          fillInBlankCount: stats.fillInBlankCount,
          imageQuestionCount: stats.imageQuestionCount,
          essayCount: stats.essayCount,
        }] as const;
      }),
    )
      .then(entries => {
        if (!cancelled) {
          setChapterStats(Object.fromEntries(entries));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setChapterStats({});
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingChapterStats(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCourseId, selectedSlotIndex, form?.scopeStartChapterId, form?.placementChapterId]);

  // ── Handler: chọn slot để bắt đầu edit exam ──────────────────────
  function selectSlot(slot: ExamSlot) {
    setSelectedSlotIndex(slot.slotIndex);
    setSelectedQuestionIndex(0);
    setChapterRandomConfigs(prev => {
      const next = { ...prev };
      slot.chapters.forEach(chapter => {
        if (!next[chapter.id]) {
          next[chapter.id] = defaultChapterRandomConfig();
        }
      });
      return next;
    });
    // Slot đã có exam → copy vào form để edit
    // Chưa có → khởi tạo exam rỗng với default hợp lý cho bài kiểm tra
    if (slot.exam) {
      setForm(syncExamTypeWithPlacement({
        ...slot.exam,
        maxAttempts: 3,
        requireFullscreen: true,
        blockCopyPaste: true,
        scopeStartChapterId: slot.exam.scopeStartChapterId ?? slot.scopeStartChapter?.id,
        placementChapterId: slot.exam.placementChapterId ?? slot.placementChapter?.id,
        examType: slot.exam.examType ?? defaultExamType(slot.slotIndex),
        questions: orderExamQuestionsObjectiveFirst(slot.exam.questions).map(q => ({ ...q })), // deep copy questions
      }, currentCourse?.chapters ?? slot.chapters, slot.slotIndex));
    } else {
      setForm(syncExamTypeWithPlacement({
        name: slot.defaultName,
        scopeStartChapterId: slot.scopeStartChapter?.id,
        placementChapterId: slot.placementChapter?.id,
        examType: defaultExamType(slot.slotIndex),
        description: '',
        durationMinutes: 45,    // Exam thường dài hơn quiz (45 vs 15)
        passScorePercent: 60,   // Exam thường khó hơn → ngưỡng pass thấp hơn
        objectiveSectionPoints: 6,
        essaySectionPoints: 4,
        maxAttempts: 3,         // 1 lượt chính + tối đa 2 lượt thi lại theo SRS
        shuffleQuestions: true, // Default ON — chống gian lận
        shuffleOptions: true,   // Default ON — chống gian lận
        showAnswerAfterSubmit: false, // Default OFF — không lộ đề cho khóa sau
        requireFullscreen: true,
        blockCopyPaste: true,
        questions: [],
      }, currentCourse?.chapters ?? slot.chapters, slot.slotIndex));
    }
  }

  // ── Handler: đổi khóa học ────────────────────────────────────────
  function changeCourse(courseId: string) {
    setSelectedCourseId(courseId);
    setSelectedSlotIndex(null);
    setSelectedQuestionIndex(0);
    setForm(null);
  }

  // ── Handler: thêm 1 câu hỏi mới vào form ─────────────────────────
  // Default difficulty = 'medium' vì là mức cân bằng nhất
  function addQuestion() {
    if (!form) return;
    const newQuestion = createDirectExamQuestion(1);
    const orderedQuestions = orderExamQuestionsObjectiveFirst([...form.questions, newQuestion]);
    setForm(redistributeQuestionPoints({
      ...form,
      questions: orderedQuestions,
    }));
    setSelectedQuestionIndex(Math.max(0, orderedQuestions.findIndex(q => q.id === newQuestion.id)));
  }

  // ── Handler: cập nhật 1 câu hỏi ─────────────────────────────────
  function updateQuestion(idx: number, updated: ExamQuestion) {
    if (!form) return;
    setForm({
      ...form,
      questions: orderExamQuestionsObjectiveFirst(
        form.questions.map((q, i) => i === idx ? updated : q),
      ),
    });
  }

  // ── Handler: xóa 1 câu hỏi ──────────────────────────────────────
  function deleteQuestion(idx: number) {
    if (!form) return;
    const nextQuestions = form.questions.filter((_, i) => i !== idx);
    setForm(redistributeQuestionPoints({ ...form, questions: nextQuestions }));
    setSelectedQuestionIndex(prev => {
      if (nextQuestions.length === 0) return 0;
      if (prev > idx) return prev - 1;
      return Math.min(prev, nextQuestions.length - 1);
    });
  }

  async function reviewAiQuestion(idx: number, action: 'APPROVED_AI_QUESTION' | 'REJECTED_AI_QUESTION') {
    if (!form || !selectedCourseId) return;
    const question = form.questions[idx];
    const promptId = question?.metadata?.aiPromptId;
    if (!question || !promptId) return;

    const nextStatus = action === 'APPROVED_AI_QUESTION' ? 'approved' : 'rejected';
    const updated: ExamQuestion = {
      ...question,
      metadata: {
        ...(question.metadata ?? {}),
        aiStatus: nextStatus,
        rejectionReason: action === 'REJECTED_AI_QUESTION'
          ? (question.metadata?.rejectionReason || 'Teacher rejected this AI draft.')
          : undefined,
      },
    };
    setForm({
      ...form,
      questions: form.questions.map((item, itemIndex) => itemIndex === idx ? updated : item),
    });

    try {
      await examService.recordCourseExamAiReview(selectedCourseId, {
        promptId,
        action,
        questionText: question.text,
        sourceRefs: question.metadata?.sourceRefs ?? [],
      });
      notify.success(action === 'APPROVED_AI_QUESTION' ? 'Đã approve câu AI' : 'Đã reject câu AI');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không ghi được audit review AI');
    }
  }

  function updateChapterRandomConfig(
      chapterId: string,
      key: keyof ChapterRandomConfig,
      value: number,
  ) {
    setChapterRandomConfigs(prev => {
      const current = prev[chapterId] ?? defaultChapterRandomConfig();
      const safeValue = Math.max(0, value);
      const nextConfig = { ...current, [key]: safeValue };
      return {
        ...prev,
        [chapterId]: nextConfig,
      };
    });
  }

  async function randomizeQuestionsFromBank() {
    if (!form || !selectedCourseId || !currentSlot || randomizing) return;
    if (chapterRandomTotal <= 0) {
      notify.error('Cần chọn ít nhất 1 câu hỏi để random');
      return;
    }
    if (objectiveRandomTotal <= 0 || essayRandomTotal <= 0) {
      notify.error('Bài kiểm tra phải có cả phần tự động chấm và phần cần giáo viên chấm');
      return;
    }
    if (!randomSplitValid) {
      notify.error('Điểm phần tự động chấm và phần chấm tay phải cộng lại đúng 10 điểm');
      return;
    }
    if (chapterRandomWarnings.length > 0) {
      notify.error('Ngân hàng câu hỏi chưa đủ theo phân bổ đã chọn');
      return;
    }

    setRandomizing(true);
    try {
      const questions = await examService.randomizeCourseExamQuestions(
        selectedCourseId,
        {
          easyCount: 0,
          mediumCount: 0,
          hardCount: 0,
          pointsPerQuestion: 10 / chapterRandomTotal,
          objectivePoints: form.objectiveSectionPoints,
          essayPoints: form.essaySectionPoints,
          chapterConfigs: activeChapterConfigs.map(item => ({
            chapterId: item.chapter.id,
            totalCount: chapterTotalCount(item.config),
            objectiveCount: chapterObjectiveCount(item.config),
            essayCount: item.config.essayCount,
            multipleChoiceCount: item.config.multipleChoiceCount,
            trueFalseCount: item.config.trueFalseCount,
            fillInBlankCount: item.config.fillInBlankCount,
            imageQuestionCount: item.config.imageQuestionCount,
          })),
        },
      );
      const randomizedCounts = countExamQuestionsByType(questions.map(questionFromPayload));
      if (
        randomizedCounts.multipleChoice !== multipleChoiceRandomTotal
        || randomizedCounts.trueFalse !== trueFalseRandomTotal
        || randomizedCounts.fillInBlank !== fillInBlankRandomTotal
        || randomizedCounts.imageQuestion !== imageQuestionRandomTotal
        || randomizedCounts.essay !== essayRandomTotal
      ) {
        notify.error(
          `Kết quả random không khớp cấu hình: cần ${essayRandomTotal} câu tự luận nhưng nhận ${randomizedCounts.essay}.`,
        );
        return;
      }
      setForm(redistributeQuestionPoints({
        ...form,
        questions: orderExamQuestionsObjectiveFirst(questions.map(questionFromPayload)),
      }));
      setSelectedQuestionIndex(0);
      notify.success(`Đã random ${questions.length} câu từ ngân hàng câu hỏi`);
    } catch (error) {
      notify.error(error instanceof Error
        ? error.message
        : 'Không random được câu hỏi từ ngân hàng');
    } finally {
      setRandomizing(false);
    }
  }

  async function generateAiDraftQuestions() {
    if (!form || !selectedCourseId || !currentSlot || aiGenerating) return;
    if (!aiPrompt.trim()) {
      notify.error('Vui lòng nhập prompt cho AI');
      return;
    }
    setAiGenerating(true);
    try {
      const response = await examService.generateCourseExamAiDraft(selectedCourseId, {
        chapterId: form.placementChapterId,
        prompt: aiPrompt.trim(),
        material: currentSlot.chapters.map(chapter => `Ch.${chapter.order}: ${chapter.title}`).join('\n'),
        questionCount: aiQuestionCount,
        questionType: aiQuestionType,
        difficulty: aiDifficulty,
      });
      const points = aiQuestionType === 'essay'
        ? form.essaySectionPoints / Math.max(1, response.questions.length)
        : form.objectiveSectionPoints / Math.max(1, response.questions.length);
      const drafted: ExamQuestion[] = response.questions.map((question, idx) => ({
        id: `ai-${response.promptId}-${idx}`,
        text: question.text,
        type: question.type,
        options: [...(question.options ?? [])],
        correctIndices: [...(question.correctIndices ?? [])],
        metadata: {
          ...(question.metadata ?? {}),
          aiPromptId: response.promptId,
          aiStatus: question.status,
          sourceRefs: question.sourceRefs,
          rejectionReason: question.rejectionReason ?? undefined,
        } as QuestionMetadata,
        explanation: question.explanation ?? '',
        points,
        difficulty: question.difficulty,
      }));
      setForm(redistributeQuestionPoints({
        ...form,
        questions: orderExamQuestionsObjectiveFirst([...form.questions, ...drafted]),
      }));
      notify.success(`AI đã tạo ${drafted.length} câu nháp. Hãy review trước khi lưu.`);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không tạo được câu hỏi AI');
    } finally {
      setAiGenerating(false);
    }
  }

  // ── Handler: lưu bài kiểm tra ───────────────────────────────────
  // Validate: tương tự quiz nhưng có thêm check maxAttempts
  async function saveExam() {
    if (!form || selectedSlotIndex === null || !selectedCourseId || saving) return;
    const resolvedExamType = resolveExamType(currentCourse?.chapters ?? [], form.placementChapterId, selectedSlotIndex);
    const normalizedForm = redistributeQuestionPoints(syncExamTypeWithPlacement(
      {
        ...form,
        examType: resolvedExamType,
        maxAttempts: 3,
        requireFullscreen: true,
        blockCopyPaste: true,
      },
      currentCourse?.chapters ?? [],
      selectedSlotIndex,
    ));

    if (!normalizedForm.name.trim()) {
      notify.error('Vui lòng nhập tên bài kiểm tra');
      return;
    }
    if (!normalizedForm.scopeStartChapterId) {
      notify.error('Vui lòng chọn chương bắt đầu');
      return;
    }
    if (!normalizedForm.placementChapterId) {
      notify.error('Vui lòng chọn vị trí đặt bài kiểm tra');
      return;
    }
    const startIndex = currentCourse?.chapters.findIndex(chapter => chapter.id === normalizedForm.scopeStartChapterId) ?? -1;
    const endIndex = currentCourse?.chapters.findIndex(chapter => chapter.id === normalizedForm.placementChapterId) ?? -1;
    if (startIndex < 0 || endIndex < 0 || startIndex > endIndex) {
      notify.error('Chương bắt đầu phải đứng trước hoặc bằng chương kết thúc');
      return;
    }
    if (normalizedForm.durationMinutes < 1) {
      notify.error('Thời gian làm bài phải >= 1 phút');
      return;
    }
    if (normalizedForm.passScorePercent < 0 || normalizedForm.passScorePercent > 100) {
      notify.error('Điểm đạt phải từ 0% đến 100%');
      return;
    }
    if (normalizedForm.maxAttempts < 1) {
      notify.error('Số lần làm lại phải >= 1');
      return;
    }
    if (normalizedForm.questions.length === 0) {
      notify.error('Bài kiểm tra phải có ít nhất 1 câu hỏi');
      return;
    }
    const confirmedUnderTen = normalizedForm.questions.length >= 10
      || window.confirm('Bài kiểm tra có dưới 10 câu. Bạn có muốn lưu cấu hình này không?');
    if (!confirmedUnderTen) return;
    const objectiveTotal = normalizedForm.questions
      .filter(q => !isManualExamType(q.type))
      .reduce((sum, q) => sum + q.points, 0);
    const essayTotal = normalizedForm.questions
      .filter(q => isManualExamType(q.type))
      .reduce((sum, q) => sum + q.points, 0);
    if (objectiveTotal <= 0 || essayTotal <= 0) {
      notify.error('Bài kiểm tra phải có cả phần tự động chấm và phần cần giáo viên chấm');
      return;
    }
    if (Math.abs(objectiveTotal + essayTotal - 10) > 0.001) {
      notify.error('Tổng điểm phần tự động chấm và phần chấm tay phải bằng 10 điểm');
      return;
    }
    for (let i = 0; i < normalizedForm.questions.length; i++) {
      const q = normalizedForm.questions[i];
      if (!q.text.trim()) {
        notify.error(`Câu ${i + 1}: chưa nhập nội dung`);
        return;
      }
      if (q.metadata?.aiPromptId && q.metadata.aiStatus !== 'approved') {
        notify.error(`Câu ${i + 1}: câu AI phải được approve trước khi lưu`);
        return;
      }
      if (isManualExamType(q.type)
        && !q.explanation?.trim()
        && !(q.metadata as Record<string, unknown> | null | undefined)?.rubric
        && !(q.metadata as Record<string, unknown> | null | undefined)?.sampleAnswer) {
        notify.error(`Câu ${i + 1}: câu tự luận phải có barem chấm`);
        return;
      }
      if (!isObjectiveExamType(q.type)) {
        continue;
      }
      if (q.options.some(opt => !opt.trim())) {
        notify.error(`Câu ${i + 1}: có lựa chọn còn rỗng`);
        return;
      }
      if (q.correctIndices.length === 0) {
        notify.error(`Câu ${i + 1}: chưa chọn đáp án đúng`);
        return;
      }
    }

    setSaving(true);
    try {
      const saved = await examService.saveCourseExam(
        selectedCourseId,
        selectedSlotIndex,
        examToRequest(normalizedForm, confirmedUnderTen),
      );
      const savedExam = examFromResponse(saved);

      setData(prev => prev.map(course => {
        if (course.id !== selectedCourseId) return course;
        return {
          ...course,
          exams: { ...course.exams, [selectedSlotIndex]: savedExam },
        };
      }));
      setForm({
        ...savedExam,
        questions: orderExamQuestionsObjectiveFirst(savedExam.questions).map(q => ({ ...q })),
      });
      notify.success('Đã lưu bài kiểm tra');
    } catch (error) {
      notify.error(error instanceof Error
        ? error.message
        : 'Không lưu được bài kiểm tra');
    } finally {
      setSaving(false);
    }
  }

  // ── Handler: hủy chỉnh sửa ──────────────────────────────────────
  function cancelEdit() {
    setSelectedSlotIndex(null);
    setSelectedQuestionIndex(0);
    setForm(null);
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  // ═════════════════════════════════════════════════════════════════
  //  RENDER
  // ═════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-surface flex font-sans">

      {/* Overlay sidebar mobile */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* ── SIDEBAR ─────────────────────────────────────────────── */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64
        bg-surface-container-lowest border-r border-outline-variant/30
        flex flex-col transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:flex
      `}>
        <div className="p-6 flex items-center justify-between border-b border-outline-variant/20">
          <Link to="/teacher" className="flex items-center gap-3">
            <BrandLogo size="sm" />
            <div>
              <p className="font-extrabold text-on-surface text-sm">Bee Academy</p>
              <p className="text-xs text-on-surface-variant font-medium">Cổng Giáo Viên</p>
            </div>
          </Link>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 text-on-surface-variant">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                  isActive ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
                {isActive && <div className="ml-auto w-2 h-2 bg-primary rounded-full" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-outline-variant/20">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors text-left"
          >
            <LogOut className="w-5 h-5" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* ── MAIN AREA ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        <header className="sticky top-0 z-20 h-16 bg-surface/90 backdrop-blur-md border-b border-outline-variant/30 flex items-center justify-between px-4 md:px-6 shadow-sm">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-extrabold text-on-surface text-lg hidden lg:block">Bài kiểm tra</h1>
          <div className="flex items-center gap-4 ml-auto">
            <TeacherNotificationBell />
            <img
              src={user?.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? 'Giao Vien')}&background=7c3aed&color=fff&bold=true&size=64`}
              alt="Teacher avatar"
              className="w-9 h-9 rounded-full object-cover border-2 border-primary/30"
            />
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-[1240px] p-4 md:p-6 lg:p-8">

          {/* Tiêu đề + dropdown chọn khóa / slot */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-3xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm"
          >
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-2xl font-extrabold text-on-surface mb-1">Bài kiểm tra học kỳ</h2>
                <p className="text-sm text-on-surface-variant">
                  Chọn khóa học, vị trí bài kiểm tra và cấu hình đề theo đúng question bank.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">
                  {data.length} khóa học
                </span>
                <span className="inline-flex items-center rounded-full bg-surface-container px-3 py-1 font-medium text-on-surface-variant">
                  {slots.length} vị trí
                </span>
                <span className={`inline-flex items-center rounded-full px-3 py-1 font-semibold ${
                  form && currentSlot ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {form && currentSlot ? 'Đang chỉnh sửa' : 'Chưa chọn bài'}
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(260px,380px)_minmax(320px,420px)_minmax(260px,1fr)]">
              <label className="block">
                <span className="text-sm font-bold text-on-surface mb-2 block">Chọn khóa học</span>
                <select
                  value={selectedCourseId}
                  onChange={e => changeCourse(e.target.value)}
                  disabled={loading || data.length === 0}
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-on-surface font-semibold"
                >
                  {data.length === 0 && (
                    <option value="">
                      {loading ? 'Đang tải khóa học...' : 'Chưa có khóa học'}
                    </option>
                  )}
                  {data.map(course => (
                    <option key={course.id} value={course.id}>{course.title}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-bold text-on-surface mb-2 block">Vị trí bài kiểm tra</span>
                <select
                  value={selectedSlotIndex ?? ''}
                  onChange={e => {
                    const nextValue = e.target.value;
                    if (nextValue === '') {
                      setSelectedSlotIndex(null);
                      setForm(null);
                      return;
                    }
                    const nextSlot = slots.find(slot => slot.slotIndex === Number(nextValue));
                    if (nextSlot) selectSlot(nextSlot);
                  }}
                  disabled={loading || slots.length === 0}
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-on-surface font-semibold"
                >
                  <option value="">
                    {loading
                      ? 'Đang tải vị trí bài kiểm tra...'
                      : slots.length === 0
                        ? 'Chưa có vị trí bài kiểm tra'
                        : 'Chọn vị trí bài kiểm tra'}
                  </option>
                  {slots.map(slot => {
                    const placementLabel = slot.placementChapter
                      ? `Sau chương ${slot.placementChapter.order}`
                      : 'Chưa chọn vị trí';
                    const statusLabel = slot.exam ? 'Đã tạo' : 'Chưa tạo';
                    return (
                      <option key={slot.slotIndex} value={slot.slotIndex}>
                        {slot.defaultName} · {placementLabel} · {statusLabel}
                      </option>
                    );
                  })}
                </select>
                {selectedSlotIndex !== null && currentSlot ? (
                  <p className="mt-2 text-xs text-on-surface-variant">
                    Phạm vi hiện tại: {currentSlot.chapters.map(ch => `Ch.${ch.order}`).join(' · ')}
                  </p>
                ) : null}
              </label>

              <div className="rounded-2xl border border-outline-variant/30 bg-surface-container/40 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Tóm tắt nhanh</p>
                <div className="mt-3 space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-on-surface-variant">Khóa học</p>
                    <p className="font-semibold text-on-surface">
                      {currentCourse?.title ?? 'Chưa chọn khóa học'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-on-surface-variant">Số chương</p>
                      <p className="font-semibold text-on-surface">{currentCourse?.chapters.length ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-on-surface-variant">Trạng thái</p>
                      <p className="font-semibold text-on-surface">
                        {currentSlot ? (currentSlot.exam ? 'Đã tạo bài' : 'Tạo bài mới') : 'Chưa chọn vị trí'}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-on-surface-variant">Phạm vi</p>
                    <p className="font-semibold text-on-surface">
                      {scopeStartChapter && scopeEndChapter
                        ? `Ch.${scopeStartChapter.order} → Ch.${scopeEndChapter.order}`
                        : currentSlot?.placementChapter
                          ? `Sau chương ${currentSlot.placementChapter.order}`
                          : 'Chưa chọn'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1">
            <motion.div
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
              className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-5 shadow-sm"
            >
              {!form || !currentSlot ? (
                <div className="text-center py-16">
                  <GraduationCap className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
                  <p className="text-on-surface-variant">
                    {loading
                      ? 'Đang tải dữ liệu bài kiểm tra...'
                      : data.length === 0
                        ? 'Bạn chưa có khóa học nào để tạo bài kiểm tra.'
                        : 'Chọn khóa học và vị trí bài kiểm tra ở phía trên để bắt đầu tạo hoặc chỉnh sửa.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Tiêu đề + phạm vi chương */}
                  <div className="mb-6 pb-5 border-b border-outline-variant/30 space-y-4">
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1">
                      Đang chỉnh sửa bài kiểm tra cho
                    </p>
                    <h3 className="font-extrabold text-on-surface text-lg mb-2">
                      {currentSlot.defaultName}
                    </h3>
                  </div>

                  {/* ── PHẦN 1: Cài đặt chung ─────────────────────── */}
                  <div
                    id="exam-general"
                    className="space-y-5 mb-6 rounded-2xl border border-outline-variant/30 bg-surface-container/30 p-4"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-bold text-on-surface">Cài đặt chung</p>
                      <span className="text-xs text-on-surface-variant">
                        Thiết lập tên, phạm vi chương và cách hệ thống hiểu vị trí bài kiểm tra.
                      </span>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">

                    <label className="block">
                      <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                        Tên bài kiểm tra <span className="text-red-500">*</span>
                      </span>
                      <input
                        type="text"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        placeholder="VD: Bài kiểm tra giữa kỳ I"
                        className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                        Phân loại bài kiểm tra
                      </span>
                      <select
                        value={resolvedFormExamType}
                        onChange={e => {
                          const nextType = e.target.value as ExamType;
                          const chapters = currentCourse?.chapters ?? [];
                          if (chapters.length === 0) return;

                          if (nextType === 'final_exam') {
                            const lastChapterIndex = chapters.length - 1;
                            const currentStartIndex = chapters.findIndex(ch => ch.id === form.scopeStartChapterId);
                            const nextStartId = currentStartIndex >= 0 && currentStartIndex <= lastChapterIndex
                              ? form.scopeStartChapterId
                              : chapters[0]?.id ?? form.scopeStartChapterId;
                            setForm(syncExamTypeWithPlacement({
                              ...form,
                              examType: nextType,
                              scopeStartChapterId: nextStartId,
                              placementChapterId: chapters[chapters.length - 1]?.id ?? form.placementChapterId,
                            }, chapters, currentSlot.slotIndex));
                            return;
                          }

                          const currentPlacementIndex = chapters.findIndex(ch => ch.id === form.placementChapterId);
                          const nextPlacementIndex = currentPlacementIndex >= 0 && currentPlacementIndex < chapters.length - 1
                            ? currentPlacementIndex
                            : defaultMidtermPlacementIndex(currentSlot.slotIndex, chapters.length);
                          const nextPlacementId = chapters[nextPlacementIndex]?.id ?? form.placementChapterId;
                          const currentStartIndex = chapters.findIndex(ch => ch.id === form.scopeStartChapterId);

                          setForm(syncExamTypeWithPlacement({
                            ...form,
                            examType: nextType,
                            placementChapterId: nextPlacementId,
                            scopeStartChapterId: currentStartIndex < 0 || currentStartIndex > nextPlacementIndex
                              ? nextPlacementId
                              : form.scopeStartChapterId,
                          }, chapters, currentSlot.slotIndex));
                        }}
                        className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                      >
                        <option value="chapter_test">{examTypeDisplayLabel('chapter_test')}</option>
                        <option value="final_exam">{examTypeDisplayLabel('final_exam')}</option>
                      </select>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        Bạn có thể chọn nhanh ở đây hoặc đổi ở phần vị trí đặt bài kiểm tra. Nếu đặt sau chương cuối cùng thì hệ thống sẽ hiểu là bài cuối kỳ.
                      </p>
                    </label>

                    <label className="block">
                      <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                        Chương bắt đầu <span className="text-red-500">*</span>
                      </span>
                      <select
                        value={form.scopeStartChapterId ?? ''}
                        onChange={e => {
                          const nextStartId = e.target.value;
                          const nextStartIndex = currentCourse?.chapters.findIndex(ch => ch.id === nextStartId) ?? -1;
                          const currentEndIndex = currentCourse?.chapters.findIndex(ch => ch.id === form.placementChapterId) ?? -1;
                          setForm(syncExamTypeWithPlacement({
                            ...form,
                            scopeStartChapterId: nextStartId,
                            placementChapterId: currentEndIndex >= 0 && currentEndIndex < nextStartIndex
                              ? nextStartId
                              : form.placementChapterId,
                          }, currentCourse?.chapters ?? [], currentSlot.slotIndex));
                        }}
                        className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                      >
                        <option value="">Chọn chương</option>
                        {currentCourse?.chapters.map(chapter => (
                          <option key={chapter.id} value={chapter.id}>
                            Chương {chapter.order}: {chapter.title}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                        Vị trí đặt bài kiểm tra <span className="text-red-500">*</span>
                      </span>
                      <select
                        value={form.placementChapterId ?? ''}
                        onChange={e => {
                          const nextEndId = e.target.value;
                          const currentStartIndex = currentCourse?.chapters.findIndex(ch => ch.id === form.scopeStartChapterId) ?? -1;
                          const nextEndIndex = currentCourse?.chapters.findIndex(ch => ch.id === nextEndId) ?? -1;
                          setForm(syncExamTypeWithPlacement({
                            ...form,
                            placementChapterId: nextEndId,
                            scopeStartChapterId: currentStartIndex > nextEndIndex
                              ? nextEndId
                              : form.scopeStartChapterId,
                          }, currentCourse?.chapters ?? [], currentSlot.slotIndex));
                        }}
                        className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                      >
                        <option value="">Chọn chương</option>
                        {currentCourse?.chapters.map(chapter => (
                          <option key={chapter.id} value={chapter.id}>
                            Sau chương {chapter.order}: {chapter.title}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        Bài kiểm tra sẽ xuất hiện trong mục lục ngay sau chương đã chọn.
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        Nếu chọn chương cuối cùng, hệ thống sẽ tự xem đây là bài cuối kỳ theo phạm vi bạn đã chọn.
                      </p>
                    </label>

                    </div>

                    {/* Mô tả/Hướng dẫn — đặc thù Exam */}
                    <label className="block">
                      <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                        Mô tả / Hướng dẫn làm bài <span className="text-on-surface-variant/70 font-normal normal-case">(hiển thị trước khi HS bắt đầu)</span>
                      </span>
                      <textarea
                        value={form.description ?? ''}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                        placeholder="VD: Đọc kỹ đề trước khi làm. Không sử dụng tài liệu."
                        rows={2}
                        className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant resize-none"
                      />
                    </label>

                    {/* Thời gian + Pass score + Tổng điểm (3 cột) */}
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
                      <label className="block">
                        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                          Thời gian (phút)
                        </span>
                        <input
                          type="number"
                          min={1}
                          value={form.durationMinutes}
                          onChange={e => setForm({ ...form, durationMinutes: parseInt(e.target.value) || 1 })}
                          className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                          Điểm đạt (%)
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={form.passScorePercent}
                          onChange={e => setForm({ ...form, passScorePercent: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                        />
                      </label>
                      <div className="col-span-2 xl:col-span-1">
                        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                          Tổng điểm
                        </span>
                        <div className="w-full px-3 py-2 text-sm bg-surface-container/50 border border-outline-variant/50 rounded-lg text-on-surface font-bold">
                          {formatPoints(totalPoints)} điểm
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <label className="block">
                        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                          Điểm trắc nghiệm
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          step={0.25}
                          value={form.objectiveSectionPoints}
                          onChange={e => {
                            const next = Math.max(0, Number(e.target.value) || 0);
                            setForm(redistributeQuestionPoints({
                              ...form,
                              objectiveSectionPoints: next,
                              essaySectionPoints: Math.max(0, 10 - next),
                            }));
                          }}
                          className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                          Điểm tự luận
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          step={0.25}
                          value={form.essaySectionPoints}
                          onChange={e => {
                            const next = Math.max(0, Number(e.target.value) || 0);
                            setForm(redistributeQuestionPoints({
                              ...form,
                              essaySectionPoints: next,
                              objectiveSectionPoints: Math.max(0, 10 - next),
                            }));
                          }}
                          className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                        />
                      </label>
                    </div>
                  </div>

                  {/* ── PHẦN 2: Cài đặt làm bài (đặc thù Exam) ───── */}
                  <div
                    id="exam-behavior"
                    className="space-y-4 mb-6 rounded-2xl border border-outline-variant/30 bg-surface-container/20 p-4"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-bold text-on-surface">Cài đặt làm bài</p>
                      <span className="text-xs text-on-surface-variant">
                        Tối ưu trải nghiệm làm bài và hạn chế gian lận ngay từ cấu hình.
                      </span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">

                    {/* Số lần làm lại */}
                    <label className="flex items-center gap-3 rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-4 py-3">
                      <Repeat className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
                      <span className="text-sm text-on-surface flex-1">Số lần làm tối đa (1 chính + 2 thi lại)</span>
                      <input
                        type="number"
                        min={3}
                        max={3}
                        value={form.maxAttempts}
                        disabled
                        className="w-20 px-3 py-1.5 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface text-center"
                      />
                    </label>

                    {/* Toggle: xáo trộn câu hỏi */}
                    <label className="flex items-center gap-3 rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-4 py-3">
                      <Shuffle className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
                      <span className="text-sm text-on-surface flex-1">
                        Xáo trộn thứ tự câu hỏi
                        <span className="text-xs text-on-surface-variant/70 ml-2">(mỗi HS thấy thứ tự khác nhau)</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={form.shuffleQuestions}
                        onChange={e => setForm({ ...form, shuffleQuestions: e.target.checked })}
                        className="w-5 h-5 accent-primary"
                      />
                    </label>

                    {/* Toggle: xáo trộn lựa chọn */}
                    <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-4 py-3">
                      <Shuffle className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
                      <span className="text-sm text-on-surface flex-1">
                        Xáo trộn thứ tự lựa chọn A/B/C/D
                      </span>
                      <input
                        type="checkbox"
                        checked={form.shuffleOptions}
                        onChange={e => setForm({ ...form, shuffleOptions: e.target.checked })}
                        className="w-5 h-5 accent-primary"
                      />
                    </label>

                    {/* Toggle: hiện đáp án sau khi nộp */}
                    <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-4 py-3">
                      <Eye className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
                      <span className="text-sm text-on-surface flex-1">
                        Hiển thị đáp án đúng sau khi nộp bài
                        <span className="text-xs text-on-surface-variant/70 ml-2">(tắt nếu không muốn lộ đề)</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={form.showAnswerAfterSubmit}
                        onChange={e => setForm({ ...form, showAnswerAfterSubmit: e.target.checked })}
                        className="w-5 h-5 accent-primary"
                      />
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-4 py-3">
                      <Eye className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
                      <span className="text-sm text-on-surface flex-1">Yêu cầu fullscreen khi làm bài (bắt buộc)</span>
                      <input
                        type="checkbox"
                        checked
                        disabled
                        className="w-5 h-5 accent-primary"
                      />
                    </label>

                    <label className="flex items-center gap-3 rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-4 py-3">
                      <Lock className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
                      <span className="text-sm text-on-surface flex-1">Chặn copy/paste trong lúc làm bài (bắt buộc)</span>
                      <input
                        type="checkbox"
                        checked
                        disabled
                        className="w-5 h-5 accent-primary"
                      />
                    </label>
                    </div>
                  </div>

                  {/* ── PHẦN 3: Câu hỏi ─────────────────────────── */}
                  <div
                    id="exam-questions"
                    className="space-y-5 mb-6 rounded-2xl border border-outline-variant/30 bg-surface-container/20 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-sm font-bold text-on-surface">
                          Câu hỏi <span className="text-on-surface-variant font-normal">({form.questions.length})</span>
                        </p>
                        <p className="mt-1 text-xs text-on-surface-variant">
                          Theo dõi nhanh cơ cấu đề để tránh lệch điểm và lệch loại câu.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Trắc nghiệm</p>
                          <p className="mt-1 text-lg font-extrabold text-on-surface">{formMultipleChoiceCount}</p>
                          {chapterRandomTotal > 0 && (
                            <p className="mt-0.5 text-[11px] font-medium text-on-surface-variant">
                              Dự kiến random: {multipleChoiceRandomTotal}
                            </p>
                          )}
                        </div>
                        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Đúng / Sai</p>
                          <p className="mt-1 text-lg font-extrabold text-on-surface">{formTrueFalseCount}</p>
                          {chapterRandomTotal > 0 && (
                            <p className="mt-0.5 text-[11px] font-medium text-on-surface-variant">
                              Dự kiến random: {trueFalseRandomTotal}
                            </p>
                          )}
                        </div>
                        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Điền chỗ trống</p>
                          <p className="mt-1 text-lg font-extrabold text-on-surface">{formFillInBlankCount}</p>
                          {chapterRandomTotal > 0 && (
                            <p className="mt-0.5 text-[11px] font-medium text-on-surface-variant">
                              Dự kiến random: {fillInBlankRandomTotal}
                            </p>
                          )}
                        </div>
                        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Câu hỏi ảnh</p>
                          <p className="mt-1 text-lg font-extrabold text-on-surface">{formImageQuestionCount}</p>
                          {chapterRandomTotal > 0 && (
                            <p className="mt-0.5 text-[11px] font-medium text-on-surface-variant">
                              Dự kiến random: {imageQuestionRandomTotal}
                            </p>
                          )}
                        </div>
                        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Tự luận</p>
                          <p className="mt-1 text-lg font-extrabold text-on-surface">{formEssayCount}</p>
                          {chapterRandomTotal > 0 && (
                            <p className="mt-0.5 text-[11px] font-medium text-on-surface-variant">
                              Dự kiến random: {essayRandomTotal}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-sm font-bold text-on-surface flex items-center gap-2">
                            <Shuffle className="w-4 h-4 text-primary" />
                            Random từ ngân hàng câu hỏi
                          </p>
                          <p className="text-xs text-on-surface-variant mt-1">
                            Mỗi chương được lấy câu ngay từ đúng chapter đó. Hãy nhìn tồn kho từng loại bên dưới để chia đề nhanh và chính xác hơn.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="inline-flex items-center rounded-full bg-white/70 px-3 py-1 font-medium text-on-surface-variant">
                            {selectedScopeChapters.length} chương
                          </span>
                          <span className="inline-flex items-center rounded-full bg-white/70 px-3 py-1 font-medium text-on-surface-variant">
                            {objectiveRandomTotal} câu tự động chấm
                          </span>
                          <span className="inline-flex items-center rounded-full bg-white/70 px-3 py-1 font-medium text-on-surface-variant">
                            {essayRandomTotal} câu tự luận
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Câu dự kiến</p>
                          <p className="mt-1 text-lg font-extrabold text-on-surface">{chapterRandomTotal}</p>
                        </div>
                        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Điểm auto/câu</p>
                          <p className="mt-1 text-lg font-extrabold text-on-surface">{formatPoints(objectivePointPerQuestion)}</p>
                        </div>
                        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Điểm tự luận/câu</p>
                          <p className="mt-1 text-lg font-extrabold text-on-surface">{formatPoints(essayPointPerQuestion)}</p>
                        </div>
                        <div className={`rounded-xl border px-3 py-2 ${
                          randomSplitValid
                            ? 'border-green-200 bg-green-50'
                            : 'border-amber-200 bg-amber-50'
                        }`}>
                          <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Trạng thái chia điểm</p>
                          <p className={`mt-1 text-sm font-extrabold ${
                            randomSplitValid ? 'text-green-700' : 'text-amber-700'
                          }`}>
                            {randomSplitValid ? 'Hợp lệ' : 'Cần đủ auto + tự luận và tổng 10 điểm'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {activeChapterConfigs.map(({ chapter, config, stats }) => (
                          <div
                            key={chapter.id}
                            className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4"
                          >
                            <div className="space-y-4">
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-on-surface">
                                  Ch.{chapter.order}: {chapter.title}
                                </p>
                                <p className="mt-1 text-xs text-on-surface-variant">
                                  {loadingChapterStats ? (
                                    <span className="inline-flex items-center gap-1">
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      Đang tải thống kê
                                    </span>
                                  ) : stats ? (
                                    <>Có {stats.totalActive} câu hợp lệ để đưa vào bài kiểm tra.</>
                                  ) : (
                                    <>Chưa đọc được thống kê</>
                                  )}
                                </p>
                              </div>

                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                                <label className="block rounded-xl border border-outline-variant/30 bg-surface-container/50 p-3">
                                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1 block">
                                    Trắc nghiệm
                                  </span>
                                  <span className="mb-1.5 block text-[11px] text-on-surface-variant">
                                    Có {stats?.multipleChoiceCount ?? 0} câu
                                  </span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={config.multipleChoiceCount}
                                    onChange={e => updateChapterRandomConfig(
                                      chapter.id,
                                      'multipleChoiceCount',
                                      parseInt(e.target.value) || 0,
                                    )}
                                    className={`w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:border-primary ${
                                      config.multipleChoiceCount > (stats?.multipleChoiceCount ?? Number.MAX_SAFE_INTEGER)
                                        ? 'border border-red-300 bg-red-50 text-red-700'
                                        : 'bg-surface-container border border-outline-variant text-on-surface'
                                    }`}
                                  />
                                </label>
                                <label className="block rounded-xl border border-outline-variant/30 bg-surface-container/50 p-3">
                                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1 block">
                                    Đúng / Sai
                                  </span>
                                  <span className="mb-1.5 block text-[11px] text-on-surface-variant">
                                    Có {stats?.trueFalseCount ?? 0} câu
                                  </span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={config.trueFalseCount}
                                    onChange={e => updateChapterRandomConfig(
                                      chapter.id,
                                      'trueFalseCount',
                                      parseInt(e.target.value) || 0,
                                    )}
                                    className={`w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:border-primary ${
                                      config.trueFalseCount > (stats?.trueFalseCount ?? Number.MAX_SAFE_INTEGER)
                                        ? 'border border-red-300 bg-red-50 text-red-700'
                                        : 'bg-surface-container border border-outline-variant text-on-surface'
                                    }`}
                                  />
                                </label>
                                <label className="block rounded-xl border border-outline-variant/30 bg-surface-container/50 p-3">
                                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1 block">
                                    Điền chỗ trống
                                  </span>
                                  <span className="mb-1.5 block text-[11px] text-on-surface-variant">
                                    Có {stats?.fillInBlankCount ?? 0} câu
                                  </span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={config.fillInBlankCount}
                                    onChange={e => updateChapterRandomConfig(
                                      chapter.id,
                                      'fillInBlankCount',
                                      parseInt(e.target.value) || 0,
                                    )}
                                    className={`w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:border-primary ${
                                      config.fillInBlankCount > (stats?.fillInBlankCount ?? Number.MAX_SAFE_INTEGER)
                                        ? 'border border-red-300 bg-red-50 text-red-700'
                                        : 'bg-surface-container border border-outline-variant text-on-surface'
                                    }`}
                                  />
                                </label>
                                <label className="block rounded-xl border border-outline-variant/30 bg-surface-container/50 p-3">
                                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1 block">
                                    Câu hỏi ảnh
                                  </span>
                                  <span className="mb-1.5 block text-[11px] text-on-surface-variant">
                                    Có {stats?.imageQuestionCount ?? 0} câu
                                  </span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={config.imageQuestionCount}
                                    onChange={e => updateChapterRandomConfig(
                                      chapter.id,
                                      'imageQuestionCount',
                                      parseInt(e.target.value) || 0,
                                    )}
                                    className={`w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:border-primary ${
                                      config.imageQuestionCount > (stats?.imageQuestionCount ?? Number.MAX_SAFE_INTEGER)
                                        ? 'border border-red-300 bg-red-50 text-red-700'
                                        : 'bg-surface-container border border-outline-variant text-on-surface'
                                    }`}
                                  />
                                </label>
                                <label className="block rounded-xl border border-outline-variant/30 bg-surface-container/50 p-3">
                                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1 block">
                                    Tự luận
                                  </span>
                                  <span className="mb-1.5 block text-[11px] text-on-surface-variant">
                                    Có {stats?.essayCount ?? 0} câu
                                  </span>
                                  <input
                                    type="number"
                                    min={0}
                                    value={config.essayCount}
                                    onChange={e => updateChapterRandomConfig(
                                      chapter.id,
                                      'essayCount',
                                      parseInt(e.target.value) || 0,
                                    )}
                                    className={`w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:border-primary ${
                                      config.essayCount > (stats?.essayCount ?? Number.MAX_SAFE_INTEGER)
                                        ? 'border border-red-300 bg-red-50 text-red-700'
                                        : 'bg-surface-container border border-outline-variant text-on-surface'
                                    }`}
                                  />
                                </label>
                              </div>

                              {stats ? (
                                <div className="flex flex-wrap gap-2">
                                  <span className="inline-flex items-center rounded-full bg-surface-container px-3 py-1.5 text-xs font-medium text-on-surface-variant">
                                    Trắc nghiệm: {stats.multipleChoiceCount}
                                  </span>
                                  <span className="inline-flex items-center rounded-full bg-surface-container px-3 py-1.5 text-xs font-medium text-on-surface-variant">
                                    Đúng / Sai: {stats.trueFalseCount}
                                  </span>
                                  <span className="inline-flex items-center rounded-full bg-surface-container px-3 py-1.5 text-xs font-medium text-on-surface-variant">
                                    Điền chỗ trống: {stats.fillInBlankCount}
                                  </span>
                                  <span className="inline-flex items-center rounded-full bg-surface-container px-3 py-1.5 text-xs font-medium text-on-surface-variant">
                                    Câu hỏi ảnh: {stats.imageQuestionCount}
                                  </span>
                                  <span className="inline-flex items-center rounded-full bg-surface-container px-3 py-1.5 text-xs font-medium text-on-surface-variant">
                                    Tự luận: {stats.essayCount}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1 text-xs">
                          {chapterRandomWarnings.length > 0 ? (
                            <div className="text-red-600 font-medium flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <p className="font-bold">Thiếu câu hỏi trong ngân hàng</p>
                                <p className="mt-1 text-[11px] font-medium text-red-500">
                                  Giảm số lượng ở các ô đang vượt tồn kho hoặc bổ sung câu hỏi vào đúng chapter trong question bank.
                                </p>
                                <ul className="mt-2 max-h-40 space-y-1 overflow-auto pr-1">
                                  {chapterRandomWarnings.map(item => (
                                    <li key={item.key} className="break-words leading-relaxed">
                                      {item.chapterTitle} - {item.typeLabel}: cần {item.need}, có {item.have}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-700">
                              <p className="font-semibold">Cấu hình random hiện tại hợp lệ</p>
                              <p className="mt-1">
                                Sẽ random {objectiveRandomTotal} câu tự động chấm ({formatPoints(objectivePointPerQuestion)} điểm/câu), gồm {multipleChoiceRandomTotal} trắc nghiệm, {trueFalseRandomTotal} đúng/sai, {fillInBlankRandomTotal} điền chỗ trống, {imageQuestionRandomTotal} câu hỏi ảnh; và {essayRandomTotal} câu tự luận ({formatPoints(essayPointPerQuestion)} điểm/câu).
                              </p>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={randomizeQuestionsFromBank}
                          disabled={randomizing || loadingChapterStats || chapterRandomTotal <= 0 || !randomSplitValid || chapterRandomWarnings.length > 0}
                          className="inline-flex w-full items-center justify-center gap-2 px-4 py-3 bg-primary text-on-primary text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed lg:w-auto"
                        >
                          {randomizing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Shuffle className="w-4 h-4" />
                          )}
                          {randomizing ? 'Đang random...' : 'Random câu hỏi'}
                        </button>
                      </div>
                    </div>
                    </div>

                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
                        <div className="min-w-0 xl:flex-1">
                          <p className="flex items-center gap-2 text-sm font-bold text-on-surface">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            AI tạo câu hỏi nháp
                          </p>
                          <p className="mt-1 text-xs text-on-surface-variant">
                            Câu AI chỉ được thêm vào form ở trạng thái nháp; giáo viên cần review trước khi lưu bài kiểm tra.
                          </p>
                          <textarea
                            value={aiPrompt}
                            onChange={e => setAiPrompt(e.target.value)}
                            rows={2}
                            placeholder="Nhập prompt hoặc yêu cầu tạo câu hỏi theo phạm vi chương đã chọn"
                            className="mt-3 w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary resize-none"
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:min-w-[520px] xl:grid-cols-[140px_140px_100px_1fr]">
                          <select
                            value={aiQuestionType}
                            onChange={e => setAiQuestionType(e.target.value as typeof aiQuestionType)}
                            className="px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg text-on-surface"
                          >
                            <option value="multiple_choice">Trắc nghiệm</option>
                            <option value="true_false">Đúng / Sai</option>
                            <option value="fill_in_blank">Điền chỗ trống</option>
                            <option value="essay">Tự luận</option>
                          </select>
                          <select
                            value={aiDifficulty}
                            onChange={e => setAiDifficulty(e.target.value as ExamDifficulty)}
                            className="px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg text-on-surface"
                          >
                            <option value="easy">Dễ</option>
                            <option value="medium">Trung bình</option>
                            <option value="hard">Khó</option>
                          </select>
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={aiQuestionCount}
                            onChange={e => setAiQuestionCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                            className="px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg text-on-surface"
                          />
                          <button
                            type="button"
                            onClick={generateAiDraftQuestions}
                            disabled={aiGenerating}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
                          >
                            {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            {aiGenerating ? 'Đang tạo...' : 'Tạo nháp AI'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-xl border border-outline-variant/25 bg-surface-container-lowest/70 p-4">
                      {form.questions.length === 0 ? (
                        <div className="rounded-xl border-2 border-dashed border-outline-variant/40 py-8 text-center">
                          <p className="text-sm text-on-surface-variant">
                            Chưa có câu hỏi nào. Hãy random từ ngân hàng câu hỏi, tạo nháp AI hoặc thêm câu hỏi thủ công.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="rounded-xl border border-outline-variant/30 bg-surface-container/40 p-4">
                            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                              <label className="block">
                                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                                  Chọn câu hỏi
                                </span>
                                <select
                                  value={selectedQuestionIndex}
                                  onChange={e => setSelectedQuestionIndex(parseInt(e.target.value, 10) || 0)}
                                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
                                >
                                  {form.questions.map((question, idx) => (
                                    <option key={question.id} value={idx}>
                                      {questionSelectionLabel(question, idx)}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              {selectedQuestion && (
                                <div className="flex flex-wrap gap-2 xl:justify-end">
                                  <span className="inline-flex items-center rounded-full bg-surface-container px-3 py-1 text-xs font-bold text-on-surface">
                                    Câu {selectedQuestionIndex + 1}/{form.questions.length}
                                  </span>
                                  <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                                    {questionTypeLabel(selectedQuestion.type, selectedQuestion.correctIndices.length)}
                                  </span>
                                  <span className="inline-flex items-center rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700">
                                    {selectedQuestion.difficulty === 'easy'
                                      ? 'Dễ'
                                      : selectedQuestion.difficulty === 'hard'
                                        ? 'Khó'
                                        : 'Trung bình'}
                                  </span>
                                  <span className="inline-flex items-center rounded-full bg-surface-container px-3 py-1 text-xs font-medium text-on-surface-variant">
                                    {formatPoints(selectedQuestion.points)} điểm
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => deleteQuestion(selectedQuestionIndex)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-600 transition-colors hover:bg-red-100"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Xóa câu
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {selectedQuestion ? (
                            <Suspense
                              fallback={<div className="h-48 animate-pulse rounded-xl bg-surface-container" />}
                            >
                              <ExamQuestionCard
                                key={selectedQuestion.id}
                                question={selectedQuestion}
                                index={selectedQuestionIndex}
                                onChange={updated => updateQuestion(selectedQuestionIndex, updated)}
                                onDelete={() => deleteQuestion(selectedQuestionIndex)}
                                onApproveAi={() => reviewAiQuestion(selectedQuestionIndex, 'APPROVED_AI_QUESTION')}
                                onRejectAi={() => reviewAiQuestion(selectedQuestionIndex, 'REJECTED_AI_QUESTION')}
                                hideHeader
                              />
                            </Suspense>
                          ) : null}
                        </div>
                      )}

                      <button
                        onClick={addQuestion}
                        className="w-full rounded-xl border-2 border-dashed border-primary/30 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary/5"
                      >
                        <span className="inline-flex items-center justify-center gap-2">
                          <Plus className="w-4 h-4" />
                          Thêm câu hỏi thủ công
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Nút hành động */}
                  <div className="sticky bottom-4 z-10">
                    <div className="flex flex-col gap-3 rounded-2xl border border-outline-variant/40 bg-surface/95 p-4 shadow-lg backdrop-blur md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-on-surface">Sẵn sàng lưu bài kiểm tra</p>
                        <p className="mt-1 text-xs text-on-surface-variant">
                          {form.questions.length} câu hỏi · {formatPoints(totalPoints)}/10 điểm · {pointBalanceValid ? 'Cơ cấu điểm hợp lệ' : 'Cần cân lại tổng điểm về 10'}
                        </p>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={cancelEdit}
                          className="px-5 py-2.5 text-sm font-bold text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors"
                        >
                          Hủy
                        </button>
                        <button
                          onClick={saveExam}
                          disabled={saving}
                          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <Save className="w-4 h-4" />
                          {saving ? 'Đang lưu...' : 'Lưu bài kiểm tra'}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </div>
          </div>

        </main>
      </div>
    </div>
  );
}

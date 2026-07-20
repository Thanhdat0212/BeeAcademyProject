import {
  CheckCircle2,
  ChevronDown,
  Circle,
  ExternalLink,
  Headphones,
  Image as ImageIcon,
  Loader2,
  Lock,
  Plus,
  Save,
  X
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import type { QuestionBankResponse } from '../../../api/questionBankService';
import type {
  CreateQuestionRequest, QuestionMetadata,
  QuestionResponse
} from '../../../api/questionService';
import * as questionService from '../../../api/questionService';
import type { TeacherChapterResponse, TeacherCourseResponse } from '../../../api/teacherCourseService';
import { getCourseDetail } from '../../../api/teacherCourseService';
import { notify } from '../../../lib/toast';
import type { Category } from '../../../types/api';

import {
  emptyChoices,
  emptyForm,
  formFromQuestion,
  isAllowedMediaFile,
  isSupportedMediaUrl,
  normalizeQuestionType,
  OBJECTIVE_TYPES,
  questionTypeOptions,
  READING_SET_TYPES,
  truncate,
  type BankQuestionType,
  type FormState,
  type ReadingPassageOption
} from './questionBankUtils';
interface QuestionFormPanelProps {
  open: boolean;
  editing: QuestionResponse | null;
  categories: Category[];
  courses: TeacherCourseResponse[];
  banks: QuestionBankResponse[];
  questions: QuestionResponse[];
  onClose: () => void;
  onSaved: () => void;
}

export default function QuestionFormPanel({ open, editing, categories, courses, banks, questions, onClose, onSaved }: QuestionFormPanelProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [chapters, setChapters] = useState<TeacherChapterResponse[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const availableReadingPassages = useMemo(() => {
    const grouped = new Map<string, ReadingPassageOption>();
    const sourceQuestions = Array.isArray(questions) ? questions : [];

    sourceQuestions.forEach(question => {
      if (editing && question.id === editing.id) return;
      const metadata = question.metadata;
      const readingSetId = metadata?.readingSetId?.trim();
      const sharedPrompt = metadata?.sharedPrompt?.trim();
      if (!readingSetId || !sharedPrompt) return;
      if (form.categoryId && question.categoryId !== form.categoryId) return;
      if (form.grade && question.grade !== Number(form.grade)) return;
      if (form.chapterId && question.chapterId !== form.chapterId) return;

      const existing = grouped.get(readingSetId);
      const questionOrder = metadata?.questionOrderInSet ?? 0;
      if (existing) {
        existing.questionCount += 1;
        existing.maxOrder = Math.max(existing.maxOrder, questionOrder);
        return;
      }

      grouped.set(readingSetId, {
        id: readingSetId,
        title: metadata?.sharedPromptTitle?.trim() || `Bài đọc ${grouped.size + 1}`,
        content: sharedPrompt,
        questionCount: 1,
        maxOrder: questionOrder,
      });
    });

    return Array.from(grouped.values()).sort((left, right) => left.title.localeCompare(right.title, 'vi'));
  }, [questions, editing, form.categoryId, form.grade, form.chapterId]);

  // Reset form when opening a new question or switching the edited question.
  useEffect(() => {
    if (!open) return;
    setForm(editing ? formFromQuestion(editing) : emptyForm());
    setChapters([]);
  }, [open, editing]);

  // Load chapters and sync derived course fields.
  useEffect(() => {
    if (!form.courseId) { setChapters([]); return; }
    setLoadingChapters(true);
    getCourseDetail(form.courseId)
      .then(detail => {
        setChapters(detail.chapters);
        // Always auto-fill category from the selected course.
        // This keeps categoryId aligned with the current course.
        if (detail.categoryId) {
          setForm(f => ({
            ...f,
            categoryId: detail.categoryId!,
            grade: detail.grades?.[0] ? String(detail.grades[0]) : f.grade,
          }));
        }
      })
      .catch(() => notify.error('Không tải được danh sách chương'))
      .finally(() => setLoadingChapters(false));
  }, [form.courseId]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function handleQuestionBankChange(nextQuestionBankId: string) {
    if (!nextQuestionBankId) {
      setForm(f => ({ ...f, questionBankId: '' }));
      return;
    }

    const selectedBank = banks.find(bank => bank.id === nextQuestionBankId);
    if (!selectedBank) {
      setForm(f => ({ ...f, questionBankId: nextQuestionBankId }));
      return;
    }

    const currentCourse = courses.find(course => course.id === form.courseId);
    const courseMatchesBank = !currentCourse
      || (currentCourse.categoryId === selectedBank.categoryId
        && (currentCourse.grades?.includes(selectedBank.grade) ?? false));

    setForm(f => {
      return {
        ...f,
        questionBankId: nextQuestionBankId,
        categoryId: selectedBank.categoryId,
        grade: String(selectedBank.grade),
        courseId: courseMatchesBank ? f.courseId : '',
        chapterId: courseMatchesBank ? f.chapterId : '',
      };
    });

    if (!courseMatchesBank) {
      setChapters([]);
    }
  }

  function handleCourseChange(nextCourseId: string) {
    const selectedCourse = courses.find(c => c.id === nextCourseId);
    if (selectedCourse && form.questionBankId) {
      const selectedBank = banks.find(bank => bank.id === form.questionBankId);
      const matchesBank = !selectedBank
        || (selectedCourse.categoryId === selectedBank.categoryId
          && (selectedCourse.grades?.includes(selectedBank.grade) ?? false));
      if (!matchesBank) {
        notify.error('Khóa học phải cùng môn học và lớp với ngân hàng câu hỏi đã chọn');
        return;
      }
    }

    setForm(f => ({
      ...f,
      courseId: nextCourseId,
      chapterId: '',
      categoryId: selectedCourse?.categoryId ?? f.categoryId,
      grade: selectedCourse?.grades?.[0] ? String(selectedCourse.grades[0]) : f.grade,
    }));
  }

  function handleTypeChange(type: BankQuestionType) {
    setForm(f => ({
      ...f,
      type,
      choices: emptyChoices(type),
      acceptedAnswersText: '',
      matchingPairs: [{ left: '', right: '' }, { left: '', right: '' }],
      sampleAnswer: '',
      wordLimit: '',
      useSharedPrompt: READING_SET_TYPES.includes(type) ? f.useSharedPrompt : false,
      readingMode: READING_SET_TYPES.includes(type) ? f.readingMode : 'existing',
      readingSetId: READING_SET_TYPES.includes(type) ? f.readingSetId : '',
      sharedPromptTitle: READING_SET_TYPES.includes(type) ? f.sharedPromptTitle : '',
      sharedPrompt: READING_SET_TYPES.includes(type) ? f.sharedPrompt : '',
      questionOrderInSet: READING_SET_TYPES.includes(type) ? f.questionOrderInSet : '',
      promptAssetUrl: '',
      transcript: '',
      formulaLatex: '',
      allowedUploadTypesText: 'image/png, image/jpeg',
      maxFiles: '1',
    }));
  }

  function setChoiceCorrect(idx: number) {
    setForm(f => ({
      ...f,
      choices: f.choices.map((c, i) => {
        if (f.type === 'multiple_choice') {
          return i === idx ? { ...c, isCorrect: !c.isCorrect } : c;
        }
        return { ...c, isCorrect: i === idx };
      }),
    }));
  }

  function setChoiceContent(idx: number, value: string) {
    setForm(f => ({
      ...f,
      choices: f.choices.map((c, i) => i === idx ? { ...c, content: value } : c),
    }));
  }

  function addChoice() {
    setForm(f => ({
      ...f,
      choices: [...f.choices, { content: '', isCorrect: false }],
    }));
  }

  function setMatchingPair(idx: number, side: 'left' | 'right', value: string) {
    setForm(f => ({
      ...f,
      matchingPairs: f.matchingPairs.map((pair, i) => (
        i === idx ? { ...pair, [side]: value } : pair
      )),
    }));
  }

  function addMatchingPair() {
    setForm(f => ({
      ...f,
      matchingPairs: [...f.matchingPairs, { left: '', right: '' }],
    }));
  }

  function removeMatchingPair(idx: number) {
    setForm(f => ({
      ...f,
      matchingPairs: f.matchingPairs.filter((_, i) => i !== idx),
    }));
  }

  async function handleImageFileSelected(file?: File | null) {
    if (!file) return;
    if (!isAllowedMediaFile(
      file,
      ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      ['.jpg', '.jpeg', '.png', '.webp'],
    )) {
      notify.error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP');
      return;
    }

    setUploadingImage(true);
    try {
      const uploaded = await questionService.uploadQuestionImage(file);
      if (!uploaded.publicUrl) {
        notify.error('Không nhận được đường dẫn ảnh sau khi tải lên');
        return;
      }
      set('promptAssetUrl', uploaded.publicUrl);
      notify.success('Đã tải ảnh lên');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không tải được ảnh lên';
      notify.error(message);
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleAudioFileSelected(file?: File | null) {
    if (!file) return;
    if (!isAllowedMediaFile(
      file,
      [
        'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
        'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/m4a',
      ],
      ['.mp3', '.wav', '.ogg', '.m4a', '.aac'],
    )) {
      notify.error('Chỉ hỗ trợ audio MP3, WAV, OGG, M4A hoặc AAC');
      return;
    }

    setUploadingAudio(true);
    try {
      const uploaded = await questionService.uploadQuestionAudio(file);
      if (!uploaded.publicUrl) {
        notify.error('Không nhận được đường dẫn audio sau khi tải lên');
        return;
      }
      set('promptAssetUrl', uploaded.publicUrl);
      notify.success('Đã tải audio lên');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không tải được audio lên';
      notify.error(message);
    } finally {
      setUploadingAudio(false);
    }
  }

  function buildMetadata(): QuestionMetadata | null {
    let metadata: QuestionMetadata | null = null;

    switch (form.type) {
      case 'fill_in_blank':
        metadata = {
          acceptedAnswers: form.acceptedAnswersText
            .split('\n')
            .map(value => value.trim())
            .filter(Boolean),
        };
        break;
      case 'matching':
        metadata = {
          matchingPairs: form.matchingPairs
            .filter(pair => pair.left.trim() && pair.right.trim())
            .map(pair => ({ left: pair.left.trim(), right: pair.right.trim() })),
        };
        break;
      case 'essay':
        metadata = {
          sampleAnswer: form.sampleAnswer.trim() || undefined,
          wordLimit: form.wordLimit.trim() ? Number(form.wordLimit) : undefined,
        };
        break;
      case 'image_question':
        metadata = {
          promptAssetUrl: form.promptAssetUrl.trim() || undefined,
        };
        break;
      case 'formula_question':
        metadata = {
          formulaLatex: form.formulaLatex.trim() || undefined,
        };
        break;
      case 'audio_question':
        metadata = {
          promptAssetUrl: form.promptAssetUrl.trim() || undefined,
          transcript: form.transcript.trim() || undefined,
        };
        break;
      case 'file_upload':
        metadata = {
          allowedUploadTypes: form.allowedUploadTypesText
            .split(',')
            .map(value => value.trim())
            .filter(Boolean),
          maxFiles: form.maxFiles ? Number(form.maxFiles) : null,
          sampleAnswer: form.sampleAnswer.trim() || undefined,
        };
        break;
      default:
        metadata = null;
    }

    if (form.useSharedPrompt && READING_SET_TYPES.includes(form.type)) {
      const selectedReading = availableReadingPassages.find(option => option.id === form.readingSetId);
      const generatedReadingSetId = `reading-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const isExistingReading = form.readingMode === 'existing';
      const resolvedReadingSetId = isExistingReading
        ? form.readingSetId.trim()
        : (form.readingSetId.trim() || generatedReadingSetId);
      const resolvedOrder = form.questionOrderInSet.trim()
        ? Number(form.questionOrderInSet)
        : (isExistingReading ? ((selectedReading?.maxOrder ?? 0) + 1) : 1);

      metadata = {
        ...(metadata ?? {}),
        readingSetId: resolvedReadingSetId,
        sharedPromptTitle: isExistingReading
          ? (selectedReading?.title || undefined)
          : (form.sharedPromptTitle.trim() || undefined),
        sharedPrompt: isExistingReading
          ? (selectedReading?.content || undefined)
          : (form.sharedPrompt.trim() || undefined),
        questionOrderInSet: resolvedOrder,
      };
    }

    return metadata && Object.values(metadata).some(value => value != null && value !== '' && (!Array.isArray(value) || value.length > 0))
      ? metadata
      : null;
  }

  function removeChoice(idx: number) {
    setForm(f => {
      const choices = f.choices.filter((_, i) => i !== idx);
      // If the correct answer was removed, keep the first remaining answer selected.
      const hasCorrect = choices.some(c => c.isCorrect);
      if (!hasCorrect && choices.length > 0 && f.type === 'true_false') choices[0].isCorrect = true;
      return { ...f, choices };
    });
  }

  async function handleSave() {
    if (!form.categoryId) { notify.error('Vui lòng chọn môn học'); return; }
    if (!form.grade) { notify.error('Vui lòng chọn lớp'); return; }
    if (!form.content.trim()) { notify.error('Vui lòng nhập nội dung câu hỏi'); return; }
    if (form.defaultPoints.trim()) {
      const points = Number(form.defaultPoints);
      if (!Number.isFinite(points) || points <= 0 || points > 100) {
        notify.error('Điểm mặc định phải từ 0.01 đến 100');
        return;
      }
    }
    if (OBJECTIVE_TYPES.includes(form.type) && form.choices.some(c => !c.content.trim())) { notify.error('Vui lòng điền đầy đủ nội dung các đáp án'); return; }
    if (OBJECTIVE_TYPES.includes(form.type) && !form.choices.some(c => c.isCorrect)) { notify.error('Vui lòng chọn ít nhất 1 đáp án đúng'); return; }
    if (form.type === 'true_false' && form.choices.filter(c => c.isCorrect).length !== 1) { notify.error('Câu đúng/sai phải có đúng 1 đáp án đúng'); return; }
    if (form.type === 'fill_in_blank' && !form.acceptedAnswersText.trim()) { notify.error('Vui lòng nhập ít nhất 1 đáp án chấp nhận cho câu điền chỗ trống'); return; }
    if (form.type === 'matching' && form.matchingPairs.filter(pair => pair.left.trim() && pair.right.trim()).length < 2) { notify.error('Vui lòng tạo ít nhất 2 cặp nối cột hợp lệ'); return; }
    if (form.type === 'image_question' && !form.promptAssetUrl.trim()) { notify.error('Vui lòng tải ảnh lên cho câu hỏi'); return; }
    if (form.type === 'audio_question' && !form.promptAssetUrl.trim()) { notify.error('Vui lòng tải audio lên cho câu hỏi'); return; }
    if (form.useSharedPrompt && READING_SET_TYPES.includes(form.type) && form.readingMode === 'existing' && !form.readingSetId.trim()) { notify.error('Vui lòng chọn bài đọc'); return; }
    if (form.useSharedPrompt && READING_SET_TYPES.includes(form.type) && form.readingMode === 'new' && !form.sharedPromptTitle.trim()) { notify.error('Vui lòng nhập tiêu đề bài đọc'); return; }
    if (form.useSharedPrompt && READING_SET_TYPES.includes(form.type) && form.readingMode === 'new' && !form.sharedPrompt.trim()) { notify.error('Vui lòng nhập nội dung bài đọc'); return; }
    if (form.useSharedPrompt && READING_SET_TYPES.includes(form.type) && form.questionOrderInSet.trim() && Number(form.questionOrderInSet) < 1) { notify.error('Thứ tự câu trong bài đọc phải lớn hơn 0'); return; }
    if (form.type === 'formula_question' && !form.formulaLatex.trim() && !form.content.includes('$')) { notify.error('Vui lòng nhập công thức hoặc chèn công thức trực tiếp vào nội dung câu hỏi'); return; }
    if (form.type === 'file_upload' && !form.allowedUploadTypesText.trim()) { notify.error('Vui lòng nhập loại file được phép nộp'); return; }

    const metadata = buildMetadata();

    const req: CreateQuestionRequest = {
      categoryId:  form.categoryId,
      grade:       Number(form.grade),
      questionBankId: form.questionBankId || undefined,
      chapterId:   form.chapterId || undefined,
      content:     form.content.trim(),
      explanation: form.explanation.trim() || undefined,
      difficulty:  form.difficulty,
      type:        normalizeQuestionType(form.type),
      defaultPoints: form.defaultPoints.trim() ? Number(form.defaultPoints) : null,
      tags: form.tagsText
        .split(',')
        .map(value => value.trim())
        .filter(Boolean),
      metadata,
      choices:     OBJECTIVE_TYPES.includes(form.type)
        ? form.choices.map(c => ({ content: c.content.trim(), isCorrect: c.isCorrect }))
        : [],
    };

    setSaving(true);
    try {
      if (editing) {
        await questionService.updateQuestion(editing.id, req);
        notify.success('Đã cập nhật câu hỏi');
      } else {
        await questionService.createQuestion(req);
        notify.success('Đã thêm câu hỏi vào ngân hàng');
      }
      onSaved();
      onClose();
    } catch {
      notify.error('Không lưu được câu hỏi');
    } finally {
      setSaving(false);
    }
  }

  const isCategoryLocked = Boolean(form.courseId || form.questionBankId);
  const isGradeLocked = Boolean(form.courseId || form.questionBankId);

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.aside
            key="panel"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl bg-surface flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30 flex-shrink-0">
              <h2 className="font-extrabold text-on-surface text-lg">
                {editing ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi mới'}
              </h2>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-container text-on-surface-variant">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Bank, course and chapter */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-on-surface mb-1.5">
                    Ngân hàng câu hỏi <span className="text-xs font-normal text-on-surface-variant">(tùy chọn)</span>
                  </label>
                  <div className="relative">
                    <select
                      value={form.questionBankId}
                      onChange={e => handleQuestionBankChange(e.target.value)}
                      className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary"
                    >
                      <option value="">-- Không gắn ngân hàng cụ thể --</option>
                      {banks.map(bank => (
                        <option key={bank.id} value={bank.id}>
                          {bank.title} · {bank.categoryName} · Lớp {bank.grade}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
                  </div>
                  {form.questionBankId && (
                    <p className="text-xs text-primary/70 mt-1">
                      Môn học và lớp đang được đồng bộ theo ngân hàng đã chọn.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1.5">Khóa học</label>
                  <div className="relative">
                    <select
                      value={form.courseId}
                      onChange={e => handleCourseChange(e.target.value)}
                      className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary"
                    >
                      <option value="">-- Không gắn --</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{truncate(c.title, 40)}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
                  </div>
                  {form.questionBankId && (
                    <p className="text-xs text-on-surface-variant mt-1">
                      Chỉ chọn khóa học cùng môn và lớp với ngân hàng câu hỏi.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1.5">Chương</label>
                  <div className="relative">
                    <select
                      value={form.chapterId}
                      onChange={e => set('chapterId', e.target.value)}
                      disabled={!form.courseId || loadingChapters}
                      className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary disabled:opacity-50"
                    >
                      <option value="">-- Chọn chương --</option>
                      {chapters.map(ch => <option key={ch.id} value={ch.id}>{truncate(ch.title, 40)}</option>)}
                    </select>
                    {loadingChapters
                      ? <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
                      : <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
                    }
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1.5">
                    Lớp <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={form.grade}
                      onChange={e => set('grade', e.target.value)}
                      disabled={isGradeLocked}
                      className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <option value="">-- Chọn lớp --</option>
                      {[6, 7, 8, 9].map(g => <option key={g} value={g}>Lớp {g}</option>)}
                    </select>
                    {isGradeLocked
                      ? <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
                      : <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
                    }
                  </div>
                  {isGradeLocked && (
                    <p className="text-xs text-primary/70 mt-1">
                      {form.questionBankId ? 'Lớp được lấy từ ngân hàng câu hỏi đã chọn' : 'Lớp được lấy từ khóa học đã chọn'}
                    </p>
                  )}
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1.5">
                    Môn học <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={form.categoryId}
                      onChange={e => set('categoryId', e.target.value)}
                      disabled={isCategoryLocked}
                      className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <option value="">-- Chọn môn học --</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {isCategoryLocked
                      ? <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
                      : <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
                    }
                  </div>
                  {isCategoryLocked && (
                    <p className="text-xs text-primary/70 mt-1">
                      {form.questionBankId ? 'Môn học được lấy từ ngân hàng câu hỏi đã chọn' : 'Môn học được lấy từ khóa học đã chọn'}
                    </p>
                  )}
                </div>
              </div>
              {/* Question type */}
              <div>
                <label className="block text-sm font-bold text-on-surface mb-1.5">Loại câu hỏi</label>
                <div className="relative">
                  <select
                    value={form.type}
                    onChange={e => handleTypeChange(e.target.value as BankQuestionType)}
                    className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary"
                  >
                    {questionTypeOptions(form.type).map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
                </div>
              </div>

              {READING_SET_TYPES.includes(form.type) && (
                <div className="space-y-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={form.useSharedPrompt}
                      onChange={e => {
                        const enabled = e.target.checked;
                        setForm(f => ({
                          ...f,
                          useSharedPrompt: enabled,
                          readingMode: enabled ? f.readingMode : 'existing',
                          readingSetId: enabled ? f.readingSetId : '',
                          sharedPromptTitle: enabled ? f.sharedPromptTitle : '',
                          sharedPrompt: enabled ? f.sharedPrompt : '',
                          questionOrderInSet: enabled ? f.questionOrderInSet : '',
                        }));
                      }}
                      className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-bold text-on-surface">Thuộc bài đọc</span>
                  </label>

                  {form.useSharedPrompt && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-bold text-on-surface mb-1.5">Tiêu đề bài đọc</label>
                        <div className="relative">
                          <select
                            value={form.readingMode === 'new' ? '__new__' : form.readingSetId}
                            onChange={e => {
                              const value = e.target.value;
                              if (value === '__new__') {
                                setForm(f => ({
                                  ...f,
                                  readingMode: 'new',
                                  readingSetId: '',
                                  sharedPromptTitle: '',
                                  sharedPrompt: '',
                                  questionOrderInSet: '',
                                }));
                                return;
                              }
                              const selectedReading = availableReadingPassages.find(option => option.id === value);
                              setForm(f => ({
                                ...f,
                                readingMode: 'existing',
                                readingSetId: value,
                                sharedPromptTitle: selectedReading?.title ?? '',
                                sharedPrompt: selectedReading?.content ?? '',
                                questionOrderInSet: selectedReading ? String(selectedReading.maxOrder + 1) : '',
                              }));
                            }}
                            className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary"
                          >
                            <option value="">-- Chọn bài đọc --</option>
                            {availableReadingPassages.map(option => (
                              <option key={option.id} value={option.id}>
                                {option.title} ({option.questionCount} câu)
                              </option>
                            ))}
                            <option value="__new__">+ Tạo bài đọc mới</option>
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
                        </div>
                        <p className="mt-1 text-xs text-on-surface-variant">
                          Nếu chọn bài đọc đã có, hệ thống sẽ tự gắn câu hỏi vào cùng nhóm bài đọc đó.
                        </p>
                      </div>

                      {form.readingMode === 'new' && (
                        <>
                          <div>
                            <label className="block text-sm font-bold text-on-surface mb-1.5">
                              Tiêu đề bài đọc mới <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={form.sharedPromptTitle}
                              onChange={e => set('sharedPromptTitle', e.target.value)}
                              placeholder="Ví dụ: Bài đọc 1"
                              className="w-full px-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-bold text-on-surface mb-1.5">
                              Nội dung bài đọc <span className="text-red-500">*</span>
                            </label>
                            <textarea
                              value={form.sharedPrompt}
                              onChange={e => set('sharedPrompt', e.target.value)}
                              rows={6}
                              placeholder="Nhập nội dung bài đọc dùng chung cho các câu hỏi..."
                              className="w-full px-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary resize-y"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Question content */}
              <div>
                <label className="block text-sm font-bold text-on-surface mb-1.5">
                  Nội dung câu hỏi <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.content}
                  onChange={e => set('content', e.target.value)}
                  rows={4}
                  placeholder="Nhập nội dung câu hỏi..."
                  className="w-full px-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Difficulty */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1.5">Điểm mặc định</label>
                  <input
                    type="number"
                    min={0.01}
                    max={100}
                    step={0.25}
                    value={form.defaultPoints}
                    onChange={e => set('defaultPoints', e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1.5">Tag</label>
                  <input
                    type="text"
                    value={form.tagsText}
                    onChange={e => set('tagsText', e.target.value)}
                    placeholder="Ví dụ: đại số, nhận biết"
                    className="w-full px-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-sm font-bold text-on-surface mb-1.5">Độ khó</label>
                <div className="flex gap-2">
                  {([['easy', 'Dễ', 'text-green-600 border-green-400 bg-green-50'],
                     ['medium', 'Trung bình', 'text-amber-600 border-amber-400 bg-amber-50'],
                     ['hard', 'Khó', 'text-red-600 border-red-400 bg-red-50']] as const).map(
                    ([val, label, activeCls]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => set('difficulty', val)}
                        className={`flex-1 py-2 text-sm font-bold rounded-xl border-2 transition-all ${
                          form.difficulty === val
                            ? activeCls
                            : 'border-outline-variant text-on-surface-variant bg-surface-container hover:bg-surface-container-high'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  )}
                </div>
              </div>

              {OBJECTIVE_TYPES.includes(form.type) && (
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1.5">
                    Đáp án <span className="text-red-500">*</span>
                    <span className="ml-1 text-xs font-normal text-on-surface-variant">
                      {form.type === 'multiple_choice'
                        ? '(có thể chọn một hoặc nhiều đáp án đúng)'
                        : '(click để chọn đáp án đúng)'}
                    </span>
                  </label>
                  <div className="space-y-2">
                    {form.choices.map((choice, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setChoiceCorrect(idx)}
                          className={`flex-shrink-0 w-6 h-6 border-2 flex items-center justify-center transition-colors ${
                            form.type === 'multiple_choice' ? 'rounded-md' : 'rounded-full'
                          } ${
                            choice.isCorrect
                              ? 'border-primary bg-primary text-on-primary'
                              : 'border-outline-variant text-transparent hover:border-primary/50'
                          }`}
                        >
                          {choice.isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5 opacity-0" />}
                        </button>

                        {form.type === 'true_false' ? (
                          <div className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border ${
                            choice.isCorrect ? 'border-primary bg-primary/5 text-primary' : 'border-outline-variant bg-surface-container text-on-surface-variant'
                          }`}>
                            {choice.content}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={choice.content}
                            onChange={e => setChoiceContent(idx, e.target.value)}
                            placeholder={`Đáp án ${String.fromCharCode(65 + idx)}`}
                            className="flex-1 px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary"
                          />
                        )}

                        {['multiple_choice', 'image_question', 'audio_question'].includes(form.type) && form.choices.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeChoice(idx)}
                            className="flex-shrink-0 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {['multiple_choice', 'image_question', 'audio_question'].includes(form.type) && form.choices.length < 6 && (
                    <button
                      type="button"
                      onClick={addChoice}
                      className="mt-2 flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm đáp án
                    </button>
                  )}
                </div>
              )}

              {form.type === 'fill_in_blank' && (
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1.5">
                    Đáp án chấp nhận <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={form.acceptedAnswersText}
                    onChange={e => set('acceptedAnswersText', e.target.value)}
                    rows={4}
                    placeholder={`Mỗi dòng là một đáp án chấp nhận\nVí dụ:\nHà Nội\nha noi`}
                    className="w-full px-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary resize-none"
                  />
                </div>
              )}

              {form.type === 'matching' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-bold text-on-surface">
                      Cặp nối <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={addMatchingPair}
                      className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm cặp
                    </button>
                  </div>
                  <div className="space-y-2">
                    {form.matchingPairs.map((pair, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                        <input
                          type="text"
                          value={pair.left}
                          onChange={e => setMatchingPair(idx, 'left', e.target.value)}
                          placeholder={`Vế trái ${idx + 1}`}
                          className="px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary"
                        />
                        <input
                          type="text"
                          value={pair.right}
                          onChange={e => setMatchingPair(idx, 'right', e.target.value)}
                          placeholder={`Vế phải ${idx + 1}`}
                          className="px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => removeMatchingPair(idx)}
                          disabled={form.matchingPairs.length <= 2}
                          className="px-2.5 py-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {form.type === 'essay' && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-on-surface mb-1.5">Bài mẫu / đáp án gợi ý</label>
                    <textarea
                      value={form.sampleAnswer}
                      onChange={e => set('sampleAnswer', e.target.value)}
                      rows={4}
                      placeholder="Nhập đáp án mẫu hoặc ý chính để hỗ trợ chấm điểm..."
                      className="w-full px-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-on-surface mb-1.5">Giới hạn từ</label>
                      <input
                        type="number"
                        min="1"
                        value={form.wordLimit}
                        onChange={e => set('wordLimit', e.target.value)}
                        placeholder="Ví dụ: 150"
                        className="w-full px-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                </>
              )}

              {form.type === 'image_question' && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-sky-900">Câu hỏi có hình ảnh</p>
                        <p className="text-xs text-sky-700 mt-1">
                          Dùng khi học sinh cần quan sát hình rồi chọn đáp án. Hãy nhập liên kết ảnh công khai
                          có thể truy cập trực tiếp.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-on-surface mb-1.5">
                      Tải ảnh câu hỏi <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant bg-surface-container text-sm font-bold text-on-surface cursor-pointer hover:bg-surface-container-high transition-colors">
                        {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                        {uploadingImage ? 'Đang tải ảnh...' : 'Chọn ảnh và tải lên'}
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                          className="hidden"
                          disabled={uploadingImage}
                          onChange={e => void handleImageFileSelected(e.target.files?.[0] ?? null)}
                        />
                      </label>
                      {form.promptAssetUrl && (
                        <button
                          type="button"
                          onClick={() => set('promptAssetUrl', '')}
                          className="text-sm font-bold text-red-500 hover:underline text-left"
                        >
                          Xóa ảnh đã chọn
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Hỗ trợ JPG, PNG, WEBP. Hệ thống sẽ tự tải file lên storage, bạn không cần nhập URL.
                    </p>
                  </div>

                  {form.promptAssetUrl.trim() && (
                    <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold text-on-surface">Xem trước hình ảnh</p>
                        <a
                          href={form.promptAssetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                        >
                          Mở liên kết <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      {isSupportedMediaUrl(form.promptAssetUrl, ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']) ? (
                        <img
                          src={form.promptAssetUrl}
                          alt="Xem trước câu hỏi hình ảnh"
                          className="w-full max-h-72 object-contain rounded-xl border border-outline-variant/30 bg-white"
                        />
                      ) : (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          Chưa thể xác nhận đây là link ảnh hợp lệ. Bạn vẫn có thể lưu nếu đường dẫn đúng.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {form.type === 'formula_question' && (
                <div>
                    <label className="block text-sm font-bold text-on-surface mb-1.5">Công thức LaTeX</label>
                  <textarea
                    value={form.formulaLatex}
                    onChange={e => set('formulaLatex', e.target.value)}
                    rows={3}
                    placeholder="Ví dụ: x^2 + y^2 = z^2"
                    className="w-full px-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary resize-none"
                  />
                </div>
              )}

              {form.type === 'audio_question' && (
                <>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                        <Headphones className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-emerald-900">Câu hỏi nghe audio</p>
                        <p className="text-xs text-emerald-700 mt-1">
                          Dùng cho bài nghe. Học sinh sẽ nghe file audio rồi chọn đáp án đúng.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-on-surface mb-1.5">
                      Tải audio câu hỏi <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant bg-surface-container text-sm font-bold text-on-surface cursor-pointer hover:bg-surface-container-high transition-colors">
                        {uploadingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Headphones className="w-4 h-4" />}
                        {uploadingAudio ? 'Đang tải audio...' : 'Chọn audio và tải lên'}
                        <input
                          type="file"
                          accept=".mp3,.wav,.ogg,.m4a,.aac,audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/mp4,audio/x-m4a,audio/aac,audio/m4a"
                          className="hidden"
                          disabled={uploadingAudio}
                          onChange={e => void handleAudioFileSelected(e.target.files?.[0] ?? null)}
                        />
                      </label>
                      {form.promptAssetUrl && (
                        <button
                          type="button"
                          onClick={() => set('promptAssetUrl', '')}
                          className="text-sm font-bold text-red-500 hover:underline text-left"
                        >
                          Xóa audio đã chọn
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Hỗ trợ MP3, WAV, OGG, M4A, AAC. Hệ thống sẽ tự tải file lên storage, bạn không cần nhập URL.
                    </p>
                  </div>

                  {form.promptAssetUrl.trim() && (
                    <div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold text-on-surface">Xem trước audio</p>
                        <a
                          href={form.promptAssetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                        >
                          Mở liên kết <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      {isSupportedMediaUrl(form.promptAssetUrl, ['.mp3', '.wav', '.ogg', '.m4a']) ? (
                        <audio
                          controls
                          preload="none"
                          className="w-full"
                          src={form.promptAssetUrl}
                        >
                          Trình duyệt không hỗ trợ phát audio.
                        </audio>
                      ) : (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          Chưa thể xác nhận đây là link audio hợp lệ. Bạn vẫn có thể lưu nếu đường dẫn đúng.
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-bold text-on-surface mb-1.5">
                      Transcript <span className="text-xs font-normal text-on-surface-variant">(khuyến nghị)</span>
                    </label>
                    <textarea
                      value={form.transcript}
                      onChange={e => set('transcript', e.target.value)}
                      rows={4}
                      placeholder="Nhập nội dung lời nghe để hỗ trợ biên tập, kiểm tra và tái sử dụng..."
                      className="w-full px-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary resize-none"
                    />
                  </div>
                </>
              )}

              {form.type === 'file_upload' && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-on-surface mb-1.5">
                      Loại file cho phép <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.allowedUploadTypesText}
                      onChange={e => set('allowedUploadTypesText', e.target.value)}
                      placeholder="image/png, image/jpeg, application/pdf"
                      className="w-full px-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-on-surface mb-1.5">Số file tối đa</label>
                      <input
                        type="number"
                        min="1"
                        value={form.maxFiles}
                        onChange={e => set('maxFiles', e.target.value)}
                        className="w-full px-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-on-surface mb-1.5">Hướng dẫn / bài mẫu</label>
                    <textarea
                      value={form.sampleAnswer}
                      onChange={e => set('sampleAnswer', e.target.value)}
                      rows={3}
                      placeholder="Mô tả yêu cầu nộp bài hoặc tiêu chí đánh giá..."
                      className="w-full px-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary resize-none"
                    />
                  </div>
                </>
              )}

              {/* Explanation */}
              <div>
                <label className="block text-sm font-bold text-on-surface mb-1.5">
                  Giải thích <span className="text-xs font-normal text-on-surface-variant">(tùy chọn)</span>
                </label>
                <textarea
                  value={form.explanation}
                  onChange={e => set('explanation', e.target.value)}
                  rows={3}
                  placeholder="Giải thích tại sao đáp án đó là đúng..."
                  className="w-full px-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-outline-variant/30 flex gap-3 flex-shrink-0">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 text-sm font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 text-sm font-bold bg-primary text-on-primary rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Đang lưu...' : (editing ? 'Cập nhật' : 'Thêm vào ngân hàng')}
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

// Confirm delete dialog

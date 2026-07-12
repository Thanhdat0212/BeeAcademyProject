import TeacherNotificationBell from '../../components/TeacherNotificationBell';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import * as questionService from '../../api/questionService';
import * as questionBankService from '../../api/questionBankService';
import { isApiError } from '../../api/client';
import type {
  QuestionResponse, Difficulty, QuestionStatus, CreateQuestionRequest, QuestionMetadata, MatchingPair,
} from '../../api/questionService';
import type { QuestionBankResponse } from '../../api/questionBankService';
import { listCategories } from '../../api/courseService';
import { listMyCourses, getCourseDetail } from '../../api/teacherCourseService';
import type { TeacherCourseResponse, TeacherChapterResponse } from '../../api/teacherCourseService';
import type { Category } from '../../types/api';
import {
  LayoutDashboard, BookOpen, FileText, HelpCircle,
  Bell, LogOut, Menu, X, Plus, Trash2,
  PenSquare, Landmark, BarChart2, ClipboardList,
  GraduationCap, Megaphone, RefreshCcw, Filter,
  ChevronDown, Zap, TrendingUp, Minus, Database,
  Save, Loader2, CheckCircle2, Circle, FileSpreadsheet, Sparkles, Lock, UserCircle, Star,
  Image as ImageIcon, Headphones, ExternalLink,
} from 'lucide-react';
import ExcelImportModal from './ExcelImportModal';
import AIScanModal from './AIScanModal';

// Navigation and helpers

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Tổng quan',         path: '/teacher'            },
  { icon: BookOpen,        label: 'Khóa học của tôi',  path: '/teacher/courses'    },
  { icon: Star,            label: 'Đánh giá khóa học', path: '/teacher/reviews'    },
  { icon: FileText,        label: 'Bài giảng',         path: '/teacher/content'    },
  { icon: PenSquare,       label: 'Quiz chương',       path: '/teacher/quiz'       },
  { icon: Database,        label: 'Ngân hàng câu hỏi', path: '/teacher/questions'  },
  { icon: GraduationCap,   label: 'Bài kiểm tra',      path: '/teacher/exam'       },
  { icon: ClipboardList,   label: 'Chấm điểm',         path: '/teacher/grades'     },
  { icon: HelpCircle,      label: 'Hỏi & Đáp',         path: '/teacher/qa'         },
  { icon: Megaphone,       label: 'Khiếu nại',         path: '/teacher/complaints' },
  { icon: BarChart2,       label: 'Doanh thu',          path: '/teacher/revenue'    },
  { icon: Landmark,        label: 'TK ngân hàng',       path: '/teacher/bank'       },
  { icon: UserCircle,      label: 'Hồ sơ',              path: '/teacher/profile'    },
  { icon: Lock,            label: 'Tài khoản',          path: '/teacher/account'    },
];

// Small reusable components

function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const config = {
    easy:   { icon: <Minus className="w-3 h-3" />,     label: 'Dễ',         cls: 'bg-green-500/10 text-green-600' },
    medium: { icon: <TrendingUp className="w-3 h-3" />, label: 'Trung bình', cls: 'bg-amber-500/10 text-amber-600' },
    hard:   { icon: <Zap className="w-3 h-3" />,       label: 'Khó',        cls: 'bg-red-500/10 text-red-600'     },
  };
  const { icon, label, cls } = config[difficulty];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap ${cls}`}>
      {icon}{label}
    </span>
  );
}
function truncate(text: string, n: number) {
  return text.length <= n ? text : text.slice(0, n) + '...';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function correctChoiceCount(
  choices: Array<{ isCorrect: boolean | null | undefined }>,
) {
  return choices.filter(choice => Boolean(choice.isCorrect)).length;
}

// Question form panel

interface ChoiceRow { content: string; isCorrect: boolean }
type BankQuestionType = CreateQuestionRequest['type'];

const QUESTION_TYPE_OPTIONS: Array<{ value: BankQuestionType; label: string }> = [
  { value: 'multiple_choice', label: 'Tr\u1eafc nghi\u1ec7m' },
  { value: 'true_false', label: '\u0110\u00fang / Sai' },
  { value: 'fill_in_blank', label: '\u0110i\u1ec1n v\u00e0o ch\u1ed7 tr\u1ed1ng' },
  { value: 'essay', label: 'T\u1ef1 lu\u1eadn chung' },
  { value: 'image_question', label: 'C\u00e2u h\u1ecfi c\u00f3 h\u00ecnh \u1ea3nh' },
  { value: 'audio_question', label: 'C\u00e2u h\u1ecfi nghe audio' },
];
const LEGACY_QUESTION_TYPE_OPTIONS: Array<{ value: BankQuestionType; label: string }> = [
  { value: 'matching', label: 'N\u1ed1i c\u1ed9t (ng\u1eebng d\u00f9ng)' },
  { value: 'formula_question', label: 'C\u00e2u h\u1ecfi c\u00f3 c\u00f4ng th\u1ee9c (ng\u1eebng d\u00f9ng)' },
  { value: 'file_upload', label: 'N\u1ed9p file / \u1ea3nh b\u00e0i l\u00e0m (ng\u1eebng d\u00f9ng)' },
];
const OBJECTIVE_TYPES: BankQuestionType[] = [
  'multiple_choice',
  'true_false',
  'image_question',
  'audio_question',
];
const READING_SET_TYPES: BankQuestionType[] = [
  'multiple_choice',
  'true_false',
  'fill_in_blank',
];
function normalizeQuestionType(type: BankQuestionType): BankQuestionType {
  if (type === 'essay_short' || type === 'essay_long') return 'essay';
  return type;
}
function questionTypeOptions(currentType: BankQuestionType) {
  const normalizedType = normalizeQuestionType(currentType);
  const legacyOption = LEGACY_QUESTION_TYPE_OPTIONS.find(option => option.value === normalizedType);
  return legacyOption ? [...QUESTION_TYPE_OPTIONS, legacyOption] : QUESTION_TYPE_OPTIONS;
}

function emptyChoices(type: BankQuestionType): ChoiceRow[] {
  if (!OBJECTIVE_TYPES.includes(type)) return [];
  if (type === 'true_false') return [
    { content: 'Đúng', isCorrect: true },
    { content: 'Sai',  isCorrect: false },
  ];
  return [
    { content: '', isCorrect: true  },
    { content: '', isCorrect: false },
  ];
}

function typeLabel(type: BankQuestionType, choices?: Array<{ isCorrect: boolean | null | undefined }>) {
  if (type === 'multiple_choice') {
    const hasManyCorrect = (choices ?? []).filter(choice => Boolean(choice.isCorrect)).length > 1;
    return hasManyCorrect ? 'Trắc nghiệm nhiều đáp án' : 'Trắc nghiệm 1 đáp án';
  }
  if (type === 'essay_short' || type === 'essay_long') return 'T\u1ef1 lu\u1eadn chung';
  if (type === 'matching') return 'N\u1ed1i c\u1ed9t (ng\u1eebng d\u00f9ng)';
  if (type === 'formula_question') return 'C\u00e2u h\u1ecfi c\u00f3 c\u00f4ng th\u1ee9c (ng\u1eebng d\u00f9ng)';
  if (type === 'file_upload') return 'N\u1ed9p file / \u1ea3nh b\u00e0i l\u00e0m (ng\u1eebng d\u00f9ng)';
  return QUESTION_TYPE_OPTIONS.find(option => option.value === type)?.label ?? type;
}

function parseLines(values?: string[] | null) {
  return (values ?? []).join('\n');
}

function parseCsv(values?: string[] | null) {
  return (values ?? []).join(', ');
}

function isSupportedMediaUrl(url: string, extensions: string[]) {
  const normalized = url.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.startsWith('data:')) return true;
  return extensions.some(extension => normalized.includes(extension));
}

function hasAllowedFileExtension(fileName: string, extensions: string[]) {
  const normalized = fileName.trim().toLowerCase();
  return extensions.some(extension => normalized.endsWith(extension));
}

function isAllowedMediaFile(file: File, mimeTypes: string[], extensions: string[]) {
  const normalizedMime = file.type.trim().toLowerCase();
  if (normalizedMime && mimeTypes.includes(normalizedMime)) return true;
  return hasAllowedFileExtension(file.name, extensions);
}

interface ReadingPassageOption {
  id: string;
  title: string;
  content: string;
  questionCount: number;
  maxOrder: number;
}

interface FormState {
  questionBankId: string;
  categoryId: string;
  grade: string;
  courseId: string;
  chapterId: string;
  content: string;
  explanation: string;
  difficulty: Difficulty;
  type: BankQuestionType;
  choices: ChoiceRow[];
  acceptedAnswersText: string;
  matchingPairs: MatchingPair[];
  sampleAnswer: string;
  wordLimit: string;
  useSharedPrompt: boolean;
  readingMode: 'existing' | 'new';
  readingSetId: string;
  sharedPromptTitle: string;
  sharedPrompt: string;
  questionOrderInSet: string;
  promptAssetUrl: string;
  transcript: string;
  formulaLatex: string;
  allowedUploadTypesText: string;
  maxFiles: string;
}

function emptyForm(): FormState {
  return {
    questionBankId: '',
    categoryId: '', grade: '', courseId: '', chapterId: '',
    content: '', explanation: '',
    difficulty: 'medium', type: 'multiple_choice',
    choices: emptyChoices('multiple_choice'),
    acceptedAnswersText: '',
    matchingPairs: [{ left: '', right: '' }, { left: '', right: '' }],
    sampleAnswer: '',
    wordLimit: '',
    useSharedPrompt: false,
    readingMode: 'existing',
    readingSetId: '',
    sharedPromptTitle: '',
    sharedPrompt: '',
    questionOrderInSet: '',
    promptAssetUrl: '',
    transcript: '',
    formulaLatex: '',
    allowedUploadTypesText: 'image/png, image/jpeg',
    maxFiles: '1',
  };
}

function formFromQuestion(q: QuestionResponse): FormState {
  const metadata = q.metadata ?? {};
  return {
    questionBankId: q.questionBankId ?? '',
    categoryId:  q.categoryId  ?? '',
    grade:       q.grade ? String(q.grade) : '',
    courseId:    '',
    chapterId:   q.chapterId   ?? '',
    content:     q.content,
    explanation: q.explanation ?? '',
    difficulty:  q.difficulty,
    type:        normalizeQuestionType(q.type),
    choices:     q.choices.map(c => ({ content: c.content, isCorrect: !!c.isCorrect })),
    acceptedAnswersText: parseLines(metadata.acceptedAnswers),
    matchingPairs: metadata.matchingPairs?.length
      ? metadata.matchingPairs.map(pair => ({ left: pair.left, right: pair.right }))
      : [{ left: '', right: '' }, { left: '', right: '' }],
    sampleAnswer: metadata.sampleAnswer ?? '',
    wordLimit: metadata.wordLimit != null ? String(metadata.wordLimit) : '',
    useSharedPrompt: Boolean(metadata.readingSetId || metadata.sharedPrompt),
    readingMode: metadata.readingSetId ? 'existing' : 'new',
    readingSetId: metadata.readingSetId ?? '',
    sharedPromptTitle: metadata.sharedPromptTitle ?? '',
    sharedPrompt: metadata.sharedPrompt ?? '',
    questionOrderInSet: metadata.questionOrderInSet != null ? String(metadata.questionOrderInSet) : '',
    promptAssetUrl: metadata.promptAssetUrl ?? '',
    transcript: metadata.transcript ?? '',
    formulaLatex: metadata.formulaLatex ?? '',
    allowedUploadTypesText: parseCsv(metadata.allowedUploadTypes) || 'image/png, image/jpeg',
    maxFiles: metadata.maxFiles != null ? String(metadata.maxFiles) : '1',
  };
}

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

function QuestionFormPanel({ open, editing, categories, courses, banks, questions, onClose, onSaved }: QuestionFormPanelProps) {
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

function ConfirmDeleteDialog({
  question, onConfirm, onCancel,
}: { question: QuestionResponse | null; onConfirm: () => void; onCancel: () => void }) {
  return (
    <AnimatePresence>
      {question && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm"
          >
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-center font-extrabold text-on-surface mb-2">Xóa câu hỏi?</h3>
            <p className="text-center text-sm text-on-surface-variant mb-5">
              "{truncate(question.content, 80)}"
            </p>
            <div className="flex gap-3">
              <button onClick={onCancel} className="flex-1 py-2.5 text-sm font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded-xl">
                Hủy
              </button>
              <button onClick={onConfirm} className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl">
                Xóa
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ConfirmBulkDeleteDialog({
  count, deleting, onConfirm, onCancel,
}: { count: number; deleting: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={deleting ? undefined : onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm"
          >
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-center font-extrabold text-on-surface mb-2">Xóa câu hỏi đã chọn?</h3>
            <p className="text-center text-sm text-on-surface-variant mb-5">
              Bạn đang chọn <span className="font-bold text-on-surface">{count}</span> câu hỏi. Thao tác này sẽ xóa hoặc tạm ẩn câu hỏi đã được dùng.
            </p>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                disabled={deleting}
                className="flex-1 py-2.5 text-sm font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded-xl disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={onConfirm}
                disabled={deleting}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {deleting ? 'Đang xóa...' : 'Xóa tất cả'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function QuestionBankCreateDialog({
  open,
  categories,
  onClose,
  onCreated,
}: {
  open: boolean;
  categories: Category[];
  onClose: () => void;
  onCreated: (bank: QuestionBankResponse) => void;
}) {
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [grade, setGrade] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setCategoryId('');
    setGrade('');
    setDescription('');
    setSaving(false);
  }, [open]);

  async function handleSave() {
    if (!title.trim()) {
      notify.error('Vui lòng nhập tên ngân hàng câu hỏi');
      return;
    }
    if (!categoryId) {
      notify.error('Vui lòng chọn lĩnh vực / môn học');
      return;
    }
    if (!grade) {
      notify.error('Vui lòng chọn lớp');
      return;
    }

    setSaving(true);
    try {
      const created = await questionBankService.createQuestionBank({
        title: title.trim(),
        categoryId,
        grade: Number(grade),
        description: description.trim() || undefined,
      });
      notify.success('Đã tạo ngân hàng câu hỏi');
      onCreated(created);
      onClose();
    } catch (error) {
      notify.error(isApiError(error) ? error.message : 'Không tạo được ngân hàng câu hỏi');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={saving ? undefined : onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="fixed z-50 top-1/2 left-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-surface p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h3 className="text-xl font-extrabold text-on-surface">Tạo ngân hàng câu hỏi</h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  Khởi tạo bank rỗng để tiếp tục bổ sung câu hỏi ở bước sau.
                </p>
              </div>
              <button
                onClick={onClose}
                disabled={saving}
                className="p-2 rounded-xl hover:bg-surface-container text-on-surface-variant disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-on-surface mb-1.5">
                  Tên ngân hàng <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ví dụ: Ngân hàng Toán lớp 8 - Đại số"
                  className="w-full px-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1.5">
                    Lĩnh vực / môn học <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={categoryId}
                      onChange={e => setCategoryId(e.target.value)}
                      className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary"
                    >
                      <option value="">-- Chọn môn học --</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1.5">
                    Lớp <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={grade}
                      onChange={e => setGrade(e.target.value)}
                      className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary"
                    >
                      <option value="">-- Chọn lớp --</option>
                      {[6, 7, 8, 9].map(item => <option key={item} value={item}>Lớp {item}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-on-surface mb-1.5">
                  Mô tả <span className="text-xs font-normal text-on-surface-variant">(tùy chọn)</span>
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Mô tả phạm vi câu hỏi, mục tiêu sử dụng hoặc ghi chú biên soạn..."
                  className="w-full px-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary resize-none"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={onClose}
                disabled={saving}
                className="flex-1 py-2.5 text-sm font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded-xl disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 text-sm font-bold bg-primary text-on-primary rounded-xl hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Đang tạo...' : 'Tạo ngân hàng'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Main page

const DIFFICULTY_OPTS = [
  { value: 'all'   as const, label: 'Tất cả độ khó' },
  { value: 'easy'  as const, label: 'Dễ' },
  { value: 'medium'as const, label: 'Trung bình' },
  { value: 'hard'  as const, label: 'Khó' },
];

const STATUS_OPTS = [
  { value: 'all'     as const, label: 'Tất cả trạng thái' },
  { value: 'active'  as const, label: 'Đang dùng' },
  { value: 'inactive'as const, label: 'Tạm ẩn' },
];

const QUESTION_TYPE_FILTER_OPTS: Array<{ value: BankQuestionType | 'all'; label: string }> = [
  { value: 'all', label: 'Tất cả loại câu hỏi' },
  ...QUESTION_TYPE_OPTIONS,
];

function questionTypeFilterLabel(value: BankQuestionType | 'all', fallback: string) {
  if (value === 'all') return 'T\u1ea5t c\u1ea3 lo\u1ea1i c\u00e2u h\u1ecfi';
  return fallback;
}

export default function QuestionBankPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const logout  = useAuthStore(s => s.logout);
  const user    = useAuthStore(s => s.user);

  // Data
  const [questions,   setQuestions]   = useState<QuestionResponse[]>([]);
  const [banks,       setBanks]       = useState<QuestionBankResponse[]>([]);
  // totalItems stores the real total from the backend, even when the fetch is limited.
  // It is used to warn teachers when the current client list is truncated.
  const [totalItems,  setTotalItems]  = useState(0);
  const [categories,  setCategories]  = useState<Category[]>([]);
  const [courses,     setCourses]     = useState<TeacherCourseResponse[]>([]);
  const [allChapters, setAllChapters] = useState<TeacherChapterResponse[]>([]);

  // Loading
  const [loadingQ,    setLoadingQ]    = useState(true);
  const [loadingBanks,setLoadingBanks]= useState(true);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Filters
  const [diffFilter,    setDiffFilter]    = useState<Difficulty | 'all'>('all');
  const [statusFilter,  setStatusFilter]  = useState<QuestionStatus | 'all'>('all');
  const [typeFilter,    setTypeFilter]    = useState<BankQuestionType | 'all'>('all');
  const [bankFilter,    setBankFilter]    = useState('');
  const [categoryFilter,setCategoryFilter]= useState('');
  const [gradeFilter,   setGradeFilter]   = useState('');
  const [courseFilter,  setCourseFilter]  = useState('');
  const [chapterFilter, setChapterFilter] = useState('');

  // Panel and dialog state
  const [isSidebarOpen,  setIsSidebarOpen]  = useState(false);
  const [panelOpen,      setPanelOpen]      = useState(false);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [importOpen,     setImportOpen]     = useState(false);
  const [aiScanOpen,     setAiScanOpen]     = useState(false);
  const [editingQ,       setEditingQ]       = useState<QuestionResponse | null>(null);
  const [deleteTarget,   setDeleteTarget]   = useState<QuestionResponse | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting,   setBulkDeleting]   = useState(false);
  const [selectedIds,    setSelectedIds]    = useState<string[]>([]);

  // Load metadata (categories and courses) once.
  // The cancelled flag prevents duplicate StrictMode side effects and stale state updates.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listCategories(),
      listMyCourses(0, 100).then(p => p.items),
    ])
      .then(([cats, crs]) => {
        if (cancelled) return;
        setCategories(cats);
        setCourses(crs);
      })
      .catch(() => { if (!cancelled) notify.error('Không tải được danh sách môn học / khóa học'); })
      .finally(() => { if (!cancelled) setLoadingMeta(false); });
    return () => { cancelled = true; };
  }, []);

  // Load chapters when a course filter is selected.
  useEffect(() => {
    if (!courseFilter) { setAllChapters([]); setChapterFilter(''); return; }
    getCourseDetail(courseFilter)
      .then(d => {
        setAllChapters(d.chapters);
        setCategoryFilter(d.categoryId ?? '');
        setGradeFilter(d.grades?.[0] ? String(d.grades[0]) : '');
      })
      .catch(() => {});
    setChapterFilter('');
  }, [courseFilter]);

  // Per-request fetch limit for the question bank.
  const FETCH_LIMIT = 200;

  // refreshKey is incremented to trigger a manual reload after save/delete actions.
  const [refreshKey, setRefreshKey] = useState(0);
  const [bankRefreshKey, setBankRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadingBanks(true);
    questionBankService.listQuestionBanks()
      .then(items => {
        if (cancelled) return;
        setBanks(items);
      })
      .catch(() => {
        if (!cancelled) notify.error('Không tải được danh sách ngân hàng câu hỏi');
      })
      .finally(() => {
        if (!cancelled) setLoadingBanks(false);
      });
    return () => { cancelled = true; };
  }, [bankRefreshKey]);

  // Load questions with a cancellable effect to avoid stale updates in StrictMode.
  useEffect(() => {
    let cancelled = false;
    setLoadingQ(true);

    const params: questionService.ListQuestionsParams = { page: 0, size: FETCH_LIMIT };
    if (diffFilter    !== 'all') params.difficulty = diffFilter;
    if (statusFilter  !== 'all') params.status     = statusFilter;
    if (bankFilter)              params.questionBankId = bankFilter;
    if (categoryFilter)          params.categoryId = categoryFilter;
    if (gradeFilter)             params.grade      = Number(gradeFilter);
    if (chapterFilter)           params.chapterId  = chapterFilter;

    questionService.listQuestions(params)
      .then(pageResult => {
        if (cancelled) return;
        const filteredItems = pageResult.items.filter(q => {
          if (categoryFilter && q.categoryId !== categoryFilter) return false;
          if (gradeFilter && q.grade !== Number(gradeFilter)) return false;
          if (chapterFilter && q.chapterId !== chapterFilter) return false;
          if (diffFilter !== 'all' && q.difficulty !== diffFilter) return false;
          if (statusFilter !== 'all' && q.status !== statusFilter) return false;
          if (bankFilter && q.questionBankId !== bankFilter) return false;
          return true;
        });
        setQuestions(filteredItems);
        setSelectedIds(prev => prev.filter(id => filteredItems.some(q => q.id === id)));
        // Save the backend total to detect silent truncation at the fetch limit.
        setTotalItems(pageResult.totalItems);
      })
      .catch(() => { if (!cancelled) notify.error('Không tải được danh sách câu hỏi'); })
      .finally(() => { if (!cancelled) setLoadingQ(false); });

    return () => { cancelled = true; };
  }, [diffFilter, statusFilter, bankFilter, categoryFilter, gradeFilter, chapterFilter, refreshKey]);

  // Expose a stable reload callback for save/delete flows.
  const loadQuestions = useCallback(() => setRefreshKey(k => k + 1), []);
  const reloadPageData = useCallback(() => {
    loadQuestions();
    setBankRefreshKey(k => k + 1);
  }, [loadQuestions]);

  const filteredQuestions = typeFilter === 'all'
    ? questions
    : questions.filter(question => question.type === typeFilter);

  useEffect(() => {
    setSelectedIds(prev => prev.filter(id => filteredQuestions.some(question => question.id === id)));
  }, [filteredQuestions]);

  // Actions
  function openAdd()  { setEditingQ(null); setPanelOpen(true); }
  function openEdit(q: QuestionResponse) { setEditingQ(q); setPanelOpen(true); }
  function handleQuestionBankCreated(bank: QuestionBankResponse) {
    setBankFilter(bank.id);
    setBankRefreshKey(key => key + 1);
  }

  const allQuestionIds = filteredQuestions.map(q => q.id);
  const selectedCount = selectedIds.length;
  const allSelected = allQuestionIds.length > 0 && allQuestionIds.every(id => selectedIds.includes(id));

  function toggleSelectQuestion(questionId: string) {
    setSelectedIds(prev =>
      prev.includes(questionId)
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId],
    );
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? [] : allQuestionIds);
  }

  async function confirmBulkDelete() {
    if (selectedIds.length === 0) return;
    setBulkDeleting(true);
    const idsToDelete = [...selectedIds];
    const results = await Promise.allSettled(idsToDelete.map(id => questionService.deleteQuestion(id)));
    const deleted = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - deleted;

    if (deleted > 0) notify.success(`Đã xóa ${deleted} câu hỏi`);
    if (failed > 0) notify.error(`${failed} câu hỏi chưa xóa được`);

    setBulkDeleting(false);
    setBulkDeleteOpen(false);
    setSelectedIds([]);
    reloadPageData();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await questionService.deleteQuestion(deleteTarget.id);
      notify.success('Đã xóa câu hỏi');
      setDeleteTarget(null);
      reloadPageData();
    } catch {
      notify.error('Không xóa được câu hỏi');
    }
  }

  function handleLogout() { logout(); navigate('/login'); }

  // Stats
  const stats = {
    total:  filteredQuestions.length,
    easy:   filteredQuestions.filter(q => q.difficulty === 'easy').length,
    medium: filteredQuestions.filter(q => q.difficulty === 'medium').length,
    hard:   filteredQuestions.filter(q => q.difficulty === 'hard').length,
  };

  const selectedBank = banks.find(bank => bank.id === bankFilter) ?? null;
  const hasFilter = diffFilter !== 'all'
    || statusFilter !== 'all'
    || typeFilter !== 'all'
    || bankFilter
    || categoryFilter
    || gradeFilter
    || courseFilter
    || chapterFilter;

  // Render
  return (
    <div className="min-h-screen bg-surface flex font-sans">

      {isSidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64
        bg-surface-container-lowest border-r border-outline-variant/30
        flex flex-col transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:flex
      `}>
        <div className="p-6 flex items-center justify-between border-b border-outline-variant/20">
          <Link to="/teacher" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary text-on-primary rounded-xl flex items-center justify-center font-extrabold text-lg shadow-md shadow-primary/20">B</div>
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
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                  active ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
                {active && <div className="ml-auto w-2 h-2 bg-primary rounded-full" />}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-outline-variant/20">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors text-left"
          >
            <LogOut className="w-5 h-5" /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="sticky top-0 z-20 h-16 bg-surface/90 backdrop-blur-md border-b border-outline-variant/30 flex items-center justify-between px-4 md:px-6 shadow-sm">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-on-surface-variant hover:bg-surface-container rounded-lg">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-extrabold text-on-surface text-lg hidden lg:block">Ngân hàng câu hỏi</h1>
          <div className="flex items-center gap-4 ml-auto">
            <TeacherNotificationBell />
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-on-surface leading-none">{user?.name ?? 'Giáo viên'}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">Giáo viên</p>
              </div>
              <img
                src={user?.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? 'GV')}&background=7c3aed&color=fff&bold=true&size=64`}
                alt="Avatar" className="w-9 h-9 rounded-full object-cover border-2 border-primary/30"
              />
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">

          {/* Title + nút thêm */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-start justify-between gap-4 mb-5 flex-wrap"
          >
            <div>
              <h2 className="text-2xl font-extrabold text-on-surface">Ngân hàng câu hỏi</h2>
              {!loadingQ && (
                <p className="text-on-surface-variant mt-1 text-sm">
                  {/* Nếu totalItems > FETCH_LIMIT: hiển thị số thật để GV biết đang bị cắt */}
                  <span className="font-bold text-on-surface">
                    {totalItems > FETCH_LIMIT ? `${stats.total}/${totalItems}` : stats.total}
                  </span> câu hỏi
                  {stats.total > 0 && (
                    <span className="ml-2 text-on-surface-variant/60">
                      · {stats.easy} dễ · {stats.medium} trung bình · {stats.hard} khó
                    </span>
                  )}
                  {selectedBank && (
                    <span className="ml-2 text-primary/80">
                      · đang xem bank: {selectedBank.title}
                    </span>
                  )}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedCount > 0 && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-2 py-1">
                  <span className="text-xs font-bold text-red-700 px-1">{selectedCount} đã chọn</span>
                  <button
                    onClick={() => setSelectedIds([])}
                    className="text-xs font-bold text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-100"
                  >
                    Bỏ chọn
                  </button>
                  <button
                    onClick={() => setBulkDeleteOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Xóa đã chọn
                  </button>
                </div>
              )}
              <button onClick={reloadPageData} disabled={loadingQ}
                className="p-2.5 text-on-surface-variant hover:text-primary hover:bg-primary/5 rounded-xl transition-colors"
                title="Làm mới"
              >
                <RefreshCcw className={`w-5 h-5 ${loadingQ ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setBankDialogOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors shadow-md shadow-amber-500/20"
              >
                <Plus className="w-4 h-4" /> Tạo bank
              </button>
              <button
                onClick={() => setAiScanOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 transition-colors shadow-md shadow-violet-500/20"
              >
                <Sparkles className="w-4 h-4" /> Scan PDF
              </button>
              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors shadow-md shadow-green-500/20"
              >
                <FileSpreadsheet className="w-4 h-4" /> Import Excel
              </button>
              <button onClick={openAdd}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
              >
                <Plus className="w-5 h-5" /> Thêm câu hỏi
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.02 }}
            className="mb-5 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
              <div>
                <h3 className="text-lg font-extrabold text-on-surface">Danh sách question bank</h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  Tạo bank rỗng, chọn đúng môn học và lớp, rồi tiếp tục bổ sung câu hỏi vào từng bank.
                </p>
              </div>
              <button
                onClick={() => setBankDialogOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-primary bg-primary/10 rounded-xl hover:bg-primary/15 transition-colors"
              >
                <Plus className="w-4 h-4" /> Ngân hàng mới
              </button>
            </div>

            {loadingBanks ? (
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Đang tải danh sách ngân hàng câu hỏi...
              </div>
            ) : banks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-outline-variant/50 bg-surface px-4 py-8 text-center">
                <Database className="w-10 h-10 text-on-surface-variant/30 mx-auto mb-3" />
                <p className="font-bold text-on-surface">Chưa có question bank nào</p>
                <p className="text-sm text-on-surface-variant mt-1 mb-4">
                  Tạo bank đầu tiên để quản lý câu hỏi theo từng nhóm nội dung.
                </p>
                <button
                  onClick={() => setBankDialogOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary font-bold rounded-xl hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Tạo question bank
                </button>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <button
                  onClick={() => setBankFilter('')}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    !bankFilter
                      ? 'border-primary bg-primary/5'
                      : 'border-outline-variant/40 bg-surface hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-extrabold text-on-surface">Tất cả câu hỏi</p>
                      <p className="text-xs text-on-surface-variant mt-1">
                        Bỏ lọc theo question bank
                      </p>
                    </div>
                    <span className="inline-flex rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                      {banks.length} bank
                    </span>
                  </div>
                </button>

                {banks.map(bank => (
                  <button
                    key={bank.id}
                    onClick={() => setBankFilter(current => current === bank.id ? '' : bank.id)}
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      bankFilter === bank.id
                        ? 'border-primary bg-primary/5'
                        : 'border-outline-variant/40 bg-surface hover:bg-surface-container'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-on-surface truncate">{bank.title}</p>
                        <p className="text-xs text-on-surface-variant mt-1">
                          {bank.categoryName} · Lớp {bank.grade}
                        </p>
                      </div>
                      <span className="inline-flex rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary whitespace-nowrap">
                        {bank.questionCount} câu
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-on-surface-variant line-clamp-2">
                      {bank.description?.trim() || 'Chưa có mô tả cho ngân hàng này.'}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${
                        bank.status === 'active' ? 'bg-green-500/10 text-green-600' : 'bg-slate-500/10 text-slate-500'
                      }`}>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {bank.status === 'active' ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        {formatDate(bank.createdAt)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Filter bar */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
            className="flex items-center gap-3 mb-5 flex-wrap"
          >
            <div className="flex items-center gap-1.5 text-on-surface-variant">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">Lọc:</span>
            </div>

            <div className="relative">
              <select value={bankFilter} onChange={e => setBankFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface font-medium focus:outline-none focus:border-primary cursor-pointer max-w-[240px]"
              >
                <option value="">Tất cả question bank</option>
                {banks.map(bank => (
                  <option key={bank.id} value={bank.id}>{bank.title}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
            </div>

            <div className="relative">
              <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setCourseFilter(''); setChapterFilter(''); }}
                className="appearance-none pl-3 pr-8 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface font-medium focus:outline-none focus:border-primary cursor-pointer max-w-[180px]"
              >
                <option value="">Tất cả môn</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
            </div>

            <div className="relative">
              <select value={gradeFilter} onChange={e => { setGradeFilter(e.target.value); setCourseFilter(''); setChapterFilter(''); }}
                className="appearance-none pl-3 pr-8 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface font-medium focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="">Tất cả lớp</option>
                {[6, 7, 8, 9].map(g => <option key={g} value={g}>Lớp {g}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
            </div>

            {/* Khóa học */}
            <div className="relative">
              <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface font-medium focus:outline-none focus:border-primary cursor-pointer max-w-[180px]"
              >
                <option value="">Tất cả khóa học</option>
                {courses.map(c => <option key={c.id} value={c.id}>{truncate(c.title, 30)}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
            </div>

            {/* Chương (chỉ hiện khi đã chọn khóa học) */}
            {courseFilter && (
              <div className="relative">
                <select value={chapterFilter} onChange={e => setChapterFilter(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface font-medium focus:outline-none focus:border-primary cursor-pointer max-w-[180px]"
                >
                  <option value="">Tất cả chương</option>
                  {allChapters.map(ch => <option key={ch.id} value={ch.id}>{truncate(ch.title, 30)}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
              </div>
            )}

            {/* Độ khó */}
            <div className="relative">
              <select value={diffFilter} onChange={e => setDiffFilter(e.target.value as Difficulty | 'all')}
                className="appearance-none pl-3 pr-8 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface font-medium focus:outline-none focus:border-primary cursor-pointer"
              >
                {DIFFICULTY_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
            </div>

            <div className="relative">
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as BankQuestionType | 'all')}
                className="appearance-none pl-3 pr-8 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface font-medium focus:outline-none focus:border-primary cursor-pointer max-w-[220px]"
              >
                {QUESTION_TYPE_FILTER_OPTS.map(option => (
                  <option key={option.value} value={option.value}>
                    {questionTypeFilterLabel(option.value, option.label)}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
            </div>

            {/* Trạng thái */}
            <div className="relative">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as QuestionStatus | 'all')}
                className="appearance-none pl-3 pr-8 py-2 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface font-medium focus:outline-none focus:border-primary cursor-pointer"
              >
                {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
            </div>

            {hasFilter && (
              <button
                onClick={() => { setDiffFilter('all'); setStatusFilter('all'); setTypeFilter('all'); setBankFilter(''); setCategoryFilter(''); setGradeFilter(''); setCourseFilter(''); setChapterFilter(''); }}
                className="text-xs font-bold text-primary hover:underline"
              >
                Xóa bộ lọc
              </button>
            )}
          </motion.div>

          {/* Cảnh báo khi ngân hàng vượt giới hạn fetch để giáo viên thu hẹp bằng bộ lọc. */}
          {!loadingQ && totalItems > FETCH_LIMIT && (
            <div className="mb-4 flex items-start gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-sm text-amber-700">
              <span className="font-bold whitespace-nowrap">Lưu ý:</span>
              <span>
                Ngân hàng có <strong>{totalItems}</strong> câu hỏi nhưng chỉ hiển thị{' '}
                <strong>{FETCH_LIMIT}</strong> câu đầu tiên.
                Dùng bộ lọc Khóa học / Chương để thu hẹp kết quả và xem đầy đủ.
              </span>
            </div>
          )}

          {/* Loading */}
          {loadingQ && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <svg className="animate-spin w-10 h-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <p className="text-on-surface-variant font-medium">Đang tải ngân hàng câu hỏi...</p>
            </div>
          )}

          {/* Bảng câu hỏi */}
          {!loadingQ && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
              className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl overflow-hidden shadow-sm"
            >
              {filteredQuestions.length === 0 ? (
                <div className="py-20 text-center">
                  <Database className="w-14 h-14 text-on-surface-variant/30 mx-auto mb-4" />
                  <p className="text-on-surface-variant font-medium text-lg">Chưa có câu hỏi nào</p>
                  <p className="text-on-surface-variant/70 text-sm mt-1 mb-5">
                    {hasFilter ? 'Không có câu hỏi khớp bộ lọc hiện tại' : 'Thêm câu hỏi để cấu hình quiz cho từng chương'}
                  </p>
                  {!hasFilter && (
                    <button onClick={openAdd}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
                    >
                      <Plus className="w-4 h-4" /> Thêm câu hỏi đầu tiên
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-outline-variant/20 bg-surface-container/50">
                        <th className="text-center px-4 py-3 w-12">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={toggleSelectAll}
                            aria-label="Chọn tất cả câu hỏi"
                            className="w-4 h-4 rounded border-outline-variant accent-primary cursor-pointer"
                          />
                        </th>
                        <th className="text-left px-5 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide w-[32%]">Nội dung câu hỏi</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Loại câu hỏi</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Độ khó</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden md:table-cell">Chương</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden md:table-cell">Môn</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden xl:table-cell">Question bank</th>
                        <th className="text-center px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden lg:table-cell">Dùng</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden lg:table-cell">Ngày tạo</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Trạng thái</th>
                        <th className="text-center px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {filteredQuestions.map((q, idx) => (
                          <motion.tr key={q.id}
                            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.025 }}
                            className={`border-b border-outline-variant/10 hover:bg-surface-container/30 transition-colors ${
                              selectedIds.includes(q.id) ? 'bg-primary/5' : (idx % 2 !== 0 ? 'bg-surface-container/15' : '')
                            }`}
                          >
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(q.id)}
                                onChange={() => toggleSelectQuestion(q.id)}
                                aria-label={`Chọn câu hỏi ${idx + 1}`}
                                className="w-4 h-4 rounded border-outline-variant accent-primary cursor-pointer"
                              />
                            </td>
                            <td className="px-5 py-3">
                              <p className="text-on-surface font-medium leading-snug">{truncate(q.content, 100)}</p>
                              <p className="text-xs text-on-surface-variant mt-0.5">
                                {q.choices.length > 0 && `${q.choices.length} đáp án`}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-medium text-on-surface">
                                {typeLabel(q.type, q.choices)}
                              </span>
                            </td>
                            <td className="px-4 py-3"><DifficultyBadge difficulty={q.difficulty} /></td>
                            <td className="px-4 py-3 text-on-surface-variant hidden md:table-cell text-xs">
                              {q.chapterTitle ?? <span className="opacity-30">-</span>}
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              {q.categoryName
                                ? <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-full">{q.categoryName}</span>
                                : <span className="text-on-surface-variant/30 text-xs">-</span>}
                            </td>
                            <td className="px-4 py-3 hidden xl:table-cell text-xs text-on-surface-variant">
                              {q.questionBankTitle
                                ? <span className="font-medium text-on-surface">{truncate(q.questionBankTitle, 28)}</span>
                                : <span className="opacity-30">-</span>}
                            </td>
                            <td className="px-4 py-3 text-center hidden lg:table-cell">
                              <span className={`font-bold text-sm ${q.usageCount > 0 ? 'text-primary' : 'text-on-surface-variant/40'}`}>
                                {q.usageCount}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-on-surface-variant text-xs hidden lg:table-cell whitespace-nowrap">
                              {formatDate(q.createdAt)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                                q.status === 'active' ? 'bg-green-500/10 text-green-600' : 'bg-slate-500/10 text-slate-500'
                              }`}>
                                {q.status === 'active' ? 'Đang dùng' : 'Tạm ẩn'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => openEdit(q)}
                                  className="px-2.5 py-1.5 text-xs font-bold text-blue-500 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
                                >
                                  Sửa
                                </button>
                                <button onClick={() => setDeleteTarget(q)}
                                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Xóa câu hỏi"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}
        </main>
      </div>

      {/* Form Panel */}
      <QuestionFormPanel
        open={panelOpen}
        editing={editingQ}
        categories={categories}
        courses={courses}
        banks={banks}
        questions={questions}
        onClose={() => setPanelOpen(false)}
        onSaved={reloadPageData}
      />

      <QuestionBankCreateDialog
        open={bankDialogOpen}
        categories={categories}
        onClose={() => setBankDialogOpen(false)}
        onCreated={handleQuestionBankCreated}
      />

      {/* Delete Dialog */}
      <ConfirmDeleteDialog
        question={deleteTarget}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmBulkDeleteDialog
        count={bulkDeleteOpen ? selectedCount : 0}
        deleting={bulkDeleting}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
      />

      {/* Excel Import Modal */}
      <ExcelImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={reloadPageData}
        selectedQuestionBank={selectedBank}
      />

      {/* AI Scan Modal */}
      <AIScanModal
        open={aiScanOpen}
        onClose={() => setAiScanOpen(false)}
        onImported={reloadPageData}
        selectedQuestionBank={selectedBank}
      />
    </div>
  );
}

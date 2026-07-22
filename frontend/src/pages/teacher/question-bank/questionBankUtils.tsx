import {
  Minus,
  TrendingUp,
  Zap
} from 'lucide-react';
import type {
  CreateQuestionRequest,
  Difficulty,
  MatchingPair,
  QuestionResponse
} from '../../../api/questionService';

export function ModalLoadingFallback() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" role="status" aria-label="Đang tải">
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-white/30 border-t-white" />
    </div>
  );
}

// Small reusable components

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
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
export function truncate(text: string, n: number) {
  return text.length <= n ? text : text.slice(0, n) + '...';
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Question form panel

export interface ChoiceRow { content: string; isCorrect: boolean; imageUrl?: string }
export type BankQuestionType = CreateQuestionRequest['type'];

export const QUESTION_TYPE_OPTIONS: Array<{ value: BankQuestionType; label: string }> = [
  { value: 'multiple_choice', label: 'Tr\u1eafc nghi\u1ec7m' },
  { value: 'true_false', label: '\u0110\u00fang / Sai' },
  { value: 'fill_in_blank', label: '\u0110i\u1ec1n v\u00e0o ch\u1ed7 tr\u1ed1ng' },
  { value: 'essay', label: 'T\u1ef1 lu\u1eadn chung' },
  { value: 'image_question', label: 'C\u00e2u h\u1ecfi c\u00f3 h\u00ecnh \u1ea3nh' },
  { value: 'audio_question', label: 'C\u00e2u h\u1ecfi nghe audio' },
];
export const LEGACY_QUESTION_TYPE_OPTIONS: Array<{ value: BankQuestionType; label: string }> = [
  { value: 'matching', label: 'N\u1ed1i c\u1ed9t (ng\u1eebng d\u00f9ng)' },
  { value: 'formula_question', label: 'C\u00e2u h\u1ecfi c\u00f3 c\u00f4ng th\u1ee9c (ng\u1eebng d\u00f9ng)' },
  { value: 'file_upload', label: 'N\u1ed9p file / \u1ea3nh b\u00e0i l\u00e0m (ng\u1eebng d\u00f9ng)' },
];
export const OBJECTIVE_TYPES: BankQuestionType[] = [
  'multiple_choice',
  'true_false',
  'image_question',
  'audio_question',
];
export const READING_SET_TYPES: BankQuestionType[] = [
  'multiple_choice',
  'true_false',
  'fill_in_blank',
];
export function normalizeQuestionType(type: BankQuestionType): BankQuestionType {
  if (type === 'essay_short' || type === 'essay_long') return 'essay';
  return type;
}
export function questionTypeOptions(currentType: BankQuestionType) {
  const normalizedType = normalizeQuestionType(currentType);
  const legacyOption = LEGACY_QUESTION_TYPE_OPTIONS.find(option => option.value === normalizedType);
  return legacyOption ? [...QUESTION_TYPE_OPTIONS, legacyOption] : QUESTION_TYPE_OPTIONS;
}

export function emptyChoices(type: BankQuestionType): ChoiceRow[] {
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

export function typeLabel(type: BankQuestionType, choices?: Array<{ isCorrect: boolean | null | undefined }>) {
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

export function parseLines(values?: string[] | null) {
  return (values ?? []).join('\n');
}

export function parseCsv(values?: string[] | null) {
  return (values ?? []).join(', ');
}

export function isSupportedMediaUrl(url: string, extensions: string[]) {
  const normalized = url.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.startsWith('data:')) return true;
  return extensions.some(extension => normalized.includes(extension));
}

export function hasAllowedFileExtension(fileName: string, extensions: string[]) {
  const normalized = fileName.trim().toLowerCase();
  return extensions.some(extension => normalized.endsWith(extension));
}

export function isAllowedMediaFile(file: File, mimeTypes: string[], extensions: string[]) {
  const normalizedMime = file.type.trim().toLowerCase();
  if (normalizedMime && mimeTypes.includes(normalizedMime)) return true;
  return hasAllowedFileExtension(file.name, extensions);
}

export interface ReadingPassageOption {
  id: string;
  title: string;
  content: string;
  questionCount: number;
  maxOrder: number;
}

export interface FormState {
  questionBankId: string;
  categoryId: string;
  grade: string;
  courseId: string;
  chapterId: string;
  content: string;
  explanation: string;
  defaultPoints: string;
  tagsText: string;
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

export function emptyForm(): FormState {
  return {
    questionBankId: '',
    categoryId: '', grade: '', courseId: '', chapterId: '',
    content: '', explanation: '',
    defaultPoints: '1',
    tagsText: '',
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

export function formFromQuestion(q: QuestionResponse): FormState {
  const metadata = q.metadata ?? {};
  return {
    questionBankId: q.questionBankId ?? '',
    categoryId:  q.categoryId  ?? '',
    grade:       q.grade ? String(q.grade) : '',
    courseId:    '',
    chapterId:   q.chapterId   ?? '',
    content:     q.content,
    explanation: q.explanation ?? '',
    defaultPoints: q.defaultPoints != null ? String(q.defaultPoints) : '1',
    tagsText: q.tags?.join(', ') ?? '',
    difficulty:  q.difficulty,
    type:        normalizeQuestionType(q.type),
    choices:     q.choices.map(c => ({ content: c.content, isCorrect: !!c.isCorrect, imageUrl: c.imageUrl ?? undefined })),
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

export const DIFFICULTY_OPTS = [
  { value: 'all'   as const, label: 'Tất cả độ khó' },
  { value: 'easy'  as const, label: 'Dễ' },
  { value: 'medium'as const, label: 'Trung bình' },
  { value: 'hard'  as const, label: 'Khó' },
];

export const STATUS_OPTS = [
  { value: 'all'     as const, label: 'Tất cả trạng thái' },
  { value: 'active'  as const, label: 'Đang dùng' },
  { value: 'inactive'as const, label: 'Tạm ẩn' },
];

export const QUESTION_TYPE_FILTER_OPTS: Array<{ value: BankQuestionType | 'all'; label: string }> = [
  { value: 'all', label: 'Tất cả loại câu hỏi' },
  ...QUESTION_TYPE_OPTIONS,
];

export function questionTypeFilterLabel(value: BankQuestionType | 'all', fallback: string) {
  if (value === 'all') return 'T\u1ea5t c\u1ea3 lo\u1ea1i c\u00e2u h\u1ecfi';
  return fallback;
}

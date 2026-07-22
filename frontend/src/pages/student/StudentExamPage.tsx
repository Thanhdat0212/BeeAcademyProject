import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckSquare,
  Clock,
  FileText,
  ImagePlus,
  Loader2,
  Send,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import LatexText from '../../components/LatexText';
import { isApiError } from '../../api/client';
import { notify } from '../../lib/toast';
import {
  getLatestExamRetakeRequest,
  getStudentExam,
  getStudentExamResult,
  recordExamIntegrityEvent,
  requestExamRetake,
  saveStudentExamDraft,
  submitStudentExam,
  type ExamRetakeRequest,
  type ExamIntegrityEventType,
  type StudentExam,
  type StudentExamAnswerImageUpload,
  type StudentExamQuestion,
  type StudentExamSubmissionResponse,
  type SubmitExamAnswer,
  uploadStudentExamAnswerImage,
} from '../../api/studentExamService';
import type { MatchingPair } from '../../api/questionService';
import { gradeExamWithAi, type AiExamGrade } from '../../api/aiService';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];
const MAX_ANSWER_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_ANSWER_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const DEFAULT_FILE_UPLOAD_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const MAX_ANSWER_IMAGE_COUNT = 10;
// Hộp thoại chọn file của hệ điều hành làm cửa sổ trình duyệt mất focus (và có thể
// rớt fullscreen) — trong khoảng ân hạn này các tín hiệu đó không tính là gian lận.
const FILE_PICKER_GRACE_MS = 120000;

function formatPoints(value: number | null | undefined) {
  if (value == null) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function questionTypeLabel(type: string) {
  switch (type) {
    case 'multiple_choice': return 'Trắc nghiệm';
    case 'true_false': return 'Đúng/Sai';
    case 'fill_in_blank': return 'Điền chỗ trống';
    case 'matching': return 'Nối cột';
    case 'essay':
    case 'essay_short':
    case 'essay_long': return 'Tự luận';
    case 'image_question': return 'Câu hỏi hình ảnh';
    case 'formula_question': return 'Câu hỏi công thức';
    case 'audio_question': return 'Câu hỏi âm thanh';
    case 'file_upload': return 'Nộp file / ảnh';
    default: return 'Câu hỏi';
  }
}

function isObjectiveQuestion(type: string) {
  return ['multiple_choice', 'true_false', 'image_question', 'formula_question', 'audio_question'].includes(type);
}

function isManualQuestion(type: string) {
  return ['essay', 'essay_short', 'essay_long', 'file_upload'].includes(type);
}

function acceptedUploadTypes(question: StudentExamQuestion) {
  if (question.type === 'file_upload') {
    return question.metadata?.allowedUploadTypes?.length
      ? question.metadata.allowedUploadTypes
      : DEFAULT_FILE_UPLOAD_TYPES;
  }
  return ACCEPTED_ANSWER_IMAGE_TYPES;
}

function orderQuestionsObjectiveFirst(questions: StudentExamQuestion[]) {
  return questions;
}

interface QuestionRenderGroup {
  readingSetId: string | null;
  sharedPromptTitle?: string;
  sharedPrompt?: string;
  questions: Array<{
    question: StudentExamQuestion;
    displayNumber: number;
  }>;
}

function buildQuestionRenderGroups(questions: StudentExamQuestion[]): QuestionRenderGroup[] {
  const groups: QuestionRenderGroup[] = [];
  const groupIndexByReadingSet = new Map<string, number>();

  questions.forEach((question, index) => {
    const readingSetId = question.metadata?.readingSetId?.trim() || '';
    const sharedPrompt = question.metadata?.sharedPrompt?.trim() || '';

    if (!readingSetId || !sharedPrompt) {
      groups.push({
        readingSetId: null,
        questions: [{ question, displayNumber: index + 1 }],
      });
      return;
    }

    const existingGroupIndex = groupIndexByReadingSet.get(readingSetId);
    if (existingGroupIndex != null) {
      groups[existingGroupIndex].questions.push({
        question,
        displayNumber: index + 1,
      });
      return;
    }

    groupIndexByReadingSet.set(readingSetId, groups.length);
    groups.push({
      readingSetId,
      sharedPromptTitle: question.metadata?.sharedPromptTitle?.trim() || undefined,
      sharedPrompt,
      questions: [{ question, displayNumber: index + 1 }],
    });
  });

  groups.forEach(group => {
    group.questions.sort((left, right) => {
      const leftOrder = left.question.metadata?.questionOrderInSet ?? left.displayNumber;
      const rightOrder = right.question.metadata?.questionOrderInSet ?? right.displayNumber;
      return leftOrder - rightOrder;
    });
  });

  return groups;
}

function formatRemainingTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface PersistedExamDraft {
  examId: string;
  updatedAt: string;
  selectedAnswers: Record<string, number[]>;
  essayAnswers: Record<string, string>;
  essayImages: Record<string, StudentExamAnswerImageUpload[]>;
  answerData: Record<string, Record<string, unknown>>;
  remainingSeconds: number | null;
  savedAt: string;
}

function readPersistedDraft(key: string, exam: StudentExam): PersistedExamDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedExamDraft;
    if (parsed.examId !== exam.id || parsed.updatedAt !== exam.updatedAt) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export default function StudentExamPage() {
  const { courseId, slotIndex } = useParams<{ courseId: string; slotIndex: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = searchParams.get('returnTo') || (courseId ? `/courses/${courseId}?learn=1` : '/courses');
  const parsedSlotIndex = Number(slotIndex);
  const draftKey = courseId && Number.isInteger(parsedSlotIndex)
    ? `student-exam-draft:${courseId}:${parsedSlotIndex}`
    : '';

  const [exam, setExam] = useState<StudentExam | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number[]>>({});
  const [essayAnswers, setEssayAnswers] = useState<Record<string, string>>({});
  const [essayImages, setEssayImages] = useState<Record<string, StudentExamAnswerImageUpload[]>>({});
  const [answerData, setAnswerData] = useState<Record<string, Record<string, unknown>>>({});
  const [uploadingImages, setUploadingImages] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submission, setSubmission] = useState<StudentExamSubmissionResponse | null>(null);
  const [pastResult, setPastResult] = useState<StudentExamSubmissionResponse | null>(null);
  const [aiGrade, setAiGrade] = useState<AiExamGrade | null>(null);
  const [aiGrading, setAiGrading] = useState(false);
  const [retakeLocked, setRetakeLocked] = useState(false);
  const [retakeRequest, setRetakeRequest] = useState<ExamRetakeRequest | null>(null);
  const [retakeReason, setRetakeReason] = useState('');
  const [sendingRetake, setSendingRetake] = useState(false);
  const [retakeClockMs, setRetakeClockMs] = useState(() => Date.now());
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [integrityViolations, setIntegrityViolations] = useState(0);
  const [fullscreenActive, setFullscreenActive] = useState(() => Boolean(document.fullscreenElement));
  const autoSubmittingRef = useRef(false);
  const submitLatestRef = useRef<(forceSubmit?: boolean) => Promise<void>>(async () => {});
  const integrityEventQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lastIntegritySignalAtRef = useRef(0);
  const filePickerGraceUntilRef = useRef(0);
  const orderedQuestions = useMemo(
    () => orderQuestionsObjectiveFirst(exam?.questions ?? []),
    [exam],
  );
  const questionRenderGroups = useMemo(
    () => buildQuestionRenderGroups(orderedQuestions),
    [orderedQuestions],
  );

  useEffect(() => {
    if (!courseId || !Number.isInteger(parsedSlotIndex)) {
      setErrorMsg('Đường dẫn bài kiểm tra không hợp lệ.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErrorMsg('');
    getStudentExam(courseId, parsedSlotIndex)
      .then(data => {
        if (cancelled) return;
        setExam(data);
        const persisted = draftKey ? readPersistedDraft(draftKey, data) : null;
        setSelectedAnswers(persisted?.selectedAnswers ?? {});
        setEssayAnswers(persisted?.essayAnswers ?? {});
        setEssayImages(persisted?.essayImages ?? {});
        setAnswerData(persisted?.answerData ?? {});
        setUploadingImages({});
        setSubmitError('');
        setSubmission(null);
        setIntegrityViolations(0);
        autoSubmittingRef.current = false;
        integrityEventQueueRef.current = Promise.resolve();
        lastIntegritySignalAtRef.current = 0;
        filePickerGraceUntilRef.current = 0;
        setRemainingSeconds(persisted?.remainingSeconds ?? Math.max(0, data.durationMinutes * 60));
        if (persisted) {
          notify.success('Đã khôi phục bài làm nháp trên thiết bị này.');
        }
      })
      .catch(err => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : 'Không tải được bài kiểm tra.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [courseId, draftKey, parsedSlotIndex]);

  useEffect(() => {
    if (!courseId || !Number.isInteger(parsedSlotIndex)) return;
    let cancelled = false;
    setPastResult(null);
    getStudentExamResult(courseId, parsedSlotIndex)
      .then(result => {
        if (!cancelled) setPastResult(result);
      })
      .catch(() => {
        // Không có kết quả trước đó hoặc lỗi tải — bỏ qua, không chặn làm bài mới.
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, parsedSlotIndex]);

  const answeredCount = useMemo(() => {
    if (!exam) return 0;
    return orderedQuestions.filter(question => {
      if (isManualQuestion(question.type)) {
        return Boolean(essayAnswers[question.id]?.trim()) || (essayImages[question.id]?.length ?? 0) > 0;
      }
      if (question.type === 'fill_in_blank') {
        return Boolean(essayAnswers[question.id]?.trim());
      }
      if (question.type === 'matching') {
        const pairs = (answerData[question.id]?.matchingPairs as MatchingPair[] | undefined) ?? [];
        return pairs.some(pair => pair.left?.trim() || pair.right?.trim());
      }
      return (selectedAnswers[question.id] ?? []).length > 0;
    }).length;
  }, [answerData, essayAnswers, essayImages, exam, orderedQuestions, selectedAnswers]);

  const hasUploadingImages = useMemo(
    () => Object.values(uploadingImages).some(Boolean),
    [uploadingImages],
  );

  useEffect(() => {
    if (!exam || loading || submission) return;
    setRemainingSeconds(prev => prev ?? Math.max(0, exam.durationMinutes * 60));
  }, [exam, loading, submission]);

  useEffect(() => {
    if (!retakeRequest?.cooldownUntil) return;
    setRetakeClockMs(Date.now());
    const timerId = window.setInterval(() => setRetakeClockMs(Date.now()), 1000);
    return () => window.clearInterval(timerId);
  }, [retakeRequest?.cooldownUntil]);

  useEffect(() => {
    if (!exam?.requireFullscreen || submission || document.fullscreenElement) return;
    document.documentElement.requestFullscreen?.().catch(() => {
      notify.error('Trình duyệt không cho tự động bật fullscreen. Vui lòng bật fullscreen trước khi làm bài.');
    });
  }, [exam?.requireFullscreen, submission]);

  function toggleChoice(questionId: string, optionIndex: number, multiple: boolean) {
    if (submission) return;
    setSelectedAnswers(prev => {
      const current = prev[questionId] ?? [];
      if (!multiple) {
        return { ...prev, [questionId]: [optionIndex] };
      }
      const exists = current.includes(optionIndex);
      return {
        ...prev,
        [questionId]: exists
          ? current.filter(value => value !== optionIndex)
          : [...current, optionIndex].sort((a, b) => a - b),
      };
    });
  }

  async function handleAddEssayImage(question: StudentExamQuestion, files: FileList | null) {
    const questionId = question.id;
    if (!courseId || submission || !files?.length) return;

    const selectedFiles = Array.from(files);
    const allowedTypes = acceptedUploadTypes(question);
    const currentCount = essayImages[questionId]?.length ?? 0;
    if (currentCount + selectedFiles.length > MAX_ANSWER_IMAGE_COUNT) {
      notify.error(`Mỗi câu tối đa ${MAX_ANSWER_IMAGE_COUNT} tệp đính kèm.`);
      return;
    }

    for (const file of selectedFiles) {
      if (!allowedTypes.includes(file.type)) {
        notify.error(`Loại file không được hỗ trợ. Cho phép: ${allowedTypes.join(', ')}`);
        return;
      }
      if (file.size > MAX_ANSWER_IMAGE_BYTES) {
        notify.error('Mỗi tệp đính kèm tối đa 5 MB.');
        return;
      }
    }

    setUploadingImages(prev => ({ ...prev, [questionId]: true }));
    try {
      const uploadedImages: StudentExamAnswerImageUpload[] = [];
      for (const file of selectedFiles) {
        uploadedImages.push(await uploadStudentExamAnswerImage(courseId, file));
      }
      setEssayImages(prev => ({
        ...prev,
        [questionId]: [...(prev[questionId] ?? []), ...uploadedImages],
      }));
      setSubmitError('');
      notify.success(`Đã tải lên ${uploadedImages.length} tệp đính kèm.`);
    } catch (err) {
      notify.error(isApiError(err) ? err.message : 'Không thể tải tệp đính kèm.');
    } finally {
      setUploadingImages(prev => ({ ...prev, [questionId]: false }));
    }
  }

  function beginFilePickerGrace() {
    filePickerGraceUntilRef.current = Date.now() + FILE_PICKER_GRACE_MS;
    const closeGrace = () => {
      window.removeEventListener('focus', closeGrace);
      // Blur/fullscreenchange của hộp thoại có thể tới ngay sau khi cửa sổ nhận lại focus.
      window.setTimeout(() => {
        filePickerGraceUntilRef.current = 0;
      }, 1500);
    };
    window.addEventListener('focus', closeGrace);
  }

  async function restoreFullscreen() {
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      notify.error('Trình duyệt chặn bật fullscreen. Nhấn F11 để bật thủ công.');
    }
  }

  function removeEssayImage(questionId: string, imageUrl: string) {
    if (submission) return;
    setEssayImages(prev => ({
      ...prev,
      [questionId]: (prev[questionId] ?? []).filter(image => image.url !== imageUrl),
    }));
  }

  function buildAnswersPayload() {
    return orderedQuestions.reduce<Record<string, SubmitExamAnswer>>((acc, question) => {
      if (isManualQuestion(question.type)) {
        acc[question.id] = {
          selectedIndices: [],
          textAnswer: essayAnswers[question.id]?.trim() ?? '',
          imageUrls: (essayImages[question.id] ?? []).map(image => image.url),
          answerData: answerData[question.id] ?? null,
        };
      } else if (question.type === 'fill_in_blank') {
        acc[question.id] = {
          selectedIndices: [],
          textAnswer: essayAnswers[question.id]?.trim() ?? '',
          imageUrls: [],
          answerData: null,
        };
      } else if (question.type === 'matching') {
        acc[question.id] = {
          selectedIndices: [],
          textAnswer: '',
          imageUrls: [],
          answerData: answerData[question.id] ?? null,
        };
      } else {
        acc[question.id] = {
          selectedIndices: selectedAnswers[question.id] ?? [],
          textAnswer: '',
          imageUrls: [],
          answerData: question.metadata?.optionIndexMap
            ? { optionIndexMap: question.metadata.optionIndexMap }
            : null,
        };
      }
      return acc;
    }, {});
  }

  async function handleSubmitExam(forceSubmit = false) {
    if (!courseId || !exam || submitting || submission) return;
    if (hasUploadingImages) {
      setSubmitError('Vui lòng đợi tải ảnh đáp án xong rồi nộp bài.');
      return;
    }
    if (!forceSubmit && answeredCount < exam.questionCount) {
      setSubmitError('Vui lòng trả lời đầy đủ các câu trước khi nộp bài.');
      return;
    }

    const answers = buildAnswersPayload();

    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await submitStudentExam(courseId, parsedSlotIndex, answers);
      setSubmission(result);
      setRemainingSeconds(0);
      if (draftKey) {
        window.localStorage.removeItem(draftKey);
      }
    } catch (err) {
      if (isApiError(err) && err.code === 'RETAKE_LOCKED') {
        setRetakeLocked(true);
        getLatestExamRetakeRequest(courseId, parsedSlotIndex)
          .then(setRetakeRequest)
          .catch(() => {});
      }
      setSubmitError(err instanceof Error ? err.message : 'Không thể nộp bài kiểm tra.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAiGrade() {
    if (!submission || aiGrading) return;
    setAiGrading(true);
    try {
      const result = await gradeExamWithAi(submission.attemptId);
      setAiGrade(result);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Không thể nhờ AI chấm bài.');
    } finally {
      setAiGrading(false);
    }
  }

  submitLatestRef.current = handleSubmitExam;

  async function handleSendRetakeRequest() {
    if (!courseId || sendingRetake) return;
    if (retakeReason.trim().length < 10) {
      notify.error('Lý do cần tối thiểu 10 ký tự.');
      return;
    }
    setSendingRetake(true);
    try {
      const created = await requestExamRetake(courseId, parsedSlotIndex, retakeReason.trim());
      setRetakeRequest(created);
      setRetakeReason('');
      notify.success('Đã gửi yêu cầu mở thêm lượt cho giáo viên.');
    } catch (err) {
      notify.error(isApiError(err) ? err.message : 'Không gửi được yêu cầu.');
    } finally {
      setSendingRetake(false);
    }
  }

  useEffect(() => {
    if (!draftKey || !exam || loading || submission) return;
    const draft: PersistedExamDraft = {
      examId: exam.id,
      updatedAt: exam.updatedAt,
      selectedAnswers,
      essayAnswers,
      essayImages,
      answerData,
      remainingSeconds,
      savedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      // Local draft is best-effort; server autosave still runs when online.
    }
  }, [
    answerData,
    draftKey,
    essayAnswers,
    essayImages,
    exam,
    loading,
    remainingSeconds,
    selectedAnswers,
    submission,
  ]);

  useEffect(() => {
    if (!courseId || !exam || loading || submission) return;
    const intervalId = window.setInterval(() => {
      if (!navigator.onLine || submitting || hasUploadingImages) return;
      saveStudentExamDraft(courseId, parsedSlotIndex, buildAnswersPayload())
        .catch(() => {
          // Keep the local draft silently; showing a toast every 15s is too noisy.
        });
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [
    answerData,
    courseId,
    essayAnswers,
    essayImages,
    exam,
    hasUploadingImages,
    loading,
    parsedSlotIndex,
    selectedAnswers,
    submission,
    submitting,
  ]);

  useEffect(() => {
    if (!exam?.requireFullscreen || submission) return;

    const recordViolation = (eventType: ExamIntegrityEventType) => {
      if (!courseId || autoSubmittingRef.current || submission || submitting) return;

      // Hộp thoại chọn file luôn kéo theo blur (và đôi khi thoát fullscreen) dù học sinh
      // vẫn ở nguyên trang. Chỉ TAB_HIDDEN mới chứng minh được là đã rời tab thật.
      if (eventType !== 'TAB_HIDDEN' && Date.now() < filePickerGraceUntilRef.current) return;

      // A single tab switch often fires blur + visibility/fullscreen together.
      // Coalesce those browser signals into one audited violation.
      const now = Date.now();
      if (now - lastIntegritySignalAtRef.current < 800) return;
      lastIntegritySignalAtRef.current = now;

      const eventId = window.crypto.randomUUID();
      integrityEventQueueRef.current = integrityEventQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          let recorded;
          try {
            recorded = await recordExamIntegrityEvent(
              courseId,
              parsedSlotIndex,
              eventId,
              eventType,
            );
          } catch {
            // Retry with the same idempotency key, so the server cannot double count it.
            await new Promise(resolve => window.setTimeout(resolve, 800));
            recorded = await recordExamIntegrityEvent(
              courseId,
              parsedSlotIndex,
              eventId,
              eventType,
            );
          }

          setIntegrityViolations(recorded.violationCount);
          if (recorded.autoSubmitRequired) {
            autoSubmittingRef.current = true;
            notify.error('Vi phạm chống gian lận lần thứ 4. Hệ thống sẽ tự nộp bài.');
            window.setTimeout(() => submitLatestRef.current(true), 0);
          } else {
            notify.error(
              `Cảnh báo chống gian lận ${recorded.violationCount}/3: không rời tab hoặc fullscreen.`,
            );
          }
        })
        .catch(() => {
          notify.error('Không thể ghi nhận sự kiện chống gian lận. Vui lòng kiểm tra kết nối.');
        });
    };

    const handleVisibility = () => {
      if (document.hidden) recordViolation('TAB_HIDDEN');
    };
    const handleFullscreen = () => {
      setFullscreenActive(Boolean(document.fullscreenElement));
      if (!document.fullscreenElement) recordViolation('FULLSCREEN_EXIT');
    };
    const handleBlur = () => recordViolation('WINDOW_BLUR');

    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('fullscreenchange', handleFullscreen);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('fullscreenchange', handleFullscreen);
      window.removeEventListener('blur', handleBlur);
    };
  }, [courseId, exam?.requireFullscreen, parsedSlotIndex, submission, submitting]);

  useEffect(() => {
    if (!exam || loading || submitting || submission || remainingSeconds == null) return;
    if (remainingSeconds <= 0) {
      handleSubmitExam(true);
      return;
    }

    const timerId = window.setTimeout(() => {
      setRemainingSeconds(current => (current == null ? current : Math.max(0, current - 1)));
    }, 1000);

    return () => window.clearTimeout(timerId);
  }, [
    answeredCount,
    courseId,
    answerData,
    essayAnswers,
    essayImages,
    exam,
    hasUploadingImages,
    loading,
    parsedSlotIndex,
    remainingSeconds,
    selectedAnswers,
    submission,
    submitting,
  ]);

  const isTimeUrgent = remainingSeconds != null && remainingSeconds <= 300;
  const displayTime = remainingSeconds == null
    ? exam
      ? `${exam.durationMinutes} phút`
      : '--:--'
    : formatRemainingTime(remainingSeconds);
  const cooldownUntilMs = retakeRequest?.cooldownUntil
    ? new Date(retakeRequest.cooldownUntil).getTime()
    : 0;
  const retakeCooldownActive = cooldownUntilMs > retakeClockMs;
  const retakeRequestLimitReached = (retakeRequest?.requestCount ?? 0) >= 3;
  const canSendRetakeRequest = retakeRequest?.status !== 'PENDING'
    && retakeRequest?.examEnrollmentStatus !== 'RETAKE_APPROVED'
    && !retakeCooldownActive
    && !retakeRequestLimitReached;

  return (
    <div className="min-h-screen bg-surface font-sans">
      <DashboardHeader />

      <header className="border-b border-outline-variant/30 bg-surface-container">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <button
            type="button"
            onClick={() => navigate(returnTo)}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại chương trình học
          </button>
          {exam && (
            <div className={`hidden items-center gap-2 text-xs font-bold sm:flex ${
              isTimeUrgent ? 'text-red-500' : 'text-on-surface-variant'
            }`}>
              <Clock className="h-4 w-4" />
              {displayTime}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {loading && (
          <div className="flex min-h-[50vh] items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
              <p className="font-semibold text-on-surface-variant">Đang tải bài kiểm tra...</p>
            </div>
          </div>
        )}

        {!loading && errorMsg && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <h1 className="font-extrabold">Không thể mở bài kiểm tra</h1>
                <p className="mt-1 text-sm font-medium">{errorMsg}</p>
                <Link
                  to={returnTo}
                  className="mt-4 inline-flex rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
                >
                  Về chương trình học
                </Link>
              </div>
            </div>
          </div>
        )}

        {!loading && exam && !submission && pastResult && (
          <div className="mb-6 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-on-surface">
                  Kết quả lần làm gần nhất (Lần {pastResult.attemptNumber})
                </p>
                {pastResult.status === 'graded' ? (
                  <p className="mt-1 text-xs font-semibold text-on-surface-variant">
                    Điểm: {pastResult.effectiveScorePercent}%
                    {pastResult.passed != null && (
                      <span className={pastResult.passed ? 'text-green-600' : 'text-red-500'}>
                        {' '}- {pastResult.passed ? 'Đạt' : 'Chưa đạt'}
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="mt-1 text-xs font-semibold text-amber-600">
                    Đang chờ giáo viên chấm phần tự luận.
                  </p>
                )}
                {pastResult.teacherFeedback && (
                  <p className="mt-1 text-xs italic text-on-surface-variant">
                    Nhận xét giáo viên: {pastResult.teacherFeedback}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {!loading && exam && (
          <div
            className="grid gap-6 lg:grid-cols-[1fr_280px]"
            onCopy={e => { if (exam.blockCopyPaste) e.preventDefault(); }}
            onCut={e => { if (exam.blockCopyPaste) e.preventDefault(); }}
            onPaste={e => { if (exam.blockCopyPaste) e.preventDefault(); }}
            onContextMenu={e => { if (exam.blockCopyPaste) e.preventDefault(); }}
          >
            <section className="min-w-0 space-y-5">
              <div>
                <p className="text-sm font-bold uppercase text-primary">
                  Bài kiểm tra sau {exam.placementChapterTitle ?? 'chương đã chọn'}
                </p>
                <h1 className="mt-1 text-3xl font-extrabold text-on-surface">{exam.name}</h1>
                {exam.description && (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-on-surface-variant">
                    {exam.description}
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4">
                  <Clock className={`mb-2 h-5 w-5 ${isTimeUrgent ? 'text-red-500' : 'text-primary'}`} />
                  <p className="text-xs font-bold uppercase text-on-surface-variant">Thời gian</p>
                  <p className={`mt-1 text-xl font-extrabold ${isTimeUrgent ? 'text-red-500' : 'text-on-surface'}`}>
                    {displayTime}
                  </p>
                  <p className="mt-1 text-xs font-medium text-on-surface-variant">
                    Thời lượng tổng: {exam.durationMinutes} phút
                  </p>
                </div>
                <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4">
                  <FileText className="mb-2 h-5 w-5 text-primary" />
                  <p className="text-xs font-bold uppercase text-on-surface-variant">Số câu</p>
                  <p className="mt-1 text-xl font-extrabold text-on-surface">{exam.questionCount}</p>
                </div>
              </div>

              <div className="space-y-4">
                {questionRenderGroups.map((group, groupIndex) => (
                  <div
                    key={group.readingSetId ?? `single-${groupIndex}`}
                    className={group.readingSetId ? 'space-y-4 rounded-3xl border border-primary/20 bg-primary/5 p-4' : 'space-y-4'}
                  >
                    {group.sharedPrompt && (
                      <section className="rounded-2xl border border-primary/15 bg-surface p-5">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-extrabold text-primary">
                            {group.sharedPromptTitle || 'Bài đọc chung'}
                          </span>
                          <span className="rounded-full bg-surface-container px-2.5 py-1 text-xs font-bold text-on-surface-variant">
                            Nhóm: {group.readingSetId}
                          </span>
                        </div>
                        <div className="text-sm leading-relaxed text-on-surface whitespace-pre-wrap">
                          <LatexText content={group.sharedPrompt} />
                        </div>
                      </section>
                    )}

                    {group.questions.map(({ question, displayNumber }) => {
                      const selected = selectedAnswers[question.id] ?? [];
                      const uploadedImages = essayImages[question.id] ?? [];
                      const isUploading = Boolean(uploadingImages[question.id]);

                      return (
                        <article
                          key={question.id}
                          className="rounded-2xl border border-outline-variant/40 bg-surface p-5"
                        >
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-extrabold text-primary">
                              Câu {displayNumber}
                            </span>
                            <span className="rounded-full bg-surface-container px-2.5 py-1 text-xs font-bold text-on-surface-variant">
                              {questionTypeLabel(question.type)}
                            </span>
                          </div>
                          <div className="text-base font-semibold leading-relaxed text-on-surface">
                            <LatexText content={question.text} />
                          </div>
                          {question.type === 'image_question' && question.metadata?.promptAssetUrl && (
                            <div className="mt-3 overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest">
                              <img
                                src={question.metadata.promptAssetUrl}
                                alt="Question prompt"
                                className="max-h-80 w-full object-contain"
                              />
                            </div>
                          )}
                          {question.type === 'audio_question' && question.metadata?.promptAssetUrl && (
                            <div className="mt-3 space-y-2 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-3">
                              <audio controls className="w-full">
                                <source src={question.metadata.promptAssetUrl} />
                              </audio>
                              {question.metadata.transcript && (
                                <p className="text-xs text-on-surface-variant whitespace-pre-wrap">
                                  Transcript: {question.metadata.transcript}
                                </p>
                              )}
                            </div>
                          )}
                          {question.type === 'formula_question' && question.metadata?.formulaLatex && (
                            <div className="mt-3 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-3">
                              <LatexText content={question.metadata.formulaLatex} />
                            </div>
                          )}
                        </div>
                        <span className="flex-shrink-0 rounded-xl bg-amber-500/10 px-3 py-1.5 text-xs font-extrabold text-amber-600">
                          {formatPoints(question.points)} điểm
                        </span>
                      </div>

                      {isManualQuestion(question.type) ? (
                        <div className="space-y-3">
                          <textarea
                            value={essayAnswers[question.id] ?? ''}
                            onChange={event => setEssayAnswers(prev => ({
                              ...prev,
                              [question.id]: event.target.value,
                            }))}
                            disabled={Boolean(submission)}
                            rows={5}
                            placeholder="Nhập câu trả lời tự luận..."
                            className="w-full resize-y rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none focus:border-primary"
                          />

                          <div className="rounded-2xl border border-dashed border-outline-variant/60 bg-surface-container-lowest p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm font-bold text-on-surface">
                                  {question.type === 'file_upload' ? 'Tệp đính kèm' : 'Ảnh đáp án'}
                                </p>
                                <p className="text-xs text-on-surface-variant">
                                  {acceptedUploadTypes(question).join(', ')} - tối đa 5 MB mỗi tệp - tối đa {MAX_ANSWER_IMAGE_COUNT} tệp
                                </p>
                              </div>
                              <label className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                                submission || isUploading
                                  ? 'cursor-not-allowed bg-surface-container text-on-surface-variant'
                                  : 'cursor-pointer bg-primary/10 text-primary hover:bg-primary/15'
                              }`}>
                                {isUploading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <ImagePlus className="h-4 w-4" />
                                )}
                                {isUploading ? 'Đang tải...' : 'Tải tệp lên'}
                                <input
                                  type="file"
                                  accept={acceptedUploadTypes(question).join(',')}
                                  multiple
                                  disabled={Boolean(submission) || isUploading}
                                  className="hidden"
                                  onClick={beginFilePickerGrace}
                                  onChange={event => {
                                    handleAddEssayImage(question, event.target.files);
                                    event.target.value = '';
                                  }}
                                />
                              </label>
                            </div>

                            {uploadedImages.length > 0 && (
                              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {uploadedImages.map((image, imageIndex) => (
                                  <div
                                    key={image.url}
                                    className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface"
                                  >
                                    {image.type.startsWith('image/') ? (
                                      <a href={image.url} target="_blank" rel="noreferrer">
                                        <img
                                          src={image.url}
                                          alt={image.name}
                                          className="h-36 w-full object-cover"
                                        />
                                      </a>
                                    ) : (
                                      <a
                                        href={image.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex h-36 w-full items-center justify-center bg-surface-container text-sm font-bold text-primary"
                                      >
                                        Mở tệp đính kèm
                                      </a>
                                    )}
                                    <div className="flex items-start justify-between gap-2 px-3 py-2">
                                      <div className="min-w-0">
                                        <p className="truncate text-xs font-bold text-on-surface">
                                          {question.type === 'file_upload' ? `Tệp ${imageIndex + 1}` : `Ảnh ${imageIndex + 1}`}
                                        </p>
                                        <p className="truncate text-[11px] text-on-surface-variant">
                                          {image.name}
                                        </p>
                                      </div>
                                      {!submission && (
                                        <button
                                          type="button"
                                          onClick={() => removeEssayImage(question.id, image.url)}
                                          className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container hover:text-red-500"
                                          title="Xóa ảnh"
                                        >
                                          <X className="h-4 w-4" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : question.type === 'fill_in_blank' ? (
                        <input
                          type="text"
                          value={essayAnswers[question.id] ?? ''}
                          onChange={event => setEssayAnswers(prev => ({
                            ...prev,
                            [question.id]: event.target.value,
                          }))}
                          disabled={Boolean(submission)}
                          placeholder="Nhập đáp án..."
                          className="w-full rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none focus:border-primary"
                        />
                      ) : question.type === 'matching' ? (
                        <div className="space-y-3">
                          {((question.metadata?.matchingPairs as MatchingPair[] | undefined) ?? []).map((pair, pairIndex) => {
                            const currentPairs = ((answerData[question.id]?.matchingPairs as MatchingPair[] | undefined) ?? []);
                            const currentPair = currentPairs[pairIndex] ?? { left: pair.left, right: '' };
                            return (
                              <div key={`${question.id}-pair-${pairIndex}`} className="grid gap-2 sm:grid-cols-2">
                                <div className="rounded-2xl border border-outline-variant/50 bg-surface-container-lowest px-4 py-3 text-sm font-medium text-on-surface">
                                  {pair.left}
                                </div>
                                <input
                                  type="text"
                                  value={currentPair.right}
                                  onChange={event => setAnswerData(prev => {
                                    const nextPairs = [...currentPairs];
                                    nextPairs[pairIndex] = { left: pair.left, right: event.target.value };
                                    return {
                                      ...prev,
                                      [question.id]: { matchingPairs: nextPairs },
                                    };
                                  })}
                                  disabled={Boolean(submission)}
                                  placeholder="Nhập vế ghép tương ứng..."
                                  className="rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none focus:border-primary"
                                />
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {question.options.map((option, optionIndex) => {
                            const checked = selected.includes(optionIndex);
                            const optionImage = question.metadata?.optionImages?.[optionIndex];
                            return (
                              <button
                                key={`${question.id}-${optionIndex}`}
                                type="button"
                                onClick={() => toggleChoice(question.id, optionIndex, question.type === 'multiple_choice')}
                                disabled={Boolean(submission)}
                                className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                                  checked
                                    ? 'border-primary/40 bg-primary/10'
                                    : 'border-outline-variant/50 bg-surface-container-lowest hover:border-primary/30'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <span className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-extrabold ${
                                    checked ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                                  }`}>
                                    {OPTION_LABELS[optionIndex] ?? optionIndex + 1}
                                  </span>
                                  <span className="mt-1 flex-shrink-0 text-primary">
                                    {checked ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                  </span>
                                  <span className="min-w-0 flex-1 text-sm font-medium leading-relaxed text-on-surface">
                                    <LatexText content={option} />
                                    {optionImage && (
                                      <img
                                        src={optionImage}
                                        alt={`Đáp án ${OPTION_LABELS[optionIndex] ?? optionIndex + 1}`}
                                        className="mt-2 max-h-40 rounded-xl border border-outline-variant/40 object-contain"
                                      />
                                    )}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                        </article>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>

            <aside className="lg:sticky lg:top-6 lg:self-start">
              <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5">
                <p className="text-sm font-extrabold text-on-surface">Tiến độ làm bài</p>
                <div className="mt-4 h-2 rounded-full bg-surface-container">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${exam.questionCount ? (answeredCount / exam.questionCount) * 100 : 0}%` }}
                  />
                </div>
                <p className="mt-2 text-xs font-bold text-on-surface-variant">
                  Đã trả lời {answeredCount}/{exam.questionCount} câu
                </p>
                <div className="mt-4 space-y-2 text-xs font-medium text-on-surface-variant">
                  <p>Phạm vi: {exam.scopeStartChapterTitle ?? 'Chương đầu'} - {exam.placementChapterTitle ?? 'chương đặt bài kiểm tra'}</p>
                  <p>Tổng điểm: {formatPoints(exam.totalPoints)}</p>
                  <p>Số lần làm tối đa: {exam.maxAttempts}</p>
                  <p className={isTimeUrgent ? 'font-bold text-red-500' : ''}>
                    Còn lại: {displayTime}
                  </p>
                  {exam.requireFullscreen && (
                    <p className={integrityViolations > 0 ? 'font-bold text-red-500' : ''}>
                      Vi phạm rời tab/fullscreen: {Math.min(integrityViolations, 4)}/4
                    </p>
                  )}
                  {hasUploadingImages && (
                    <p className="font-bold text-amber-600">Đang tải ảnh đáp án, vui lòng đợi một chút.</p>
                  )}
                </div>
                {exam.requireFullscreen && !fullscreenActive && !submission && (
                  <button
                    type="button"
                    onClick={restoreFullscreen}
                    className="mt-3 w-full rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-extrabold text-amber-800 hover:bg-amber-100"
                  >
                    Bật lại toàn màn hình
                  </button>
                )}
                {submitError && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                    {submitError}
                  </div>
                )}
                {retakeLocked && !submission && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                    <p className="text-xs font-extrabold text-amber-800">
                      Yêu cầu mở thêm lượt làm bài
                    </p>
                    {retakeRequest && (
                      <p className="text-[11px] font-semibold text-amber-700">
                        Yêu cầu {retakeRequest.requestCount}/3 · Đã duyệt {retakeRequest.approvalCount}/3 ·{' '}
                        {retakeRequest.examEnrollmentStatus}
                      </p>
                    )}
                    {retakeRequest?.status === 'PENDING' ? (
                      <p className="text-xs font-semibold text-amber-700">
                        Yêu cầu của bạn đang chờ giáo viên duyệt. Bạn sẽ nhận thông báo khi có kết quả.
                      </p>
                    ) : retakeRequest?.status === 'APPROVED' ? (
                      <p className="text-xs font-semibold text-green-700">
                        Yêu cầu gần nhất đã được duyệt (+{retakeRequest.extraAttempts} lượt).
                        {retakeRequest.examEnrollmentStatus === 'RETAKE_APPROVED'
                          ? ' Bạn có thể tiếp tục làm bài trong thời hạn được cấp.'
                          : ' Lượt được cấp đã dùng hết hoặc hết hạn.'}
                      </p>
                    ) : retakeRequest?.status === 'REJECTED' ? (
                      <p className="text-xs font-semibold text-red-700">
                        Yêu cầu trước bị từ chối: {retakeRequest.decidedReason ?? 'không có lý do'}.
                        {retakeCooldownActive && retakeRequest.cooldownUntil
                          ? ` Có thể gửi lại sau ${formatDateTime(retakeRequest.cooldownUntil)}.`
                          : retakeRequestLimitReached
                            ? ' Bạn đã dùng hết 3 yêu cầu cho bài kiểm tra này.'
                            : ' Bạn có thể gửi lại yêu cầu mới bên dưới.'}
                      </p>
                    ) : null}
                    {canSendRetakeRequest && (
                      <>
                        <textarea
                          value={retakeReason}
                          onChange={e => setRetakeReason(e.target.value)}
                          rows={3}
                          maxLength={1000}
                          placeholder="Nêu lý do bạn cần mở thêm lượt (tối thiểu 10 ký tự)..."
                          className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-medium text-on-surface focus:outline-none focus:border-amber-400"
                        />
                        <button
                          type="button"
                          onClick={handleSendRetakeRequest}
                          disabled={sendingRetake || retakeReason.trim().length < 10}
                          className="w-full rounded-xl bg-amber-500 px-3 py-2 text-xs font-extrabold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {sendingRetake ? 'Đang gửi...' : 'Gửi yêu cầu cho giáo viên'}
                        </button>
                      </>
                    )}
                  </div>
                )}
                {submission ? (
                  <>
                    <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-800">
                      <p className="text-sm font-extrabold">Đã nộp bài kiểm tra</p>
                      <p className="mt-1 text-xs font-semibold">
                        Trắc nghiệm đúng {submission.correctObjectiveCount}/{submission.totalObjectiveCount} câu.
                      </p>
                      {submission.status === 'pending' ? (
                        <p className="mt-1 text-xs font-semibold">
                          Điểm trắc nghiệm đã được chấm máy: {submission.autoScorePercent}%.
                          Phần tự luận đã được gửi sang giáo viên để chấm tiếp.
                        </p>
                      ) : (
                        <p className="mt-1 text-xs font-semibold">
                          Điểm tự động: {submission.autoScorePercent}% - Bài đã được chấm xong.
                        </p>
                      )}
                    </div>

                    {submission.status === 'pending' && !aiGrade && (
                      <button
                        type="button"
                        onClick={handleAiGrade}
                        disabled={aiGrading}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary bg-primary/10 px-4 py-2.5 text-sm font-bold text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {aiGrading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {aiGrading ? 'AI đang chấm sơ bộ...' : 'Nhờ AI chấm sơ bộ'}
                      </button>
                    )}

                    {aiGrade && (
                      <div className="mt-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <span className="text-[11px] font-extrabold uppercase tracking-wide text-primary">
                            Kết quả sơ bộ (AI)
                          </span>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                          <span className="text-3xl font-extrabold text-on-surface">
                            {(aiGrade.aiScorePercent / 10).toFixed(1).replace('.', ',')}
                          </span>
                          <span className="text-sm font-semibold text-on-surface-variant">/ 10</span>
                        </div>
                        {/* Nhận xét chi tiết dễ bị cắt trong sidebar khi cuộn (aside sticky trong grid
                            cột hẹp) — chuyển sang trang riêng để luôn xem được đầy đủ. */}
                        <button
                          type="button"
                          onClick={() => navigate(
                            `/courses/${courseId}/exams/${parsedSlotIndex}/ai-result/${submission.attemptId}?returnTo=${encodeURIComponent(returnTo)}`,
                          )}
                          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-on-primary hover:bg-primary/90"
                        >
                          Xem nhận xét chi tiết
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSubmitExam()}
                    disabled={submitting || answeredCount < exam.questionCount || hasUploadingImages}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {submitting ? 'Đang nộp bài...' : 'Nộp bài kiểm tra'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => navigate(returnTo)}
                  className="mt-5 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
                >
                  Quay lại học tiếp
                </button>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

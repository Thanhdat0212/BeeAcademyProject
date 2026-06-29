/**
 * StudentQuizPage — UC: Học sinh làm quiz theo chương
 * Route: /courses/:courseId/chapters/:chapterId/quiz
 *
 * Luồng:
 *   mount → startQuiz(chapterId) → hiển thị câu hỏi từng câu
 *   → nộp bài → submitQuiz(attemptId, answers) → màn hình kết quả
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Trophy, Award,
  CheckCircle2, XCircle, Clock, Loader2, RotateCcw,
  BookOpen, AlertCircle,
} from 'lucide-react';
import { notify } from '../../lib/toast';
import LatexText from '../../components/LatexText';
import * as quizSvc from '../../api/quizService';
import { getCourseDetail } from '../../api/courseService';
import { useCourseStore } from '../../store/useCourseStore';
import type {
  QuizAttemptStartResponse,
  QuizResultResponse,
  QuizResultDetail,
} from '../../api/quizService';
import type { ChapterDetail, LessonDetail } from '../../types/api';

// ═══════════════════════════════════════════════════════════════════
//  ScoreCircle — SVG vòng tròn điểm số (tái sử dụng từ CourseDetailPage)
// ═══════════════════════════════════════════════════════════════════

function ScoreCircle({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 15.9;
  const dash = (score / 100) * circumference;
  const color =
    score >= 90 ? '#22c55e' : score >= 70 ? '#3b82f6' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative w-40 h-40">
      <svg viewBox="0 0 36 36" className="w-40 h-40 -rotate-90">
        <circle
          cx="18" cy="18" r="15.9" fill="none"
          stroke="currentColor" strokeWidth="2.5"
          className="text-surface-container-high"
        />
        <motion.circle
          cx="18" cy="18" r="15.9" fill="none"
          strokeWidth="2.5" strokeLinecap="round"
          stroke={color}
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${dash} ${circumference}` }}
          transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-4xl font-extrabold"
          style={{ color }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          {score}%
        </motion.span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  CountdownTimer — đếm ngược, gọi onExpire khi hết giờ
// ═══════════════════════════════════════════════════════════════════

function CountdownTimer({
  totalSeconds,
  onExpire,
}: {
  totalSeconds: number;
  onExpire: () => void;
}) {
  const [remaining, setRemaining] = useState(totalSeconds);

  useEffect(() => {
    if (remaining <= 0) { onExpire(); return; }
    const id = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining, onExpire]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isUrgent = remaining <= 60;

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm ${
      isUrgent
        ? 'bg-red-500/10 text-red-500 animate-pulse'
        : 'bg-surface-container text-on-surface'
    }`}>
      <Clock className="w-4 h-4" />
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  ResultDetail — review từng câu sau khi nộp bài
// ═══════════════════════════════════════════════════════════════════

function ResultDetailItem({ detail, index }: { detail: QuizResultDetail; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 * index }}
      className={`rounded-2xl border-2 overflow-hidden ${
        detail.isCorrect
          ? 'border-green-500/30 bg-green-500/5'
          : 'border-red-500/30 bg-red-500/5'
      }`}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-3 p-4 text-left"
      >
        {detail.isCorrect
          ? <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
          : <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-on-surface">
            Câu {index + 1}: <LatexText content={detail.content} />
          </p>
          {!open && !detail.isCorrect && (
            <p className="text-xs text-red-500 mt-1">Bạn chọn sai — nhấn để xem đáp án</p>
          )}
        </div>
        <ChevronRight className={`w-4 h-4 flex-shrink-0 text-on-surface-variant transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-on-surface-variant w-28 flex-shrink-0">Bạn chọn:</span>
                <span className={`font-bold ${detail.isCorrect ? 'text-green-600' : 'text-red-500'}`}>
                  <LatexText content={detail.studentAnswer ?? '(Không trả lời)'} />
                </span>
              </div>
              {!detail.isCorrect && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-on-surface-variant w-28 flex-shrink-0">Đáp án đúng:</span>
                  <span className="font-bold text-green-600"><LatexText content={detail.correctAnswer} /></span>
                </div>
              )}
              {detail.explanation && (
                <div className="mt-2 p-3 bg-surface-container rounded-xl">
                  <p className="text-xs font-bold text-on-surface-variant mb-1">Giải thích:</p>
                  <p className="text-sm text-on-surface"><LatexText content={detail.explanation} /></p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════════════

type PagePhase = 'loading' | 'error' | 'quiz' | 'submitting' | 'results';

function isVideoLesson(lesson: LessonDetail): boolean {
  return Boolean(lesson.videoUrl || lesson.videoEmbedUrl) || (lesson.documents?.length ?? 0) === 0;
}

function getChapterVideoProgress(
  chapter: ChapterDetail,
  completedLessonIds: string[],
): { total: number; completed: number } {
  const videoLessons = chapter.lessons.filter(isVideoLesson);
  const completed = videoLessons.filter(lesson => completedLessonIds.includes(lesson.id)).length;
  return { total: videoLessons.length, completed };
}

export default function StudentQuizPage() {
  const { courseId, chapterId } = useParams<{ courseId: string; chapterId: string }>();
  const navigate = useNavigate();
  const completedLessons = useCourseStore((state) => state.completedLessons);
  const markQuizCompleted = useCourseStore((state) => state.markQuizCompleted);
  const saveQuizScore = useCourseStore((state) => state.saveQuizScore);

  const [phase, setPhase] = useState<PagePhase>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [attempt, setAttempt] = useState<QuizAttemptStartResponse | null>(null);
  const [result, setResult] = useState<QuizResultResponse | null>(null);

  // answers: questionId → choiceId
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [currentIdx, setCurrentIdx] = useState(0);

  // Bắt đầu quiz
  useEffect(() => {
    if (!courseId || !chapterId) {
      setErrorMsg('Không tìm thấy khóa học hoặc chương.');
      setPhase('error');
      return;
    }

    let cancelled = false;

    async function loadQuiz() {
      setPhase('loading');
      try {
        const detail = await getCourseDetail(courseId!);
        if (cancelled) return;

        const chapter = detail.chapters.find(item => item.id === chapterId);
        if (!chapter) {
          setErrorMsg('Không tìm thấy chương.');
          setPhase('error');
          return;
        }

        const progress = getChapterVideoProgress(chapter, completedLessons[courseId!] ?? []);
        if (progress.total > 0 && progress.completed < progress.total) {
          setErrorMsg(`Bạn cần hoàn thành ${progress.completed}/${progress.total} video trong chương này trước khi làm quiz.`);
          setPhase('error');
          return;
        }

        const data = await quizSvc.startQuiz(chapterId!);
        if (cancelled) return;
        setAttempt(data);
        const init: Record<string, null> = {};
        data.questions.forEach(q => { init[q.id] = null; });
        setAnswers(init);
        setPhase('quiz');
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Không thể bắt đầu quiz.';
        setErrorMsg(msg);
        setPhase('error');
      }
    }

    loadQuiz();

    return () => {
      cancelled = true;
    };
  }, [chapterId, completedLessons, courseId]);

  // Nộp bài — được gọi cả khi user tự nộp lẫn khi hết giờ
  const handleSubmit = useCallback(async () => {
    if (!attempt) return;
    setPhase('submitting');
    try {
      const res = await quizSvc.submitQuiz(attempt.attemptId, answers);
      if (courseId && chapterId) {
        markQuizCompleted(courseId, chapterId);
        saveQuizScore(courseId, chapterId, res.score);
      }
      setResult(res);
      setPhase('results');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Nộp bài thất bại.';
      notify.error(msg);
      setPhase('quiz');
    }
  }, [attempt, answers, chapterId, courseId, markQuizCompleted, saveQuizScore]);

  // Hết giờ → tự động nộp
  const handleTimeExpire = useCallback(() => {
    notify.error('Hết giờ! Bài của bạn đã được nộp tự động.');
    handleSubmit();
  }, [handleSubmit]);

  // Làm lại — gọi lại startQuiz
  async function handleRetry() {
    if (!courseId || !chapterId) return;
    setPhase('loading');
    setCurrentIdx(0);
    setResult(null);
    try {
      const detail = await getCourseDetail(courseId);
      const chapter = detail.chapters.find(item => item.id === chapterId);
      if (!chapter) {
        setErrorMsg('Không tìm thấy chương.');
        setPhase('error');
        return;
      }

      const progress = getChapterVideoProgress(chapter, completedLessons[courseId] ?? []);
      if (progress.total > 0 && progress.completed < progress.total) {
        setErrorMsg(`Bạn cần hoàn thành ${progress.completed}/${progress.total} video trong chương này trước khi làm quiz.`);
        setPhase('error');
        return;
      }

      const data = await quizSvc.startQuiz(chapterId);
      setAttempt(data);
      const init: Record<string, null> = {};
      data.questions.forEach(q => { init[q.id] = null; });
      setAnswers(init);
      setPhase('quiz');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể bắt đầu quiz.';
      setErrorMsg(msg);
      setPhase('error');
    }
  }

  // ── Derived state ──────────────────────────────────────────────

  const questions = attempt?.questions ?? [];
  const currentQ = questions[currentIdx];
  const answeredCount = Object.values(answers).filter(v => v !== null).length;
  const allAnswered = answeredCount === questions.length;

  // Grade label
  const score = result?.score ?? 0;
  const gradeLabel =
    score >= 90 ? 'Xuất sắc!' :
    score >= 70 ? 'Giỏi!' :
    score >= 50 ? 'Khá!' :
    'Cần cố gắng thêm!';
  const gradeColor =
    score >= 90 ? 'text-green-500' :
    score >= 70 ? 'text-blue-500' :
    score >= 50 ? 'text-amber-500' :
    'text-red-500';

  // ── PHASE: Loading ─────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-on-surface-variant font-semibold">Đang chuẩn bị bài quiz...</p>
        </div>
      </div>
    );
  }

  // ── PHASE: Error ───────────────────────────────────────────────

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-extrabold text-on-surface mb-2">Không thể tải quiz</h2>
          <p className="text-on-surface-variant mb-6">{errorMsg}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 border border-outline-variant rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              Quay lại
            </button>
            <button
              onClick={handleRetry}
              className="px-5 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── PHASE: Results ─────────────────────────────────────────────

  if (phase === 'results' && result) {
    const passed = result.passed;
    return (
      <div className="min-h-screen bg-surface font-sans">

        {/* Topbar */}
        <header className="h-16 bg-surface-container-lowest border-b border-outline-variant/30 flex items-center justify-between px-4 md:px-8 sticky top-0 z-10">
          <Link
            to={courseId ? `/courses/${courseId}` : '/courses'}
            className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-semibold text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Quay lại khóa học
          </Link>
          <div className="flex items-center gap-2 text-on-surface-variant font-semibold text-sm">
            <BookOpen className="w-4 h-4" />
            Kết quả bài quiz
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface-container-lowest border border-outline-variant/40 rounded-3xl overflow-hidden shadow-lg"
          >
            {/* Score header */}
            <div className={`p-8 text-center border-b border-outline-variant/30 ${
              passed ? 'bg-green-500/5' : 'bg-red-500/5'
            }`}>
              <div className="flex justify-center mb-4">
                <ScoreCircle score={score} />
              </div>
              <motion.h2
                className={`text-2xl font-extrabold mt-2 ${gradeColor}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
              >
                {gradeLabel}
              </motion.h2>
              <motion.div
                className="flex items-center justify-center gap-6 mt-4 text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                <div className="text-center">
                  <p className="text-2xl font-extrabold text-on-surface">{result.correctCount}</p>
                  <p className="text-on-surface-variant">Câu đúng</p>
                </div>
                <div className="w-px h-10 bg-outline-variant/50" />
                <div className="text-center">
                  <p className="text-2xl font-extrabold text-on-surface">{result.totalCount - result.correctCount}</p>
                  <p className="text-on-surface-variant">Câu sai</p>
                </div>
                <div className="w-px h-10 bg-outline-variant/50" />
                <div className="text-center">
                  <p className="text-2xl font-extrabold text-on-surface">#{result.attemptNumber}</p>
                  <p className="text-on-surface-variant">Lần thử</p>
                </div>
              </motion.div>

              {/* Pass/fail badge */}
              <motion.div
                className={`inline-flex items-center gap-2 mt-4 px-4 py-1.5 rounded-full text-sm font-bold ${
                  passed
                    ? 'bg-green-500/20 text-green-600'
                    : 'bg-red-500/20 text-red-500'
                }`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1.2, type: 'spring' }}
              >
                {passed
                  ? <><CheckCircle2 className="w-4 h-4" /> Đạt yêu cầu</>
                  : <><XCircle className="w-4 h-4" /> Chưa đạt — cần ôn lại</>
                }
              </motion.div>
            </div>

            {/* Chi tiết từng câu */}
            <div className="p-6">
              <h3 className="font-bold text-base text-on-surface mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />
                Chi tiết từng câu
              </h3>
              <div className="space-y-3">
                {result.details.map((detail: QuizResultDetail, i: number) => (
                  <ResultDetailItem key={detail.questionId} detail={detail} index={i} />
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex gap-3 justify-center">
              <button
                onClick={handleRetry}
                className="flex items-center gap-2 px-6 py-2.5 border border-outline-variant rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-container hover:border-primary hover:text-primary transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Làm lại
              </button>
              <Link
                to={courseId ? `/courses/${courseId}` : '/courses'}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                Tiếp tục học
              </Link>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  // ── PHASE: Quiz / Submitting ───────────────────────────────────

  return (
    <div className="min-h-screen bg-surface font-sans flex flex-col">

      {/* Topbar */}
      <header className="h-16 bg-surface-container-lowest border-b border-outline-variant/30 flex items-center justify-between px-4 md:px-8 flex-shrink-0 sticky top-0 z-10">
        <button
          onClick={() => setShowExitConfirm(true)}
          className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-semibold text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Thoát
        </button>

        <div className="flex items-center gap-4">
          {/* Progress */}
          <div className="hidden sm:flex items-center gap-2 text-sm text-on-surface-variant font-semibold">
            <span className="text-primary font-bold">{answeredCount}</span>
            /{questions.length} câu
          </div>

          {/* Timer */}
          {attempt?.timeLimitMinutes && phase === 'quiz' && (
            <CountdownTimer
              totalSeconds={attempt.timeLimitMinutes * 60}
              onExpire={handleTimeExpire}
            />
          )}

          {/* Attempt badge */}
          {attempt && (
            <span className="text-xs bg-surface-container px-3 py-1.5 rounded-full text-on-surface-variant font-semibold">
              Lần thử #{attempt.attemptNumber}
            </span>
          )}
        </div>
      </header>

      {/* Question progress bar */}
      <div className="h-1.5 bg-surface-container">
        <motion.div
          className="h-full bg-primary"
          animate={{ width: `${questions.length > 0 ? ((currentIdx + 1) / questions.length) * 100 : 0}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Main quiz area */}
      <main className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 py-8">

        {/* Question */}
        {currentQ && (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQ.id}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
              className="flex-1"
            >
              {/* Question header */}
              <div className="mb-6">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                  Câu {currentIdx + 1} / {questions.length}
                </p>
                <h2 className="text-xl font-bold text-on-surface leading-relaxed">
                  <LatexText content={currentQ.content} />
                </h2>
              </div>

              {/* Choices */}
              <div className="space-y-3">
                {currentQ.choices.map((choice, i) => {
                  const isSelected = answers[currentQ.id] === choice.id;
                  const letter = ['A', 'B', 'C', 'D', 'E'][i] ?? String(i + 1);
                  return (
                    <motion.button
                      key={choice.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => {
                        if (phase !== 'quiz') return;
                        setAnswers(prev => ({ ...prev, [currentQ.id]: choice.id }));
                      }}
                      disabled={phase !== 'quiz'}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                        isSelected
                          ? 'border-primary bg-primary/10 shadow-sm shadow-primary/20'
                          : 'border-outline-variant/40 hover:border-primary/40 hover:bg-surface-container'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-sm flex-shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-container-high text-on-surface-variant'
                      }`}>
                        {letter}
                      </div>
                      <span className={`font-medium text-sm leading-snug flex-1 ${
                        isSelected ? 'text-on-surface' : 'text-on-surface-variant'
                      }`}>
                        <LatexText content={choice.content} />
                      </span>
                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-primary ml-auto flex-shrink-0" />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* Navigation */}
        <div className="mt-8 pt-6 border-t border-outline-variant/30">
          {/* Dots navigation */}
          <div className="flex justify-center gap-2 mb-5 flex-wrap">
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => setCurrentIdx(i)}
                title={`Câu ${i + 1}`}
                className={`rounded-full transition-all duration-200 ${
                  i === currentIdx
                    ? 'w-6 h-3 bg-primary'
                    : answers[q.id] !== null
                    ? 'w-3 h-3 bg-primary/50 hover:bg-primary/70'
                    : 'w-3 h-3 bg-surface-container-high hover:bg-outline-variant'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-outline-variant font-semibold text-sm text-on-surface-variant hover:border-primary hover:text-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Trước
            </button>

            <div className="flex-1" />

            {currentIdx < questions.length - 1 ? (
              <button
                onClick={() => setCurrentIdx(i => Math.min(questions.length - 1, i + 1))}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:bg-primary/90 transition-colors"
              >
                Tiếp theo
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!allAnswered || phase === 'submitting'}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
                  allAnswered && phase === 'quiz'
                    ? 'bg-green-500 text-white hover:bg-green-600 shadow-md shadow-green-500/30'
                    : 'bg-surface-container-high text-on-surface-variant cursor-not-allowed opacity-60'
                }`}
              >
                {phase === 'submitting'
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang nộp...</>
                  : <><Trophy className="w-4 h-4" /> Nộp bài</>
                }
              </button>
            )}
          </div>

          {/* Hint: câu chưa trả lời */}
          {!allAnswered && currentIdx === questions.length - 1 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-xs text-amber-500 font-semibold mt-3"
            >
              Còn {questions.length - answeredCount} câu chưa trả lời — vui lòng trả lời hết trước khi nộp
            </motion.p>
          )}
        </div>
      </main>

      {/* Exit confirm modal */}
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface-container-lowest rounded-2xl p-6 max-w-sm w-full shadow-xl border border-outline-variant/40"
            >
              <h3 className="text-lg font-extrabold text-on-surface mb-2">Thoát bài quiz?</h3>
              <p className="text-sm text-on-surface-variant mb-6">
                Tiến trình làm bài sẽ mất và không được lưu lại.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="px-4 py-2 rounded-xl border border-outline-variant text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  Ở lại
                </button>
                <button
                  onClick={() => navigate(-1)}
                  className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-colors"
                >
                  Thoát
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

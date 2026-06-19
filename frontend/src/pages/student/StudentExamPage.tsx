import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  AlertCircle, ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight,
  Clock, FileText, Loader2, RotateCcw, Trophy, XCircle,
} from 'lucide-react';
import { notify } from '../../lib/toast';
import {
  startStudentExam,
  submitStudentExam,
  type StudentExamQuestion,
  type StudentExamResultResponse,
  type StudentExamStartResponse,
} from '../../api/examService';

type PagePhase = 'loading' | 'error' | 'exam' | 'submitting' | 'results';

function ScoreCircle({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 15.9;
  const dash = (score / 100) * circumference;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#3b82f6' : '#ef4444';
  return (
    <div className="relative h-36 w-36">
      <svg viewBox="0 0 36 36" className="h-36 w-36 -rotate-90">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-surface-container-high" />
        <motion.circle
          cx="18"
          cy="18"
          r="15.9"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${dash} ${circumference}` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-3xl font-extrabold" style={{ color }}>{score}%</span>
      </div>
    </div>
  );
}

function CountdownTimer({ totalSeconds, onExpire }: { totalSeconds: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(totalSeconds);

  useEffect(() => {
    if (remaining <= 0) {
      onExpire();
      return;
    }
    const timeout = window.setTimeout(() => setRemaining(value => value - 1), 1000);
    return () => window.clearTimeout(timeout);
  }, [onExpire, remaining]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return (
    <div className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${
      remaining <= 60 ? 'bg-red-500/10 text-red-500' : 'bg-surface-container text-on-surface'
    }`}>
      <Clock className="h-4 w-4" />
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </div>
  );
}

export default function StudentExamPage() {
  const { courseId, slotIndex } = useParams<{ courseId: string; slotIndex: string }>();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<PagePhase>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [attempt, setAttempt] = useState<StudentExamStartResponse | null>(null);
  const [result, setResult] = useState<StudentExamResultResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [currentIdx, setCurrentIdx] = useState(0);

  const startExam = useCallback(async () => {
    if (!courseId || slotIndex === undefined) {
      setErrorMsg('Không tìm thấy bài kiểm tra.');
      setPhase('error');
      return;
    }
    setPhase('loading');
    setResult(null);
    setCurrentIdx(0);
    try {
      const data = await startStudentExam(courseId, Number(slotIndex));
      const init: Record<string, number[]> = {};
      data.questions.forEach(question => { init[question.id] = []; });
      setAttempt(data);
      setAnswers(init);
      setPhase('exam');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Không thể bắt đầu bài kiểm tra.');
      setPhase('error');
    }
  }, [courseId, slotIndex]);

  useEffect(() => {
    startExam();
  }, [startExam]);

  const handleSubmit = useCallback(async () => {
    if (!attempt) return;
    setPhase('submitting');
    try {
      const data = await submitStudentExam(attempt.attemptId, answers);
      setResult(data);
      setPhase('results');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Nộp bài thất bại.');
      setPhase('exam');
    }
  }, [answers, attempt]);

  const handleTimeExpire = useCallback(() => {
    notify.error('Hết giờ, hệ thống tự động nộp bài.');
    handleSubmit();
  }, [handleSubmit]);

  function toggleOption(question: StudentExamQuestion, optionIndex: number) {
    setAnswers(prev => {
      const current = prev[question.id] ?? [];
      if (question.type === 'single') {
        return { ...prev, [question.id]: [optionIndex] };
      }
      const next = current.includes(optionIndex)
        ? current.filter(item => item !== optionIndex)
        : [...current, optionIndex];
      return { ...prev, [question.id]: next };
    });
  }

  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
          <p className="font-semibold text-on-surface-variant">Đang chuẩn bị bài kiểm tra...</p>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-4">
        <div className="max-w-sm text-center">
          <AlertCircle className="mx-auto mb-4 h-16 w-16 text-red-500" />
          <h1 className="mb-2 text-xl font-extrabold text-on-surface">Không thể mở bài kiểm tra</h1>
          <p className="mb-6 text-on-surface-variant">{errorMsg}</p>
          <button
            onClick={() => navigate(-1)}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'results' && result && attempt) {
    return (
      <div className="min-h-screen bg-surface font-sans">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-outline-variant/30 bg-surface-container-lowest px-4 md:px-8">
          <Link to={courseId ? `/courses/${courseId}` : '/courses'} className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Quay lại khóa học
          </Link>
          <div className="flex items-center gap-2 text-sm font-bold text-on-surface">
            <FileText className="h-4 w-4" />
            Kết quả bài kiểm tra
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-8">
          <div className="overflow-hidden rounded-3xl border border-outline-variant/40 bg-surface-container-lowest shadow-lg">
            <div className={`border-b border-outline-variant/30 p-8 text-center ${result.passed ? 'bg-green-500/5' : 'bg-red-500/5'}`}>
              <div className="mb-4 flex justify-center">
                <ScoreCircle score={result.scorePercent} />
              </div>
              <h1 className={`text-2xl font-extrabold ${result.passed ? 'text-green-600' : 'text-red-500'}`}>
                {result.passed ? 'Đạt bài kiểm tra' : 'Chưa đạt bài kiểm tra'}
              </h1>
              <p className="mt-2 text-sm font-semibold text-on-surface-variant">
                {result.earnedPoints}/{result.totalPoints} điểm · Lần {result.attemptNumber}
              </p>
            </div>

            <div className="space-y-3 p-5">
              {result.details.map((detail, index) => (
                <div key={detail.questionId} className={`rounded-2xl border p-4 ${
                  detail.isCorrect ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'
                }`}>
                  <div className="flex gap-3">
                    {detail.isCorrect
                      ? <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                      : <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                    }
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-on-surface">Câu {index + 1}: {detail.text}</p>
                      {detail.correctAnswers.length > 0 && (
                        <p className="mt-2 text-xs font-semibold text-on-surface-variant">
                          Đáp án đúng: {detail.correctAnswers.map(i => i + 1).join(', ')}
                        </p>
                      )}
                      {detail.explanation && (
                        <p className="mt-2 rounded-xl bg-surface-container p-3 text-sm text-on-surface-variant">
                          {detail.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center gap-3 px-5 pb-5">
              <button
                onClick={startExam}
                className="flex items-center gap-2 rounded-xl border border-outline-variant px-5 py-2.5 text-sm font-bold text-on-surface-variant hover:bg-surface-container"
              >
                <RotateCcw className="h-4 w-4" />
                Làm lại
              </button>
              <Link
                to={courseId ? `/courses/${courseId}` : '/courses'}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
              >
                <Trophy className="h-4 w-4" />
                Tiếp tục học
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const questions = attempt?.questions ?? [];
  const currentQuestion = questions[currentIdx];
  const answeredCount = Object.values(answers).filter(value => value.length > 0).length;
  const allAnswered = answeredCount === questions.length;

  return (
    <div className="flex min-h-screen flex-col bg-surface font-sans">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-outline-variant/30 bg-surface-container-lowest px-4 md:px-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Thoát
        </button>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm font-semibold text-on-surface-variant sm:inline">
            {answeredCount}/{questions.length} câu
          </span>
          {attempt?.durationMinutes && phase === 'exam' && (
            <CountdownTimer totalSeconds={attempt.durationMinutes * 60} onExpire={handleTimeExpire} />
          )}
        </div>
      </header>

      <div className="h-1 bg-surface-container">
        <div className="h-full bg-primary transition-all" style={{ width: `${questions.length ? ((currentIdx + 1) / questions.length) * 100 : 0}%` }} />
      </div>

      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[1fr_280px]">
        <section className="rounded-3xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-lg md:p-7">
          {currentQuestion && (
            <>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase text-primary">Câu {currentIdx + 1}/{questions.length}</p>
                  <h1 className="mt-2 text-xl font-extrabold text-on-surface">{attempt?.name}</h1>
                </div>
                <span className="rounded-full bg-secondary-container px-3 py-1 text-xs font-bold text-on-secondary-container">
                  {currentQuestion.type === 'multiple' ? 'Nhiều đáp án' : 'Một đáp án'}
                </span>
              </div>

              <p className="mb-6 rounded-2xl bg-surface-container p-4 text-base font-semibold leading-relaxed text-on-surface">
                {currentQuestion.text}
              </p>

              <div className="space-y-3">
                {currentQuestion.options.map((option, index) => {
                  const selected = (answers[currentQuestion.id] ?? []).includes(index);
                  return (
                    <button
                      key={`${currentQuestion.id}-${index}`}
                      type="button"
                      onClick={() => toggleOption(currentQuestion, index)}
                      disabled={phase !== 'exam'}
                      className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
                        selected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-outline-variant/40 bg-surface hover:border-primary/40 hover:bg-surface-container'
                      }`}
                    >
                      <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-sm font-extrabold ${
                        selected ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                      }`}>
                        {index + 1}
                      </span>
                      <span className="font-semibold">{option}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 flex items-center justify-between">
                <button
                  onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                  disabled={currentIdx === 0 || phase !== 'exam'}
                  className="flex items-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold text-on-surface-variant disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" /> Trước
                </button>
                {currentIdx < questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentIdx(i => Math.min(questions.length - 1, i + 1))}
                    disabled={phase !== 'exam'}
                    className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-on-primary"
                  >
                    Tiếp <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={phase !== 'exam' || !allAnswered}
                    className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-on-primary disabled:opacity-50"
                  >
                    {phase === 'submitting' && <Loader2 className="h-4 w-4 animate-spin" />}
                    Nộp bài
                  </button>
                )}
              </div>
            </>
          )}
        </section>

        <aside className="rounded-3xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-lg">
          <h2 className="mb-3 text-sm font-extrabold text-on-surface">Bản đồ câu hỏi</h2>
          <div className="grid grid-cols-5 gap-2">
            {questions.map((question, index) => {
              const answered = (answers[question.id] ?? []).length > 0;
              const current = index === currentIdx;
              return (
                <button
                  key={question.id}
                  onClick={() => setCurrentIdx(index)}
                  className={`aspect-square rounded-xl text-sm font-extrabold transition-all ${
                    current
                      ? 'bg-primary text-on-primary'
                      : answered
                      ? 'bg-green-500/15 text-green-600'
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          <button
            onClick={handleSubmit}
            disabled={phase !== 'exam' || !allAnswered}
            className="mt-5 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary disabled:opacity-50"
          >
            Nộp bài kiểm tra
          </button>
        </aside>
      </main>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Lightbulb,
  Loader2,
  Sparkles,
} from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import { notify } from '../../lib/toast';
import { gradeExamWithAi, getExamAiGrade, type AiExamGrade } from '../../api/aiService';

function formatPoints(value: number | null | undefined) {
  if (value == null) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export default function ExamAiResultPage() {
  const { courseId, slotIndex, attemptId } = useParams<{
    courseId: string;
    slotIndex: string;
    attemptId: string;
  }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = searchParams.get('returnTo')
    || (courseId && slotIndex ? `/courses/${courseId}/exams/${slotIndex}` : '/courses');

  const [aiGrade, setAiGrade] = useState<AiExamGrade | null>(null);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!attemptId) {
      setErrorMsg('Không tìm thấy bài làm để xem kết quả.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErrorMsg('');
    getExamAiGrade(attemptId)
      .then(result => {
        if (!cancelled) setAiGrade(result);
      })
      .catch(err => {
        if (!cancelled) setErrorMsg(err instanceof Error ? err.message : 'Không tải được kết quả AI chấm.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  async function handleGrade() {
    if (!attemptId || grading) return;
    setGrading(true);
    try {
      const result = await gradeExamWithAi(attemptId);
      setAiGrade(result);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Không thể nhờ AI chấm bài.');
    } finally {
      setGrading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface font-sans">
      <DashboardHeader />

      <header className="border-b border-outline-variant/30 bg-surface-container">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <button
            type="button"
            onClick={() => navigate(returnTo)}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại bài kiểm tra
          </button>
          <div className="flex items-center gap-2 text-xs font-bold text-primary">
            <Sparkles className="h-4 w-4" />
            Kết quả sơ bộ bởi AI
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {loading && (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
              <p className="font-semibold text-on-surface-variant">Đang tải kết quả...</p>
            </div>
          </div>
        )}

        {!loading && errorMsg && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <h1 className="font-extrabold">Không thể tải kết quả</h1>
                <p className="mt-1 text-sm font-medium">{errorMsg}</p>
              </div>
            </div>
          </div>
        )}

        {!loading && !errorMsg && !aiGrade && (
          <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-8 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-3 font-bold text-on-surface">Bài làm này chưa được AI chấm sơ bộ</p>
            <p className="mt-1 text-sm font-medium text-on-surface-variant">
              Nhấn nút bên dưới để AI đọc phần tự luận và đưa ra nhận xét sơ bộ.
            </p>
            <button
              type="button"
              onClick={handleGrade}
              disabled={grading}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {grading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {grading ? 'AI đang chấm sơ bộ...' : 'Nhờ AI chấm sơ bộ'}
            </button>
          </div>
        )}

        {!loading && aiGrade && (
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-extrabold uppercase tracking-wide text-primary">
                Kết quả sơ bộ (AI)
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-on-surface">
                {(aiGrade.aiScorePercent / 10).toFixed(1).replace('.', ',')}
              </span>
              <span className="text-base font-semibold text-on-surface-variant">/ 10</span>
              <span className="ml-auto rounded-full bg-primary px-3 py-1 text-xs font-bold text-on-primary">
                Điểm sơ bộ bởi AI
              </span>
            </div>
            {aiGrade.overallComment && (
              <p className="mt-3 text-sm font-medium text-on-surface-variant">{aiGrade.overallComment}</p>
            )}
            {aiGrade.strengths.length > 0 && (
              <div className="mt-5">
                <p className="flex items-center gap-1.5 text-sm font-bold text-green-600">
                  <CheckCircle2 className="h-4 w-4" /> Điểm mạnh
                </p>
                <ul className="mt-1.5 list-disc space-y-1 pl-6 text-sm text-on-surface-variant">
                  {aiGrade.strengths.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
              </div>
            )}
            {aiGrade.improvements.length > 0 && (
              <div className="mt-5">
                <p className="flex items-center gap-1.5 text-sm font-bold text-amber-600">
                  <Lightbulb className="h-4 w-4" /> Cần cải thiện
                </p>
                <ul className="mt-1.5 list-disc space-y-1 pl-6 text-sm text-on-surface-variant">
                  {aiGrade.improvements.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
              </div>
            )}
            {aiGrade.questions.length > 0 && (
              <div className="mt-5 space-y-3 border-t border-outline-variant pt-4">
                {aiGrade.questions.map((q, index) => (
                  <div key={q.questionId} className="rounded-xl border border-outline-variant bg-surface p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-on-surface">Câu tự luận {index + 1}</span>
                      <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                        {formatPoints(q.earnedPoints)}/{formatPoints(q.maxPoints)} đ
                      </span>
                    </div>
                    {q.imageUrls.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {q.imageUrls.map((url, j) => (
                          <a key={j} href={url} target="_blank" rel="noreferrer">
                            <img
                              src={url}
                              alt={`Ảnh bài làm câu tự luận ${index + 1}`}
                              className="h-20 w-20 rounded-lg border border-outline-variant object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-sm text-on-surface-variant">{q.comment}</p>
                    {q.suggestions.length > 0 && (
                      <ul className="mt-1.5 list-disc space-y-1 pl-6 text-xs text-on-surface-variant">
                        {q.suggestions.map((s, j) => <li key={j}>{s}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="mt-5 border-t border-outline-variant pt-3 text-xs italic text-on-surface-variant">
              {aiGrade.disclaimer}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

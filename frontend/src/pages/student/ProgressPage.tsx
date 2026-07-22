import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Eye,
  FileDown,
  GraduationCap,
  Loader2,
  RotateCcw,
  Sparkles,
  Trophy,
} from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import {
  getStudentLearningProgress,
  downloadStudentLearningProgressPdf,
  type LearningChapterProgress,
  type LearningCourseProgress,
  type RequiredExamProgress,
  type StudentLearningProgress,
} from '../../api/courseProgressService';
import { notify } from '../../lib/toast';

function formatDate(value: string | null) {
  if (!value) return 'Chưa có';
  return new Date(value).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatScore(value: number | null, suffix = '') {
  if (value == null) return 'Chưa có';
  return `${Number(value).toFixed(value % 1 === 0 ? 0 : 1)}${suffix}`;
}

function scoreTone(score: number | null) {
  if (score == null) return 'text-on-surface-variant';
  if (score >= 8 || score >= 80) return 'text-green-600';
  if (score >= 5 || score >= 50) return 'text-amber-600';
  return 'text-red-500';
}

function formatStudyTime(value: number | null | undefined) {
  const seconds = Math.max(0, value ?? 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours} giờ ${minutes} phút` : `${minutes} phút`;
}

function examScoreTone(score: number | null) {
  if (score == null) return 'text-on-surface-variant';
  if (score >= 80) return 'text-green-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-500';
}

const EXAM_STATUS_LABELS: Record<RequiredExamProgress['status'], string> = {
  not_configured: 'Chưa cấu hình',
  not_submitted: 'Chưa nộp',
  in_progress: 'Đang làm',
  pending_grading: 'Chờ chấm',
  passed: 'Đạt',
  failed: 'Chưa đạt',
};

function SummaryTile({
  icon,
  label,
  value,
  note,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="text-xs font-bold uppercase text-on-surface-variant">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-on-surface">{value}</p>
      <p className="mt-1 text-xs font-medium text-on-surface-variant">{note}</p>
    </div>
  );
}

function EmptyResult({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-outline-variant/60 bg-surface p-5 text-sm font-semibold text-on-surface-variant">
      {text}
    </div>
  );
}

function ProgressPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface font-sans">
      <DashboardHeader />
      <div className="border-b border-outline-variant/30 bg-gradient-to-r from-surface-container via-surface-container to-primary/10">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4">
          <Link
            to="/courses"
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại danh sách
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}

function QuizResultRow({
  chapter,
  resultUrl,
}: {
  chapter: LearningChapterProgress;
  resultUrl: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-outline-variant/40 bg-surface p-4 sm:flex-row sm:items-center">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-green-500/10 text-green-600">
        <Trophy className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold text-on-surface">Quiz: {chapter.title}</p>
        <p className="mt-0.5 text-xs font-medium text-on-surface-variant">
          Chương {chapter.position} · {chapter.latestQuizPassed === false ? 'Chưa đạt' : 'Đã làm'} · {formatDate(chapter.latestQuizSubmittedAt)}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
        <p className={`text-lg font-extrabold ${scoreTone(chapter.latestQuizScore)}`}>
          {formatScore(chapter.latestQuizScore, '/10')}
        </p>
        {chapter.latestQuizAttemptId && (
          <Link
            to={resultUrl}
            className="mt-1 inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-on-primary hover:bg-primary/90"
          >
            <Eye className="h-4 w-4" />
            Xem kết quả
          </Link>
        )}
        {!chapter.latestQuizAttemptId && chapter.latestQuizScore != null && (
          <p className="mt-1 text-[11px] font-semibold text-on-surface-variant">
            Chưa có dữ liệu đáp án
          </p>
        )}
      </div>
    </div>
  );
}

function RequiredExamRow({ exam }: { exam: RequiredExamProgress }) {
  const passed = exam.status === 'passed';
  return (
    <div className="rounded-2xl border border-outline-variant/40 bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-on-surface">{exam.label}</p>
          <p className="mt-1 text-xs font-semibold text-on-surface-variant">
            {formatDate(exam.submittedAt)}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
          passed
            ? 'bg-green-500/10 text-green-700'
            : exam.status === 'failed'
              ? 'bg-red-500/10 text-red-600'
              : 'bg-surface-container text-on-surface-variant'
        }`}>
          {EXAM_STATUS_LABELS[exam.status]}
        </span>
      </div>
      <p className={`mt-3 text-xl font-extrabold ${examScoreTone(exam.scorePercent)}`}>
        {formatScore(exam.scorePercent, '/100')}
      </p>
      {(exam.scopeStartChapterTitle || exam.placementChapterTitle) && (
        <p className="mt-1 text-[11px] font-semibold text-on-surface-variant">
          Phạm vi: {exam.scopeStartChapterTitle ?? 'Chương đầu'} → {exam.placementChapterTitle ?? 'Chương cuối'}
        </p>
      )}
      {exam.courseVersionMatched === false && (
        <p className="mt-1 text-[11px] font-semibold text-amber-700">
          Cấu hình cũ chưa gắn phiên bản khóa học
        </p>
      )}
    </div>
  );
}

function CourseResultPanel({
  course,
}: {
  course: LearningCourseProgress;
}) {
  const completedQuizzes = course.chapters
    .filter(chapter => chapter.quizCompleted)
    .sort((a, b) => a.position - b.position);
  const assignments = course.assignments ?? [];
  const nextChapter = course.chapters.find(chapter => chapter.progressPct < 100);

  return (
    <section className="rounded-3xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <img
          src={course.thumbnailUrl || `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(course.title)}`}
          alt={course.title}
          className="h-32 w-full rounded-2xl object-cover lg:w-52"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-primary">{course.categoryName ?? 'Khóa học'}</p>
              <h2 className="mt-1 text-xl font-extrabold text-on-surface">{course.title}</h2>
              <p className="mt-1 text-sm font-medium text-on-surface-variant">
                Giáo viên: {course.teacherName ?? 'Đang cập nhật'} · Ghi danh {formatDate(course.enrolledAt)}
              </p>
              <p className="mt-1 text-xs font-semibold text-on-surface-variant">
                Phiên bản khóa học: {course.courseVersionId ?? 'Chưa ghi nhận'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/ai-tutor?tab=roadmap"
                className="inline-flex items-center gap-2 rounded-xl border border-primary px-4 py-2 text-sm font-bold text-primary hover:bg-primary/5"
              >
                <Sparkles className="h-4 w-4" /> Gợi ý học tiếp
              </Link>
              <Link
                to={`/courses/${course.courseId}`}
                className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold text-on-surface hover:bg-surface"
              >
                Vào học
              </Link>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs font-bold text-on-surface-variant">
              <span>Tiến độ khóa học</span>
              <span>{course.progressPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-surface-container">
              <div className="h-full rounded-full bg-primary" style={{ width: `${course.progressPct}%` }} />
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <p className="rounded-xl bg-surface px-3 py-2 text-xs font-bold text-on-surface">
              Bài học: {course.completedLessons}/{course.totalLessons}
            </p>
            <p className="rounded-xl bg-surface px-3 py-2 text-xs font-bold text-on-surface">
              Quiz đã làm: {completedQuizzes.length}
            </p>
            <p className="rounded-xl bg-surface px-3 py-2 text-xs font-bold text-on-surface">
              Điểm trung bình: {formatScore(course.averageScorePercent, '%')}
            </p>
            <p className="rounded-xl bg-surface px-3 py-2 text-xs font-bold text-on-surface">
              Thời gian học: {formatStudyTime(course.studyTimeSec)}
            </p>
          </div>
          {nextChapter && (
            <p className="mt-3 rounded-xl bg-primary/5 px-3 py-2 text-xs font-semibold text-primary">
              Tiếp theo: hoàn thành chương {nextChapter.position} – {nextChapter.title} ({nextChapter.progressPct}%).
            </p>
          )}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-base font-extrabold text-on-surface">Bốn bài thi bắt buộc</h3>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-extrabold text-primary">
              Đã đạt {course.passedRequiredExams ?? 0}/4
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(course.requiredExams ?? []).map(exam => (
              <RequiredExamRow key={exam.slotIndex} exam={exam} />
            ))}
          </div>
        </div>
        <div className="mb-5">
          <h3 className="mb-3 text-base font-extrabold text-on-surface">Tiến độ theo chương</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {course.chapters.map(chapter => (
              <div key={chapter.chapterId} className="rounded-2xl border border-outline-variant/40 bg-surface p-4">
                <div className="flex items-center justify-between gap-3 text-sm font-bold">
                  <span className="truncate">{chapter.position}. {chapter.title}</span>
                  <span>{chapter.progressPct}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-surface-container">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${chapter.progressPct}%` }} />
                </div>
                <p className="mt-2 text-xs font-medium text-on-surface-variant">
                  {chapter.completedLessons}/{chapter.totalLessons} bài học
                  {chapter.quizConfigured ? ` · Quiz ${chapter.quizCompleted ? 'đã làm' : 'chưa làm'}` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="mb-5 space-y-3">
          <h3 className="text-base font-extrabold text-on-surface">Kết quả bài tập</h3>
          {assignments.length === 0 ? (
            <EmptyResult text="Bạn chưa nộp bài tập nào trong khóa học này." />
          ) : assignments.map(assignment => (
            <div key={assignment.submissionId} className="flex flex-col gap-2 rounded-2xl border border-outline-variant/40 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-extrabold text-on-surface">{assignment.title}</p>
                <p className="mt-1 text-xs font-medium text-on-surface-variant">
                  {assignment.chapterTitle ?? 'Toàn khóa'} · Nộp {formatDate(assignment.submittedAt)}
                  {assignment.late ? ' · Nộp muộn' : ''}
                </p>
              </div>
              <div className="sm:text-right">
                <p className={`text-lg font-extrabold ${examScoreTone(assignment.normalizedScorePercent)}`}>
                  {assignment.score == null ? 'Chờ chấm' : `${formatScore(assignment.score)}/${formatScore(assignment.maxScore)}`}
                </p>
                <p className="text-xs font-semibold text-on-surface-variant">
                  {assignment.normalizedScorePercent == null ? assignment.status : `${formatScore(assignment.normalizedScorePercent, '%')}`}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <h3 className="text-base font-extrabold text-on-surface">Kết quả quiz đã làm</h3>
          {completedQuizzes.length === 0 ? (
            <EmptyResult text="Bạn chưa làm quiz nào trong khóa học này." />
          ) : (
            completedQuizzes.map(chapter => (
              <QuizResultRow
                key={chapter.chapterId}
                chapter={chapter}
                resultUrl={`/courses/${course.courseId}/chapters/${chapter.chapterId}/quiz?attemptId=${chapter.latestQuizAttemptId}`}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

export default function ProgressPage() {
  const [data, setData] = useState<StudentLearningProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);

  async function loadProgress() {
    setLoading(true);
    try {
      setData(await getStudentLearningProgress());
    } catch (err) {
      console.error('Không tải được tiến độ học tập:', err);
      setData({
        totalCourses: 0,
        averageProgressPct: 0,
        completedLessons: 0,
        totalLessons: 0,
        completedQuizzes: 0,
        totalQuizzes: 0,
        courses: [],
        averageScorePercent: null,
        totalStudyTimeSec: 0,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProgress();
  }, []);

  async function exportPdf() {
    setExportingPdf(true);
    try {
      await downloadStudentLearningProgressPdf();
      notify.success('Đã xuất báo cáo tiến độ PDF.');
    } catch (error) {
      console.error('Không thể xuất báo cáo tiến độ PDF:', error);
      notify.error('Không thể xuất báo cáo PDF. Vui lòng thử lại.');
    } finally {
      setExportingPdf(false);
    }
  }

  if (loading) {
    return (
      <ProgressPageShell>
        <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
            <p className="font-semibold text-on-surface-variant">Đang tải kết quả học tập...</p>
          </div>
        </div>
      </ProgressPageShell>
    );
  }

  if (!data || data.totalCourses === 0) {
    return (
      <ProgressPageShell>
        <main className="mx-auto max-w-3xl text-center">
          <div className="px-4 py-10">
            <GraduationCap className="mx-auto mb-4 h-16 w-16 text-primary" />
            <h1 className="text-2xl font-extrabold text-on-surface">Bạn chưa có khóa học đã mua</h1>
            <p className="mt-2 text-on-surface-variant">
              Khi mua khóa học và làm quiz, kết quả sẽ xuất hiện tại đây.
            </p>
            <Link to="/courses" className="mt-6 inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary">
              Khám phá khóa học
            </Link>
          </div>
        </main>
      </ProgressPageShell>
    );
  }

  return (
    <ProgressPageShell>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase text-primary">Kết quả học tập</p>
            <h1 className="mt-1 text-3xl font-extrabold text-on-surface">Tiến độ và điểm đã làm</h1>
            <p className="mt-2 text-sm text-on-surface-variant">
              Tổng hợp bài học, bài tập, quiz, bốn bài thi bắt buộc và thời gian học thực tế.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportPdf}
              disabled={exportingPdf}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Xuất báo cáo PDF
            </button>
            <button
              onClick={loadProgress}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold text-on-surface hover:bg-surface-container"
            >
              <RotateCcw className="h-4 w-4" />
              Làm mới
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryTile
            icon={<BookOpen className="h-5 w-5" />}
            label="Khóa học"
            value={String(data.totalCourses)}
            note={`Trung bình ${data.averageProgressPct}%`}
          />
          <SummaryTile
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="Bài học"
            value={`${data.completedLessons}/${data.totalLessons}`}
            note="Bài học đã hoàn thành"
          />
          <SummaryTile
            icon={<Trophy className="h-5 w-5" />}
            label="Quiz"
            value={`${data.completedQuizzes}/${data.totalQuizzes}`}
            note="Quiz đã nộp"
          />
          <SummaryTile
            icon={<ClipboardCheck className="h-5 w-5" />}
            label="Điểm trung bình"
            value={formatScore(data.averageScorePercent, '%')}
            note="Tất cả kết quả đã có điểm"
          />
          <SummaryTile
            icon={<Clock3 className="h-5 w-5" />}
            label="Thời gian học"
            value={formatStudyTime(data.totalStudyTimeSec)}
            note="Thời lượng video đã xem duy nhất"
          />
        </div>

        <div className="space-y-5">
          {data.courses.map(course => (
            <CourseResultPanel
              key={course.courseId}
              course={course}
            />
          ))}
        </div>
      </main>
    </ProgressPageShell>
  );
}

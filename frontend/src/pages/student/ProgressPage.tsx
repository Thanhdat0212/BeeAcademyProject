import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Eye,
  GraduationCap,
  Loader2,
  RotateCcw,
  Trophy,
} from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import {
  getStudentLearningProgress,
  type LearningChapterProgress,
  type LearningCourseProgress,
  type StudentLearningProgress,
} from '../../api/courseProgressService';

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

function CourseResultPanel({
  course,
}: {
  course: LearningCourseProgress;
}) {
  const completedQuizzes = course.chapters
    .filter(chapter => chapter.quizCompleted)
    .sort((a, b) => a.position - b.position);

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
            </div>
            <Link
              to={`/courses/${course.courseId}`}
              className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold text-on-surface hover:bg-surface"
            >
              Vào học
            </Link>
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

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <p className="rounded-xl bg-surface px-3 py-2 text-xs font-bold text-on-surface">
              Bài học: {course.completedLessons}/{course.totalLessons}
            </p>
            <p className="rounded-xl bg-surface px-3 py-2 text-xs font-bold text-on-surface">
              Quiz đã làm: {completedQuizzes.length}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5">
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
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProgress();
  }, []);

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
              Chỉ hiển thị khóa học đã mua/ghi danh cùng kết quả quiz đã nộp.
            </p>
          </div>
          <button
            onClick={loadProgress}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold text-on-surface hover:bg-surface-container"
          >
            <RotateCcw className="h-4 w-4" />
            Làm mới
          </button>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

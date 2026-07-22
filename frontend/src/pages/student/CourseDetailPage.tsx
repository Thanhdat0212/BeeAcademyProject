import { AlertCircle, BookOpen, Loader2, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { adaptCourseDetail } from '../../api/adapter';
import { isApiError } from '../../api/client';
import { getCourseDetail as courseServiceGetDetail, recordCoursePreview } from '../../api/courseService';
import { notify } from '../../lib/toast';
import { useCourseStore } from '../../store/useCourseStore';
import type { ChapterDetail } from '../../types/api';
import type { Course } from '../../types/course';
import LearningView from './course-detail/LearningView';
import MarketingView, { RelatedCourses } from './course-detail/MarketingView';
import { useCourseVideoDurationPreload } from './course-detail/hooks/useCourseVideoDurationPreload';

export default function CourseDetailPage() {
  // Đọc :id từ URL /courses/:id — id là UUID của BE
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const purchasedIds = useCourseStore((state) => state.purchasedIds);

  // ── State fetch từ API ──────────────────────────────────────────────────
  const [course, setCourse] = useState<Course | null>(null);
  const [rawChapters, setRawChapters] = useState<ChapterDetail[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  // ── Fetch course detail mỗi khi id thay đổi ─────────────────────────────
  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setNotFound(false);
    setLoadError(null);

    courseServiceGetDetail(id)
      .then(async (detail) => {
        if (!active) return;
        setCourse(adaptCourseDetail(detail));
        setRawChapters(detail.chapters);
      })
      .catch((err) => {
        if (!active) return;
        // Chỉ 404 mới là không tìm thấy. Lỗi mạng/5xx cần cho phép người dùng thử lại.
        if (isApiError(err) && err.status === 404) {
          setNotFound(true);
        } else {
          const message = isApiError(err) ? err.message : 'Không thể tải khóa học';
          notify.error(message);
          setLoadError(message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, purchasedIds, retryKey]);

  // ── Loading state ────────────────────────────────────────────────────────
  useCourseVideoDurationPreload(course);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-on-surface-variant">Đang tải khóa học...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 text-center">
        <AlertCircle className="w-12 h-12 text-error mb-4" />
        <h1 className="text-2xl font-bold text-on-surface mb-2">Không thể tải khóa học</h1>
        <p className="text-on-surface-variant mb-5 max-w-md">{loadError}</p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setRetryKey((value) => value + 1)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-bold text-on-primary hover:bg-primary/90"
          >
            <RotateCcw className="w-4 h-4" />
            Thử lại
          </button>
          <Link to="/courses" className="text-primary hover:underline font-bold">
            Quay lại danh sách
          </Link>
        </div>
      </div>
    );
  }

  // ── Not found state ─────────────────────────────────────────────────────
  if (notFound || !course) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="flex min-h-[48vh] flex-col items-center justify-center px-4 text-center">
          <h1 className="text-2xl font-bold text-on-surface mb-4">Không tìm thấy khóa học</h1>
          <p className="mb-5 text-on-surface-variant">Khóa học có thể đã bị gỡ hoặc chưa được xuất bản.</p>
          <Link to="/courses" className="text-primary hover:underline font-bold">
            Quay lại danh sách
          </Link>
        </div>
        <RelatedCourses />
      </div>
    );
  }

  // Kiểm tra quyền truy cập từ backend (enrolled = đã mua / GV sở hữu / Admin)
  const isEnrolled = course.isEnrolled || purchasedIds.includes(course.id);
  const courseWithAccess = { ...course, isEnrolled };
  const hasFreePreviewLesson = courseWithAccess.lessons?.some(lesson =>
    lesson.type !== 'quiz' && Boolean(lesson.isFree)
  ) ?? false;
  const isPreviewRequested = searchParams.get('preview') === '1';
  const isLearningRequested = searchParams.get('learn') === '1';
  const requestedLessonId = searchParams.get('lesson');

  function openPreview(lessonId?: string) {
    if (lessonId) {
      void recordCoursePreview(course.id, lessonId).catch(() => {
        // Tracking Marketing không được chặn người dùng học thử.
      });
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('learn');
      next.set('preview', '1');
      if (lessonId) {
        next.set('lesson', lessonId);
      } else {
        next.delete('lesson');
      }
      return next;
    });
  }

  function closePreview() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('preview');
      next.delete('lesson');
      return next;
    });
  }

  function openLearning(lessonId?: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('preview');
      next.set('learn', '1');
      if (lessonId) {
        next.set('lesson', lessonId);
      } else {
        next.delete('lesson');
      }
      return next;
    });
  }

  function closeLearning() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('learn');
      next.delete('lesson');
      return next;
    });
  }

  // BUG FIX: guard khi đã enrolled nhưng course chưa có lesson nào
  // — tránh crash trong LearningView khi activeLesson = undefined bị dereference
  if ((isEnrolled || hasFreePreviewLesson) && (!courseWithAccess.lessons || courseWithAccess.lessons.length === 0)) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4">
        <BookOpen className="w-14 h-14 text-on-surface-variant/30" />
        <h2 className="text-xl font-bold text-on-surface">Khóa học chưa có bài giảng</h2>
        <p className="text-on-surface-variant text-sm">Giáo viên đang chuẩn bị nội dung. Vui lòng quay lại sau.</p>
        <Link to="/courses" className="text-primary hover:underline font-semibold text-sm">
          Quay lại danh sách khóa học
        </Link>
      </div>
    );
  }

  return (isEnrolled && isLearningRequested) || (hasFreePreviewLesson && isPreviewRequested) ? (
    <LearningView
      course={courseWithAccess}
      rawChapters={rawChapters}
      courseId={id!}
      initialLessonId={requestedLessonId}
      onExitPreview={isEnrolled ? closeLearning : closePreview}
    />
  ) : (
    <MarketingView
      course={courseWithAccess}
      rawChapters={rawChapters}
      onStartPreview={!isEnrolled && hasFreePreviewLesson ? openPreview : undefined}
      onOpenLearning={isEnrolled ? openLearning : undefined}
    />
  );
}

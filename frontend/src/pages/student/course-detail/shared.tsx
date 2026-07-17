import { useState } from 'react';
import { Star, Video, BookOpen } from 'lucide-react';
import type { Course, Lesson } from '../../../data/mockCourses';
import { formatDurationSec } from '../../../api/adapter';
import type { StudentVideoProgress, VideoWatchedSegment } from '../../../api/studentVideoProgressService';
import type { ChapterDetail, LessonDetail } from '../../../types/api';
import { LearningView } from './LearningView';

export type MarketingSyllabusSection = Omit<ChapterDetail, 'lessons'> & { lessons: Lesson[] };


// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: LearningView
//
// Hiển thị khi user ĐÃ MUA khóa học.
// Giao diện học giống YouTube/Udemy: video player trái + sidebar mục lục phải.
//
// STATE QUAN TRỌNG:
//   activeLesson  — bài học đang xem (video/pdf), quyết định nội dung player
//   activeQuiz    — bài quiz đang mở (null = không có modal), tách biệt với activeLesson
//   quizScores    — Record<lessonId, điểm%> lưu điểm các quiz trong session
//   isSidebarOpen — toggle sidebar mục lục (ẩn/hiện)
//
// TẠI SAO activeQuiz TÁCH BIỆT activeLesson?
//   Quiz không hiển thị trong video player — chúng mở modal overlay.
//   Nếu dùng chung, khi user đóng quiz thì video player cũng bị reset.
//   Tách biệt: click quiz → setActiveQuiz(lesson), click video/pdf → setActiveLesson(lesson)
//
// SIDEBAR:
//   Mỗi item là một bài trong course.lessons
//   Quiz items: hiển thị badge "Quiz" + điểm nếu đã làm (từ quizScores)
//   Video/PDF items: hiển thị icon type + dấu tích xanh nếu isCompleted
//   Sidebar slide in/out từ bên phải với spring animation
// ═══════════════════════════════════════════════════════════════════════════════
export function formatDiscussionDate(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function avatarFor(name: string, avatarUrl?: string | null, size = 40): string {
  return avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=${size}`;
}

export function roleLabel(role: string): string {
  if (role === 'teacher') return 'Giáo viên';
  if (role === 'admin') return 'Admin';
  if (role === 'parent') return 'Phụ huynh';
  return 'Học viên';
}

export function jwtSubject(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(normalized));
    return typeof decoded.sub === 'string' ? decoded.sub : null;
  } catch {
    return null;
  }
}

export function toEmbeddableVideoUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host.includes('youtu.be')) {
      const id = parsed.pathname.replace('/', '');
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host.includes('youtube.com')) {
      if (parsed.pathname.includes('/embed/')) return url;
      const id = parsed.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host.includes('vimeo.com')) {
      const id = parsed.pathname.split('/').filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|#|$)/i.test(url);
}

export function SafeCourseImage({
  course,
  className,
  fallbackClassName = '',
  alt = '',
}: {
  course: Course;
  className: string;
  fallbackClassName?: string;
  alt?: string;
}) {
  const [failed, setFailed] = useState(false);
  const imageUrl = course.image?.trim();
  const canUseImage = Boolean(imageUrl) && !isDirectVideoUrl(imageUrl) && !failed;

  if (canUseImage) {
    return (
      <img
        src={imageUrl}
        alt={alt || course.title}
        onError={() => setFailed(true)}
        className={className}
      />
    );
  }

  return (
    <div className={`${className} ${fallbackClassName} bg-surface-container-high flex flex-col items-center justify-center text-center px-5`}>
      <BookOpen className="w-10 h-10 text-primary mb-3" />
      <p className="text-sm font-extrabold text-on-surface line-clamp-2">{course.title}</p>
      <p className="text-xs font-semibold text-on-surface-variant mt-1">{course.subject} · {course.grade}</p>
    </div>
  );
}

export function adaptLearningLesson(lesson: LessonDetail): Lesson {
  const hasVideo = Boolean(lesson.videoUrl || lesson.videoEmbedUrl);
  const hasDocuments = (lesson.documents?.length ?? 0) > 0;
  const type: Lesson['type'] = hasVideo ? 'video' : 'pdf';
  return {
    id: lesson.id,
    title: lesson.title,
    duration: formatDurationSec(lesson.durationSec),
    type,
    url: hasVideo
      ? (lesson.videoUrl ?? lesson.videoEmbedUrl ?? '#')
      : (lesson.documents?.[0]?.fileUrl ?? '#'),
    isFree: lesson.isFree,
    isCompleted: false,
    completionRule: lesson.completionRule,
    transcript: lesson.transcript,
    subtitleUrl: lesson.subtitleUrl,
    documents: lesson.documents ?? [],
  };
}

export function mergeWatchedSegments(
  current: VideoWatchedSegment[],
  incoming: VideoWatchedSegment[],
  durationSec: number,
): VideoWatchedSegment[] {
  const max = Math.max(0, Math.floor(durationSec));
  return [...current, ...incoming]
    .map(segment => ({
      startSec: Math.max(0, Math.min(Math.floor(segment.startSec), max)),
      endSec: Math.max(0, Math.min(Math.floor(segment.endSec), max)),
    }))
    .filter(segment => segment.endSec > segment.startSec)
    .sort((left, right) => left.startSec - right.startSec)
    .reduce<VideoWatchedSegment[]>((merged, segment) => {
      const previous = merged[merged.length - 1];
      if (!previous || segment.startSec > previous.endSec) {
        merged.push(segment);
      } else {
        previous.endSec = Math.max(previous.endSec, segment.endSec);
      }
      return merged;
    }, []);
}

export function watchedDurationSec(segments: VideoWatchedSegment[]): number {
  return segments.reduce((total, segment) => total + segment.endSec - segment.startSec, 0);
}

export function continuousWatchedEndSec(segments: VideoWatchedSegment[]): number {
  let end = 0;
  const tolerance = 1;
  const orderedSegments = [...segments].sort((left, right) => left.startSec - right.startSec);
  for (const segment of orderedSegments) {
    if (segment.startSec > end + tolerance) break;
    end = Math.max(end, segment.endSec);
  }
  return end;
}

export function getOrderedVideoLessons(
  sections: Array<{ lessons: Lesson[] }>,
): Lesson[] {
  return sections.flatMap((section) => section.lessons).filter((lesson) => lesson.type === 'video');
}

export function getContinueLearningLesson(
  orderedVideoLessons: Lesson[],
  completedLessonIds: string[],
  latestProgress: Pick<StudentVideoProgress, 'lessonId'> | null | undefined,
): Lesson | null {
  if (orderedVideoLessons.length === 0) return null;

  const latestIndex = latestProgress
    ? orderedVideoLessons.findIndex(lesson => lesson.id === latestProgress.lessonId)
    : -1;

  if (latestIndex >= 0) {
    if (!completedLessonIds.includes(orderedVideoLessons[latestIndex].id)) {
      return orderedVideoLessons[latestIndex];
    }
    return orderedVideoLessons[latestIndex + 1] ?? orderedVideoLessons[latestIndex];
  }

  return orderedVideoLessons.find(lesson => !completedLessonIds.includes(lesson.id))
    ?? orderedVideoLessons[orderedVideoLessons.length - 1];
}

export function getLessonUnlockState(
  course: Course,
  lesson: Lesson,
  orderedVideoLessons: Lesson[],
  completedLessonIds: string[],
): {
  canOpen: boolean;
  reason: string | null;
  lockedByPurchase: boolean;
  lockedByPrerequisite: boolean;
} {
  const hasBaseAccess = course.isEnrolled || Boolean(lesson.isFree);
  if (!hasBaseAccess) {
    return {
      canOpen: false,
      reason: 'Bài học này cần mua khóa học để mở.',
      lockedByPurchase: true,
      lockedByPrerequisite: false,
    };
  }

  if (!course.isEnrolled && Boolean(lesson.isFree)) {
    return {
      canOpen: true,
      reason: null,
      lockedByPurchase: false,
      lockedByPrerequisite: false,
    };
  }

  if (lesson.type !== 'video') {
    return {
      canOpen: true,
      reason: null,
      lockedByPurchase: false,
      lockedByPrerequisite: false,
    };
  }

  const currentVideoIndex = orderedVideoLessons.findIndex((item) => item.id === lesson.id);
  if (currentVideoIndex <= 0) {
    return {
      canOpen: true,
      reason: null,
      lockedByPurchase: false,
      lockedByPrerequisite: false,
    };
  }

  const previousVideoLesson = orderedVideoLessons[currentVideoIndex - 1];
  if (completedLessonIds.includes(previousVideoLesson.id)) {
    return {
      canOpen: true,
      reason: null,
      lockedByPurchase: false,
      lockedByPrerequisite: false,
    };
  }

  return {
    canOpen: false,
    reason: `Hoàn thành video "${previousVideoLesson.title}" trước để mở bài này.`,
    lockedByPurchase: false,
    lockedByPrerequisite: true,
  };
}

export function getLessonDisplayDuration(
  courseId: string,
  lesson: Lesson,
  lessonDurations: Record<string, Record<string, number>>,
): string {
  const durationSec = lessonDurations[courseId]?.[lesson.id];
  return durationSec && durationSec > 0 ? formatDurationSec(durationSec) : lesson.duration;
}

export function preloadLessonDuration(
  lesson: Lesson,
  onResolved: (durationSec: number) => void,
): () => void {
  const video = document.createElement('video');
  const cleanup = () => {
    video.onloadedmetadata = null;
    video.onerror = null;
    video.removeAttribute('src');
    video.load();
  };

  video.preload = 'metadata';
  video.onloadedmetadata = () => {
    if (Number.isFinite(video.duration) && video.duration > 0) {
      onResolved(video.duration);
    }
    cleanup();
  };
  video.onerror = cleanup;
  video.src = lesson.url;

  return cleanup;
}

export function getCourseProgressStats(
  chapters: Array<{ id: string; hasQuizConfig: boolean; lessons: Lesson[] }>,
  completedLessonIds: string[],
  completedQuizIds: string[],
) {
  const videoIds = new Set<string>();
  const quizIds = new Set<string>();
  const completedLessonSet = new Set(completedLessonIds);
  const completedQuizSet = new Set(completedQuizIds);

  chapters.forEach((chapter) => {
    let hasInlineQuizLesson = false;

    chapter.lessons.forEach((lesson) => {
      if (lesson.type === 'video') {
        videoIds.add(lesson.id);
      }
      if (lesson.type === 'quiz') {
        quizIds.add(lesson.id);
        hasInlineQuizLesson = true;
      }
    });

    if (chapter.hasQuizConfig && chapter.id !== 'flat-lessons' && !hasInlineQuizLesson) {
      quizIds.add(chapter.id);
    }
  });

  const completedVideoCount = [...videoIds].filter((id) => completedLessonSet.has(id)).length;
  const completedQuizCount = [...quizIds].filter((id) => completedQuizSet.has(id)).length;
  const totalItems = videoIds.size + quizIds.size;
  const completedItems = completedVideoCount + completedQuizCount;

  return {
    totalItems,
    completedItems,
    progressPercent: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
  };
}

export function renderReviewStars(value: number, clickable = false, onSelect?: (next: number) => void) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          disabled={!clickable}
          onClick={() => onSelect?.(star)}
          className={clickable ? 'transition-transform hover:scale-110' : 'cursor-default'}
        >
          <Star
            className={`h-5 w-5 ${star <= value ? 'fill-amber-500 text-amber-500' : 'text-outline-variant'}`}
          />
        </button>
      ))}
    </div>
  );
}

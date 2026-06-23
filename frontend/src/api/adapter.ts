/**
 * ============================================================================
 *  Adapter: BE response → FE Course interface
 * ----------------------------------------------------------------------------
 *  Mục tiêu: giữ UI hiện tại (CoursesPage, CourseDetailPage) khỏi refactor
 *  lớn. Adapter map shape backend (snake_case → camelCase đã handle ở BE,
 *  còn lại là khác structure) sang shape Course/Lesson cũ frontend đã quen.
 *
 *  Khi UI ổn định, có thể dần dần xoá file này và đổi component sang dùng
 *  trực tiếp type API (CourseSummary, CourseDetail).
 * ============================================================================
 */
import type {
  ChapterDetail as ApiChapter,
  CourseDetail as ApiCourseDetail,
  CourseSummary as ApiCourseSummary,
  LessonDetail as ApiLesson,
} from '../types/api';
import type { Course as UiCourse, Lesson as UiLesson, Subject, Grade } from '../data/mockCourses';

// ---------------------------------------------------------------------------
//  Helpers chuyển kiểu giá / lớp / category
// ---------------------------------------------------------------------------

/** Format giá VND nguyên (vd 499000) → chuỗi "499.000đ" như UI mock. */
export function formatPriceVnd(value: number | null | undefined): string {
  if (value == null) return 'Miễn phí';
  return value.toLocaleString('vi-VN') + 'đ';
}

/** Chuyển số giây → "mm:ss" để hiển thị duration lesson. */
export function formatDurationSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Map category slug (BE) → Subject literal (FE) để CoursesPage hiển thị
 * filter cũ. Khi UI đổi sang dropdown động từ /api/categories thì xoá.
 */
const SLUG_TO_SUBJECT: Record<string, Subject> = {
  'toan-hoc': 'Toán',
  'ngu-van': 'Văn',
  'khoa-hoc-tu-nhien': 'Lý', // BE gộp Lý/Hoá/Sinh, default Lý
  'lich-su-dia-ly': 'Sử',
  'tieng-anh': 'Tất cả',
  'tin-hoc': 'Tất cả',
  'on-thi-lop-10': 'Tất cả',
  'ky-nang-mem': 'Tất cả',
};

/** Mảng grades [8] → "Lớp 8". Nếu nhiều lớp, lấy lớp đầu tiên. */
function gradesToLabel(grades: number[]): Grade {
  if (!grades || grades.length === 0) return 'Tất cả';
  const g = grades[0];
  if (g >= 6 && g <= 9) return `Lớp ${g}` as Grade;
  return 'Tất cả';
}

// ---------------------------------------------------------------------------
//  Lesson adapter
// ---------------------------------------------------------------------------

/**
 * Lesson API (BE) → Lesson UI (FE).
 * Tự động gán type (video/pdf/quiz) dựa trên tiêu đề bài học và sự tồn tại của videoUrl.
 *
 * Với bài quiz: chỉ đặt type='quiz' để UI hiển thị icon/nhãn đúng.
 * Câu hỏi thật được load qua StudentQuizPage (/courses/:id/chapters/:chId/quiz).
 * TODO: khi CourseDetailPage được wire vào StudentQuizPage, có thể loại bỏ
 * heuristic title-matching này và lấy isQuiz từ chương trực tiếp (QuizConfig).
 */
function adaptLesson(lesson: ApiLesson): UiLesson {
  const titleLower = lesson.title.toLowerCase();
  const hasVideo = !!(lesson.videoUrl || lesson.videoEmbedUrl);
  let type: 'video' | 'pdf' | 'quiz' = 'video';

  if (
    titleLower.includes('quiz') ||
    titleLower.includes('kiểm tra') ||
    titleLower.includes('trắc nghiệm') ||
    titleLower.includes('bài tập')
  ) {
    // Chỉ đánh dấu type='quiz' — KHÔNG gán mock questions.
    // Câu hỏi thật đến từ /api/student/courses/:id/chapters/:chId/quiz (StudentQuizPage).
    type = 'quiz';
  } else if (
    // type='pdf' CHỈ khi bài KHÔNG có video VÀ có tài liệu hoặc tên bài chỉ rõ là tài liệu.
    // Nếu bài có cả video + tài liệu → type='video', tài liệu hiển thị ở tab Tổng quan.
    !hasVideo && (
      lesson.documents?.length > 0 ||
      titleLower.includes('pdf') ||
      titleLower.includes('tài liệu') ||
      titleLower.includes('đọc')
    )
  ) {
    type = 'pdf';
  }

  // Có video → url là video; không có video → url là tài liệu đầu tiên (cho PDF player)
  const url = hasVideo
    ? (lesson.videoUrl ?? lesson.videoEmbedUrl ?? '#')
    : (lesson.documents?.[0]?.fileUrl ?? '#');

  return {
    id: lesson.id,
    title: lesson.title,
    duration: formatDurationSec(lesson.durationSec),
    type,
    url,
    isFree: lesson.isFree,
    isCompleted: false,
    questions: undefined, // luôn undefined — câu hỏi thật load qua StudentQuizPage
    documents: lesson.documents ?? [],
  };
}

/** Flatten chapters[].lessons[] → 1 mảng lessons (cho UI cũ vốn flat). */
export function flattenChaptersToLessons(chapters: ApiChapter[]): UiLesson[] {
  return chapters.flatMap((ch) => ch.lessons.map(adaptLesson));
}

// ---------------------------------------------------------------------------
//  Course adapter
// ---------------------------------------------------------------------------

/**
 * CourseSummary API (list view) → Course UI.
 * Không có chapters/lessons - field lessons = undefined.
 */
export function adaptCourseSummary(summary: ApiCourseSummary, isEnrolled = false): UiCourse {
  return {
    id: summary.id,
    title: summary.title,
    description: summary.description ?? '',
    price: formatPriceVnd(summary.effectivePriceVnd),
    subject: SLUG_TO_SUBJECT[summary.categorySlug ?? ''] ?? 'Tất cả',
    grade: gradesToLabel(summary.grades),
    image: summary.thumbnailUrl ?? '',
    rating: 4.7,
    students: 1000,
    instructor: summary.teacherName ?? 'Bee Academy',
    isEnrolled,
    hasFreePreview: summary.hasFreePreview,
  };
}

/**
 * CourseDetail API (detail view) → Course UI + flat lessons.
 *
 * Trang detail hiện tại đọc `course.lessons?.map()` flat → ta flatten từ
 * chapters về 1 mảng. Khi LearningView được refactor (Module 3) thì có thể
 * truyền nguyên `chapters` xuống component và xoá hàm flatten này.
 */
export function adaptCourseDetail(detail: ApiCourseDetail): UiCourse {
  return {
    id: detail.id,
    title: detail.title,
    description: detail.description ?? '',
    detailedDescription: detail.description ?? '',
    price: formatPriceVnd(detail.effectivePriceVnd),
    subject: SLUG_TO_SUBJECT[detail.categorySlug ?? ''] ?? 'Tất cả',
    grade: gradesToLabel(detail.grades),
    image: detail.thumbnailUrl ?? '',
    rating: 4.7,
    students: 1000,
    instructor: detail.teacherName ?? 'Bee Academy',
    isEnrolled: detail.enrolled,  // ✅ từ backend: true nếu đã mua / GV sở hữu / Admin
    hasFreePreview: detail.hasFreePreview,
    lessons: flattenChaptersToLessons(detail.chapters),
  };
}

import { apiClient, unwrap } from './client';
import { getCourseDetail, getEnrolledCourses } from './courseService';
import { useCourseStore } from '../store/useCourseStore';
import type {
  ApiResponse,
  CompleteCourseProgressItemPayload,
  CourseDetail,
  CourseSummary,
  CourseProgress,
} from '../types/api';

export async function getCourseProgress(courseId: string): Promise<CourseProgress> {
  const res = await apiClient.get<ApiResponse<CourseProgress>>(
    `/api/courses/${encodeURIComponent(courseId)}/progress`,
  );
  return unwrap(res.data);
}

export async function completeCourseProgressItem(
  courseId: string,
  payload: CompleteCourseProgressItemPayload,
): Promise<CourseProgress> {
  const res = await apiClient.post<ApiResponse<CourseProgress>>(
    `/api/courses/${encodeURIComponent(courseId)}/progress/complete`,
    payload,
  );
  return unwrap(res.data);
}

export interface StudentLearningProgress {
  totalCourses: number;
  averageProgressPct: number;
  completedLessons: number;
  totalLessons: number;
  completedQuizzes: number;
  totalQuizzes: number;
  courses: LearningCourseProgress[];
  averageScorePercent: number | null;
  totalStudyTimeSec: number;
}

export interface LearningCourseProgress {
  courseId: string;
  courseVersionId: string | null;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  categoryName: string | null;
  teacherName: string | null;
  progressPct: number;
  completedLessons: number;
  totalLessons: number;
  completedQuizzes: number;
  totalQuizzes: number;
  latestQuizScore: number | null;
  finalExamPassed: boolean | null;
  allRequiredExamsPassed: boolean | null;
  passedRequiredExams: number;
  requiredExams: RequiredExamProgress[];
  enrolledAt: string | null;
  chapters: LearningChapterProgress[];
  averageScorePercent: number | null;
  studyTimeSec: number;
  assignments: AssignmentProgress[];
}

export interface RequiredExamProgress {
  slotIndex: number;
  label: string;
  status: 'not_configured' | 'not_submitted' | 'in_progress' | 'pending_grading' | 'passed' | 'failed';
  examConfigId: string | null;
  examCourseVersionId: string | null;
  courseVersionMatched: boolean | null;
  scorePercent: number | null;
  passed: boolean | null;
  submittedAt: string | null;
  scopeStartChapterId: string | null;
  scopeStartChapterTitle: string | null;
  placementChapterId: string | null;
  placementChapterTitle: string | null;
}

export interface LearningChapterProgress {
  chapterId: string;
  title: string;
  position: number;
  completedLessons: number;
  totalLessons: number;
  quizConfigured: boolean;
  quizCompleted: boolean;
  latestQuizAttemptId: string | null;
  latestQuizScore: number | null;
  latestQuizPassed: boolean | null;
  latestQuizSubmittedAt: string | null;
  lessons: LearningLessonProgress[];
  progressPct: number;
}

export interface AssignmentProgress {
  submissionId: string;
  assignmentId: string | null;
  title: string;
  chapterId: string | null;
  chapterTitle: string | null;
  status: string;
  score: number | null;
  maxScore: number | null;
  normalizedScorePercent: number | null;
  late: boolean;
  submittedAt: string | null;
  gradedAt: string | null;
}

export interface LearningLessonProgress {
  lessonId: string;
  title: string;
  position: number;
  durationSec: number | null;
  completed: boolean;
  completedAt: string | null;
}

export async function getStudentLearningProgress(): Promise<StudentLearningProgress> {
  try {
    const res = await apiClient.get<ApiResponse<StudentLearningProgress>>('/api/student/progress');
    const serverProgress = unwrap(res.data);
    if (serverProgress.courses.length > 0) {
      return enrichWithLocalQuizScores(serverProgress);
    }
    return getStudentLearningProgressFallback();
  } catch (error) {
    console.warn('Falling back to client-side progress aggregation:', error);
    return getStudentLearningProgressFallback();
  }
}

export async function downloadStudentLearningProgressPdf(): Promise<void> {
  const response = await apiClient.get<Blob>('/api/student/progress/pdf', {
    responseType: 'blob',
    timeout: 30000,
    headers: { Accept: 'application/pdf' },
  });
  const disposition = String(response.headers['content-disposition'] ?? '');
  const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
  const filename = filenameMatch?.[1] ?? 'BAO-CAO-TIEN-DO.pdf';
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function enrichWithLocalQuizScores(progress: StudentLearningProgress): StudentLearningProgress {
  const quizScores = useCourseStore.getState().quizScores;
  return {
    ...progress,
    courses: progress.courses.map(course => ({
      ...course,
      latestQuizScore: course.latestQuizScore ?? latestLocalQuizScore(course.courseId, quizScores),
      chapters: course.chapters.map(chapter => {
        const localScore = quizScores[course.courseId]?.[chapter.chapterId] ?? null;
        if (!chapter.quizCompleted || chapter.latestQuizScore != null || localScore == null) {
          return chapter;
        }
        return {
          ...chapter,
          latestQuizScore: localScore,
          latestQuizPassed: chapter.latestQuizPassed ?? true,
        };
      }),
    })),
  };
}

function latestLocalQuizScore(
  courseId: string,
  quizScores: Record<string, Record<string, number>>,
) {
  const scores = Object.values(quizScores[courseId] ?? {});
  return scores.length ? scores[scores.length - 1] : null;
}

async function getStudentLearningProgressFallback(): Promise<StudentLearningProgress> {
  const storeState = useCourseStore.getState();
  const serverCourses = await getEnrolledCourses().catch(() => []);
  const courseIds = Array.from(new Set([
    ...serverCourses.map(course => course.id),
    ...storeState.purchasedIds,
  ]));
  const summaryById = new Map<string, CourseSummary>(
    serverCourses.map(course => [course.id, course] as const),
  );

  const details = await Promise.all(courseIds.map(async courseId => {
    try {
      const [detail, progress] = await Promise.all([
        getCourseDetail(courseId),
        getCourseProgress(courseId).catch(() => localProgress(courseId)),
      ]);

      const course = summaryById.get(courseId) ?? detailToSummary(detail);
      const completedLessonSet = new Set([
        ...progress.completedLessonIds,
        ...(storeState.completedLessons[courseId] ?? []),
      ]);
      const completedQuizSet = new Set([
        ...progress.completedQuizIds,
        ...(storeState.completedQuizzes[courseId] ?? []),
      ]);
      const chapters = detail.chapters.map(chapter => {
        const lessons = chapter.lessons.map(lesson => ({
          lessonId: lesson.id,
          title: lesson.title,
          position: lesson.position,
          durationSec: lesson.durationSec ?? null,
          completed: completedLessonSet.has(lesson.id),
          completedAt: null,
        }));
        const quizCompleted = completedQuizSet.has(chapter.id);
        const localQuizScore = storeState.quizScores[courseId]?.[chapter.id] ?? null;
        const chapterCompletedLessons = lessons.filter(lesson => lesson.completed).length;
        const chapterTotalItems = lessons.length + (chapter.hasQuizConfig ? 1 : 0);
        const chapterCompletedItems = chapterCompletedLessons + (quizCompleted ? 1 : 0);
        return {
          chapterId: chapter.id,
          title: chapter.title,
          position: chapter.position,
          completedLessons: chapterCompletedLessons,
          totalLessons: lessons.length,
          quizConfigured: Boolean(chapter.hasQuizConfig),
          quizCompleted,
          latestQuizAttemptId: null,
          latestQuizScore: localQuizScore,
          latestQuizPassed: quizCompleted ? true : null,
          latestQuizSubmittedAt: null,
          lessons,
          progressPct: chapterTotalItems > 0
            ? Math.round((chapterCompletedItems * 100) / chapterTotalItems)
            : 0,
        };
      });
      const totalLessons = chapters.reduce((sum, chapter) => sum + chapter.totalLessons, 0);
      const completedLessons = chapters.reduce((sum, chapter) => sum + chapter.completedLessons, 0);
      const totalQuizzes = chapters.filter(chapter => chapter.quizConfigured).length;
      const completedQuizzes = chapters.filter(chapter => chapter.quizCompleted).length;
      const localProgressPct = calculateLocalProgressPct(chapters);
      const effectiveProgressPct = Math.max(
        progress.progressPct ?? 0,
        course.progressPct ?? 0,
        localProgressPct,
      );

      return {
        courseId: course.id,
        courseVersionId: null,
        slug: course.slug,
        title: course.title,
        thumbnailUrl: course.thumbnailUrl ?? null,
        categoryName: course.categoryName ?? null,
        teacherName: course.teacherName ?? null,
        progressPct: effectiveProgressPct,
        completedLessons,
        totalLessons,
        completedQuizzes,
        totalQuizzes,
        latestQuizScore: null,
        finalExamPassed: null,
        allRequiredExamsPassed: null,
        passedRequiredExams: 0,
        requiredExams: emptyRequiredExams(),
        enrolledAt: null,
        chapters,
        averageScorePercent: null,
        studyTimeSec: 0,
        assignments: [],
      };
    } catch (error) {
      console.warn('Skipping detailed progress for course:', courseId, error);
      const course = summaryById.get(courseId);
      return course ? emptyCourseProgress(course) : null;
    }
  }));
  const visibleDetails = details.filter((course): course is LearningCourseProgress => course !== null);

  const completedLessons = visibleDetails.reduce((sum, course) => sum + course.completedLessons, 0);
  const totalLessons = visibleDetails.reduce((sum, course) => sum + course.totalLessons, 0);
  const completedQuizzes = visibleDetails.reduce((sum, course) => sum + course.completedQuizzes, 0);
  const totalQuizzes = visibleDetails.reduce((sum, course) => sum + course.totalQuizzes, 0);
  const averageProgressPct = visibleDetails.length
    ? Math.round(visibleDetails.reduce((sum, course) => sum + course.progressPct, 0) / visibleDetails.length)
    : 0;

  return {
    totalCourses: visibleDetails.length,
    averageProgressPct,
    completedLessons,
    totalLessons,
    completedQuizzes,
    totalQuizzes,
    courses: visibleDetails,
    averageScorePercent: null,
    totalStudyTimeSec: 0,
  };
}

function localProgress(courseId: string): CourseProgress {
  const state = useCourseStore.getState();
  return {
    courseId,
    progressPct: 0,
    completedLessonIds: state.completedLessons[courseId] ?? [],
    completedQuizIds: state.completedQuizzes[courseId] ?? [],
  };
}

function emptyCourseProgress(course: CourseSummary): LearningCourseProgress {
  return {
    courseId: course.id,
    courseVersionId: null,
    slug: course.slug,
    title: course.title,
    thumbnailUrl: course.thumbnailUrl ?? null,
    categoryName: course.categoryName ?? null,
    teacherName: course.teacherName ?? null,
    progressPct: course.progressPct ?? 0,
    completedLessons: 0,
    totalLessons: course.totalLessons ?? 0,
    completedQuizzes: 0,
    totalQuizzes: 0,
    latestQuizScore: null,
    finalExamPassed: null,
    allRequiredExamsPassed: null,
    passedRequiredExams: 0,
    requiredExams: emptyRequiredExams(),
    enrolledAt: null,
    chapters: [],
    averageScorePercent: null,
    studyTimeSec: 0,
    assignments: [],
  };
}

function emptyRequiredExams(): RequiredExamProgress[] {
  return ['Giữa kỳ 1', 'Cuối kỳ 1', 'Giữa kỳ 2', 'Cuối kỳ 2'].map((label, slotIndex) => ({
    slotIndex,
    label,
    status: 'not_configured',
    examConfigId: null,
    examCourseVersionId: null,
    courseVersionMatched: null,
    scorePercent: null,
    passed: null,
    submittedAt: null,
    scopeStartChapterId: null,
    scopeStartChapterTitle: null,
    placementChapterId: null,
    placementChapterTitle: null,
  }));
}

function detailToSummary(detail: CourseDetail): CourseSummary {
  return {
    id: detail.id,
    slug: detail.slug,
    title: detail.title,
    description: detail.description,
    objective: detail.objective,
    audience: detail.audience,
    thumbnailUrl: detail.thumbnailUrl,
    introVideoUrl: detail.introVideoUrl,
    categoryName: detail.categoryName,
    categorySlug: detail.categorySlug,
    teacherName: detail.teacherName,
    grades: detail.grades,
    priceVnd: detail.priceVnd,
    salePriceVnd: detail.salePriceVnd,
    effectivePriceVnd: detail.effectivePriceVnd,
    isOnSale: detail.isOnSale,
    isFeatured: false,
    hasFreePreview: detail.chapters.some(chapter => chapter.lessons.some(lesson => lesson.isFree)),
    averageRating: detail.averageRating,
    reviewCount: detail.reviewCount,
    studentCount: detail.studentCount,
    totalChapters: detail.totalChapters,
    totalLessons: detail.totalLessons,
    totalDurationSec: detail.totalDurationSec,
    progressPct: null,
  };
}

function calculateLocalProgressPct(chapters: LearningChapterProgress[]) {
  const total = chapters.reduce((sum, chapter) => (
    sum + chapter.totalLessons + (chapter.quizConfigured ? 1 : 0)
  ), 0);
  if (total <= 0) return 0;
  const completed = chapters.reduce((sum, chapter) => (
    sum + chapter.completedLessons + (chapter.quizCompleted ? 1 : 0)
  ), 0);
  return Math.round((completed * 100) / total);
}

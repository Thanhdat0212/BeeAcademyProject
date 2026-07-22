import { useEffect } from 'react';
import { completeCourseProgressItem, getCourseProgress } from '../../../../api/courseProgressService';
import { useCourseStore } from '../../../../store/useCourseStore';

export function useCourseProgress(courseId: string, isEnrolled: boolean, accessToken: string | null) {
  const completedLessons = useCourseStore((state) => state.completedLessons);
  const hydrateCourseProgress = useCourseStore((state) => state.hydrateCourseProgress);
  const markLessonCompleted = useCourseStore((state) => state.markLessonCompleted);
  const completedQuizzes = useCourseStore((state) => state.completedQuizzes);
  const markQuizCompleted = useCourseStore((state) => state.markQuizCompleted);
  const lessonDurations = useCourseStore((state) => state.lessonDurations);
  const saveLessonDuration = useCourseStore((state) => state.saveLessonDuration);
  const videoPositions = useCourseStore((state) => state.videoPositions);
  const saveVideoPosition = useCourseStore((state) => state.saveVideoPosition);
  const quizScores = useCourseStore((state) => state.quizScores);
  const saveQuizScore = useCourseStore((state) => state.saveQuizScore);

  useEffect(() => {
    if (!isEnrolled || !accessToken) return;

    let cancelled = false;
    getCourseProgress(courseId)
      .then(async (progress) => {
        const localLessonIds = completedLessons[courseId] ?? [];
        const localQuizIds = completedQuizzes[courseId] ?? [];
        const serverLessonIds = new Set(progress.completedLessonIds);
        const serverQuizIds = new Set(progress.completedQuizIds);
        const missingLessonIds = localLessonIds.filter((id) => !serverLessonIds.has(id));
        const missingQuizIds = localQuizIds.filter((id) => !serverQuizIds.has(id));

        if (missingLessonIds.length > 0 || missingQuizIds.length > 0) {
          await Promise.allSettled([
            ...missingLessonIds.map((itemId) =>
              completeCourseProgressItem(courseId, { itemId, itemType: 'lesson' as const }),
            ),
            ...missingQuizIds.map((itemId) =>
              completeCourseProgressItem(courseId, { itemId, itemType: 'quiz' as const }),
            ),
          ]);
          progress = await getCourseProgress(courseId);
        }

        const hasSameLessons =
          localLessonIds.length === progress.completedLessonIds.length &&
          localLessonIds.every((id) => progress.completedLessonIds.includes(id));
        const hasSameQuizzes =
          localQuizIds.length === progress.completedQuizIds.length &&
          localQuizIds.every((id) => progress.completedQuizIds.includes(id));

        if (!cancelled && (!hasSameLessons || !hasSameQuizzes)) {
          hydrateCourseProgress(courseId, progress.completedLessonIds, progress.completedQuizIds);
        }
      })
      .catch((error) => {
        console.error('Không tải được tiến độ khóa học:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [
    accessToken,
    completedLessons,
    completedQuizzes,
    courseId,
    hydrateCourseProgress,
    isEnrolled,
  ]);

  return {
    completedLessons,
    completedList: completedLessons[courseId] ?? [],
    hydrateCourseProgress,
    markLessonCompleted,
    completedQuizzes,
    completedQuizList: completedQuizzes[courseId] ?? [],
    markQuizCompleted,
    lessonDurations,
    saveLessonDuration,
    videoPositions,
    saveVideoPosition,
    quizScores,
    saveQuizScore,
  };
}

import { useEffect } from 'react';
import { useCourseStore } from '../../../../store/useCourseStore';
import type { Course } from '../../../../types/course';
import { isDirectVideoUrl, preloadLessonDuration } from '../courseDetailUtils';

export function useCourseVideoDurationPreload(course: Course | null) {
  const lessonDurations = useCourseStore((state) => state.lessonDurations);
  const saveLessonDuration = useCourseStore((state) => state.saveLessonDuration);

  useEffect(() => {
    if (!course?.lessons?.length) return;

    const storedDurations = lessonDurations[course.id] ?? {};
    const candidates = course.lessons.filter((lesson) =>
      lesson.type === 'video' &&
      lesson.duration === '00:00' &&
      lesson.url !== '#' &&
      isDirectVideoUrl(lesson.url) &&
      !storedDurations[lesson.id]
    );

    const cleanups = candidates.map((lesson) =>
      preloadLessonDuration(lesson, (durationSec) => {
        saveLessonDuration(course.id, lesson.id, durationSec);
      })
    );

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [course, lessonDurations, saveLessonDuration]);
}

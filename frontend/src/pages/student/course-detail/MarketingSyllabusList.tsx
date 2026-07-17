import { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PlayCircle, FileText, CheckCircle2, Lock, ClipboardList, Plus, Minus } from 'lucide-react';
import type { Course } from '../../../data/mockCourses';
import { getLessonDisplayDuration, getLessonUnlockState, getOrderedVideoLessons, type MarketingSyllabusSection } from './shared';


export function MarketingSyllabusList({
  course,
  sections,
  expandedChapterIds,
  completedList,
  lessonDurations,
  isOwnedCourse,
  onToggleChapter,
  onStartPreview,
  onOpenLearning,
}: {
  course: Course;
  sections: MarketingSyllabusSection[];
  expandedChapterIds: Set<string>;
  completedList: string[];
  lessonDurations: Record<string, Record<string, number>>;
  isOwnedCourse: boolean;
  onToggleChapter: (chapterId: string) => void;
  onStartPreview?: (lessonId?: string) => void;
  onOpenLearning?: (lessonId?: string) => void;
}) {
  const orderedVideoLessons = useMemo(
    () => getOrderedVideoLessons(sections),
    [sections],
  );

  return (
    <div className="space-y-7">
      {sections.map((chapter, chapterIndex) => {
        const isExpanded = expandedChapterIds.has(chapter.id);
        const videoLessons = chapter.lessons.filter(lesson => lesson.type === 'video');
        const completedVideoCount = videoLessons.filter(lesson =>
          completedList.includes(lesson.id)
        ).length;

        return (
          <section key={chapter.id} className="space-y-3">
            <button
              type="button"
              onClick={() => onToggleChapter(chapter.id)}
              aria-expanded={isExpanded}
              className="w-full flex items-start justify-between gap-4 text-left"
            >
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-wide text-primary">
                  Chương {chapterIndex + 1}
                </p>
                <h3 className="text-base font-extrabold leading-snug text-on-surface">
                  {chapter.title}
                </h3>
              </div>
              <span className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container">
                {isExpanded ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </span>
            </button>

            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 pl-1 sm:pl-3">
                    {chapter.lessons.map((lesson, lessonIndex) => {
                      const isLessonCompleted = completedList.includes(lesson.id);
                      const canPreviewLesson = Boolean(lesson.isFree && onStartPreview);
                      const unlockState = getLessonUnlockState(course, lesson, orderedVideoLessons, completedList);
                      const canOpen = unlockState.canOpen && (isOwnedCourse || canPreviewLesson);
                      const lockLabel = unlockState.lockedByPrerequisite
                        ? 'Hoàn thành bài trước'
                        : 'Cần mua khóa';

                      return (
                        <button
                          type="button"
                          key={lesson.id}
                          onClick={() => {
                            if (isOwnedCourse) {
                              onOpenLearning?.(lesson.id);
                            } else if (canPreviewLesson) {
                              onStartPreview?.(lesson.id);
                            }
                          }}
                          disabled={!canOpen}
                          className={`w-full rounded-2xl border px-4 py-3 text-left transition-all disabled:cursor-default ${isLessonCompleted
                              ? 'border-green-500/25 bg-green-500/5 text-green-700'
                              : canPreviewLesson
                                ? 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10'
                                : 'border-transparent bg-surface hover:bg-surface-container disabled:hover:bg-surface'
                            }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${isLessonCompleted
                                ? 'bg-green-500/15 text-green-600'
                                : canPreviewLesson
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-surface-container-high text-on-surface-variant'
                              }`}>
                              {isLessonCompleted
                                ? <CheckCircle2 className="h-4 w-4" />
                                : !canOpen
                                  ? <Lock className="h-4 w-4" />
                                  : lesson.type === 'video'
                                    ? <PlayCircle className="h-4 w-4" />
                                    : lesson.type === 'pdf'
                                      ? <FileText className="h-4 w-4" />
                                      : <ClipboardList className="h-4 w-4" />
                              }
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm font-extrabold leading-snug text-current">
                                Bài {lessonIndex + 1}: {lesson.title.replace(/^Bài\s*\d+\s*[:.-]?\s*/i, '')}
                              </h4>
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium">
                                <span className={canPreviewLesson ? 'text-primary' : 'text-on-surface-variant'}>
                                  {getLessonDisplayDuration(course.id, lesson, lessonDurations)}
                                </span>
                                {canPreviewLesson && (
                                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-extrabold text-amber-600">
                                    Học thử miễn phí
                                  </span>
                                )}
                                {isLessonCompleted && (
                                  <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-extrabold text-green-700">
                                    Đã hoàn thành
                                  </span>
                                )}
                                {!canOpen && (
                                  <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-extrabold text-on-surface-variant">
                                    {lockLabel}
                                  </span>
                                )}
                              </div>
                              {!canOpen && unlockState.reason && (
                                <p className="mt-2 text-xs font-medium text-on-surface-variant">
                                  {unlockState.reason}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}

                    {chapter.hasQuizConfig && chapter.id !== 'flat-lessons' && (
                      <div className="w-full rounded-2xl border border-transparent bg-surface-container/60 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
                            <Lock className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-extrabold text-on-surface-variant">Quiz chương {chapterIndex + 1}</p>
                            <p className="text-xs font-medium text-on-surface-variant">
                              Hoàn thành {completedVideoCount}/{videoLessons.length} video để mở quiz
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        );
      })}
    </div>
  );
}

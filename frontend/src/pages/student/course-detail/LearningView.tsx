import { useState, useEffect, useMemo, useRef, type SyntheticEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  PlayCircle,
  FileText,
  CheckCircle2,
  Lock,
  ShoppingCart,
  Video,
  Menu,
  X,
  MessageSquare,
  ClipboardList,
  ChevronLeft,
  Loader2,
  Send,
  AlertCircle,
  Plus,
  Minus,
  Clock,
  Trash2,
  Pencil,
  GraduationCap,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
} from 'lucide-react';
import EmbeddedVideoPlayer from '../../../components/EmbeddedVideoPlayer';
import QaImagePicker from '../../../components/QaImagePicker';
import type { Course, Lesson } from '../../../data/mockCourses';
import { notify } from '../../../lib/toast';
import { useCartStore } from '../../../store/useCartStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useCourseStore } from '../../../store/useCourseStore';
import { formatDurationSec } from '../../../api/adapter';
import { apiClient } from '../../../api/client';
import {
  addCourseDiscussionReply,
  createCourseDiscussionThread,
  deleteCourseDiscussionReply,
  deleteCourseDiscussionThread,
  listCourseDiscussionThreads,
  updateCourseDiscussionReply,
  updateCourseDiscussionThread,
} from '../../../api/courseDiscussionService';
import { uploadQaImage } from '../../../api/qaService';
import { completeCourseProgressItem, getCourseProgress } from '../../../api/courseProgressService';
import { createStudentLessonNote, deleteStudentLessonNote, listStudentLessonNotes } from '../../../api/studentLessonNoteService';
import { getStudentVideoProgress, saveStudentVideoProgress } from '../../../api/studentVideoProgressService';
import type { StudentExam } from '../../../api/studentExamService';
import { getStudentLearningContext } from '../../../api/studentLearningContextService';
import { getStudentDocumentDownload } from '../../../api/studentDocumentService';
import { flushOfflineLearningSyncQueue, queueCompletion, queueVideoProgress } from '../../../lib/offlineLearningSyncQueue';
import type { VideoWatchedSegment } from '../../../api/studentVideoProgressService';
import type { CourseDiscussionThread } from '../../../api/courseDiscussionService';
import type { StudentLessonNote } from '../../../api/studentLessonNoteService';
import type { ChapterDetail } from '../../../types/api';
import { CourseAssignmentsPanel } from './CourseAssignmentsPanel';
import { CourseReviewsPanel } from './CourseReviewsPanel';
import { QuizModal } from './QuizModal';
import { SafeCourseImage, adaptLearningLesson, avatarFor, continuousWatchedEndSec, formatDiscussionDate, getCourseProgressStats, getLessonDisplayDuration, getLessonUnlockState, getOrderedVideoLessons, jwtSubject, mergeWatchedSegments, roleLabel, watchedDurationSec } from './shared';


export function LearningView({ course, rawChapters, courseId, initialLessonId, onExitPreview }: {
  course: Course;
  rawChapters: ChapterDetail[];
  courseId: string;
  initialLessonId?: string | null;
  onExitPreview?: () => void;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const isPreviewMode = !course.isEnrolled;
  const addToCart = useCartStore(state => state.addToCart);
  const isLoggedIn = useAuthStore(state => state.isLoggedIn);
  const user = useAuthStore(state => state.user);
  const accessToken = useAuthStore(state => state.accessToken);
  const navigate = useNavigate();

  // BUG FIX: state báo hiệu signed video URL đã hết hạn (sau 1 giờ)
  // — browser tự phát lỗi khi URL 403, <video onError> sẽ bắt và set flag này
  const [videoUrlExpired, setVideoUrlExpired] = useState(false);
  const [usingVideoFallback, setUsingVideoFallback] = useState(false);
  const [slidePreviewUrl, setSlidePreviewUrl] = useState<string | null>(null);
  const [loadingSlidePreview, setLoadingSlidePreview] = useState(false);

  // activeQuiz: null = không hiện modal, Lesson = hiện QuizModal cho bài đó
  const [activeQuiz, setActiveQuiz] = useState<Lesson | null>(null);
  const [studentExams, setStudentExams] = useState<StudentExam[]>([]);
  const [loadingStudentExams, setLoadingStudentExams] = useState(false);

  // Lấy dữ liệu và actions từ Zustand store
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
  const completedList = completedLessons[course.id] ?? [];
  const completedQuizList = completedQuizzes[course.id] ?? [];

  // State cục bộ cho ghi chú
  const [timedNoteInput, setTimedNoteInput] = useState('');
  const [activeTimedNotes, setActiveTimedNotes] = useState<StudentLessonNote[]>([]);
  const [loadingTimedNotes, setLoadingTimedNotes] = useState(false);
  const [savingTimedNote, setSavingTimedNote] = useState(false);
  const [deletingTimedNoteId, setDeletingTimedNoteId] = useState<string | null>(null);
  const [videoNoteOverlayOpen, setVideoNoteOverlayOpen] = useState(false);
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [currentVideoDuration, setCurrentVideoDuration] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [maxSeekablePosition, setMaxSeekablePosition] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // State cục bộ cho Q&A
  const [qaInput, setQaInput] = useState('');
  const [qaImageFile, setQaImageFile] = useState<File | null>(null);
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [discussionThreads, setDiscussionThreads] = useState<CourseDiscussionThread[]>([]);
  const [loadingDiscussion, setLoadingDiscussion] = useState(false);
  const [postingQuestion, setPostingQuestion] = useState(false);
  const [postingReplyId, setPostingReplyId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingQuestionText, setEditingQuestionText] = useState('');
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editingReplyText, setEditingReplyText] = useState('');
  const [savingDiscussionId, setSavingDiscussionId] = useState<string | null>(null);
  const watchedSegmentsRef = useRef<VideoWatchedSegment[]>([]);
  const lastObservedPositionRef = useRef<number | null>(null);
  const lastObservedAtRef = useRef(0);
  const completionRequestedRef = useRef<Set<string>>(new Set());
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isResettingSeekRef = useRef(false);
  const currentPositionRef = useRef(0);
  const currentDurationRef = useRef(0);
  const maxSeekablePositionRef = useRef(0);
  const lastLocalProgressRef = useRef(-1);
  const lastRemoteSaveAtRef = useRef(0);

  const chapterSections = useMemo(() => (
    rawChapters.length > 0
      ? [...rawChapters]
        .sort((a, b) => a.position - b.position)
        .map(chapter => ({
          ...chapter,
          lessons: [...chapter.lessons]
            .sort((a, b) => a.position - b.position)
            .map(adaptLearningLesson),
        }))
      : [{
        id: 'flat-lessons',
        title: 'Nội dung khóa học',
        description: null,
        position: 1,
        hasQuizConfig: false,
        lessons: course.lessons ?? [],
      }]
  ), [rawChapters, course.lessons]);
  const examsByPlacementChapterId = useMemo(() => (
    studentExams.reduce<Record<string, StudentExam[]>>((acc, exam) => {
      const savedPlacementExists = exam.placementChapterId
        ? chapterSections.some(chapter => chapter.id === exam.placementChapterId)
        : false;
      const fallbackIndex = ((exam.slotIndex ?? 0) + 1) * 3 - 1;
      const fallbackChapter = chapterSections[Math.max(0, Math.min(chapterSections.length - 1, fallbackIndex))];
      const placementChapterId = savedPlacementExists ? exam.placementChapterId : fallbackChapter?.id;
      if (!placementChapterId) return acc;
      acc[placementChapterId] = [...(acc[placementChapterId] ?? []), exam]
        .sort((a, b) => a.slotIndex - b.slotIndex);
      return acc;
    }, {})
  ), [chapterSections, studentExams]);
  const orderedVideoLessons = useMemo(
    () => getOrderedVideoLessons(chapterSections),
    [chapterSections],
  );
  const requestedLesson = initialLessonId
    ? course.lessons?.find((lesson) => {
      if (lesson.id !== initialLessonId || lesson.type === 'quiz') {
        return false;
      }
      return getLessonUnlockState(course, lesson, orderedVideoLessons, completedList).canOpen;
    })
    : null;
  const firstLesson = requestedLesson
    ?? course.lessons?.find((lesson) =>
      lesson.type !== 'quiz' && getLessonUnlockState(course, lesson, orderedVideoLessons, completedList).canOpen
    )
    ?? course.lessons?.find((lesson) =>
      getLessonUnlockState(course, lesson, orderedVideoLessons, completedList).canOpen
    )
    ?? null;

  const [expandedChapterIds, setExpandedChapterIds] = useState<Set<string>>(
    () => new Set(chapterSections.slice(0, 1).map(chapter => chapter.id))
  );
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(firstLesson);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<string | null>(null);
  const [resumePositionSec, setResumePositionSec] = useState(0);
  const videoProgressStorageKey = `${user?.id ?? 'guest'}:${course.id}`;
  const [activeTab, setActiveTab] = useState<'overview' | 'qa' | 'notes' | 'assignments' | 'reviews'>('overview');
  const playableVideoUrl = usingVideoFallback && activeLesson?.videoFallbackUrl
    ? activeLesson.videoFallbackUrl
    : activeLesson?.url;
  const isDirectVideo = Boolean(
    activeLesson?.type === 'video' &&
    playableVideoUrl &&
    playableVideoUrl !== '#' &&
    !playableVideoUrl.includes('youtube.com') &&
    !playableVideoUrl.includes('youtu.be') &&
    !playableVideoUrl.includes('vimeo.com') &&
    !playableVideoUrl.includes('/embed/')
  );
  const synchronizedSlideDocument = useMemo(() => activeLesson?.documents?.find(document =>
    document.position === 2 && document.fileType.toLowerCase() === 'pdf',
  ) ?? null, [activeLesson]);
  const slideCueSeconds = useMemo(() => (activeLesson?.slideCueSeconds ?? '')
    .split(',')
    .map(value => Number.parseInt(value.trim(), 10))
    .filter(value => Number.isFinite(value) && value >= 0), [activeLesson?.slideCueSeconds]);
  const synchronizedSlidePage = useMemo(() => {
    if (slideCueSeconds.length === 0) return 1;
    const currentCue = slideCueSeconds.reduce((page, cue, index) =>
      currentVideoTime >= cue ? index + 1 : page, 1);
    return currentCue;
  }, [currentVideoTime, slideCueSeconds]);

  useEffect(() => {
    if (!course.isEnrolled || !activeLesson || !synchronizedSlideDocument?.id) {
      setSlidePreviewUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setLoadingSlidePreview(true);
    getStudentDocumentDownload(course.id, activeLesson.id, synchronizedSlideDocument.id)
      .then(result => fetch(new URL(result.downloadUrl, apiClient.defaults.baseURL).toString(), {
        cache: 'no-store',
      }))
      .then(async response => {
        if (!response.ok) throw new Error('Không thể tải slide để xem.');
        return response.blob();
      })
      .then(blob => {
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setSlidePreviewUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setSlidePreviewUrl(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlidePreview(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [activeLesson?.id, course.id, course.isEnrolled, synchronizedSlideDocument?.id]);

  useEffect(() => {
    if (!course.isEnrolled || user?.role !== 'student') return;
    const flush = () => {
      void flushOfflineLearningSyncQueue().then(count => {
        if (count > 0) notify.success(`Đã đồng bộ ${count} cập nhật học tập đang chờ.`);
      });
    };
    flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [course.isEnrolled, user?.role]);
  const canSubmitReview = course.isEnrolled && user?.role === 'student';
  useEffect(() => {
    setActiveLesson(firstLesson);
    setActiveQuiz(null);
    setActiveTab('overview');
    setVideoUrlExpired(false);
    setExpandedChapterIds(new Set(chapterSections.slice(0, 1).map(chapter => chapter.id)));
  }, [chapterSections, course.id, firstLesson]);

  // Một call learning-context lấy cả exams + progress thay cho 2 call riêng
  // (listStudentExams + getCourseProgress) — DB ở region xa nên mỗi call bớt
  // được là bớt ~0.5s. Đọc completedLessons/Quizzes qua getState() thay vì
  // dependency để effect chỉ chạy khi đổi khóa học, không refetch mỗi lần
  // hoàn thành một bài.
  useEffect(() => {
    if (!course.isEnrolled || !accessToken) {
      setStudentExams([]);
      return;
    }

    let cancelled = false;
    setLoadingStudentExams(true);
    getStudentLearningContext(course.id)
      .then(async ({ progress: initialProgress, exams }) => {
        if (!cancelled) setStudentExams(exams);

        let progress = initialProgress;
        const storeState = useCourseStore.getState();
        const localLessonIds = storeState.completedLessons[course.id] ?? [];
        const localQuizIds = storeState.completedQuizzes[course.id] ?? [];
        const serverLessonIds = new Set(progress.completedLessonIds);
        const serverQuizIds = new Set(progress.completedQuizIds);
        const missingLessonIds = localLessonIds.filter(id => !serverLessonIds.has(id));
        const missingQuizIds = localQuizIds.filter(id => !serverQuizIds.has(id));

        if (missingLessonIds.length > 0 || missingQuizIds.length > 0) {
          await Promise.allSettled([
            ...missingLessonIds.map(itemId =>
              completeCourseProgressItem(course.id, { itemId, itemType: 'lesson' as const }),
            ),
            ...missingQuizIds.map(itemId =>
              completeCourseProgressItem(course.id, { itemId, itemType: 'quiz' as const }),
            ),
          ]);
          progress = await getCourseProgress(course.id);
        }

        const nextLessonIds = progress.completedLessonIds;
        const nextQuizIds = progress.completedQuizIds;
        const hasSameLessons =
          localLessonIds.length === nextLessonIds.length &&
          localLessonIds.every(id => nextLessonIds.includes(id));
        const hasSameQuizzes =
          localQuizIds.length === nextQuizIds.length &&
          localQuizIds.every(id => nextQuizIds.includes(id));

        if (!cancelled && (!hasSameLessons || !hasSameQuizzes)) {
          hydrateCourseProgress(course.id, progress.completedLessonIds, progress.completedQuizIds);
        }
      })
      .catch(error => {
        if (!cancelled) {
          console.warn('Không tải được dữ liệu học tập:', error);
          setStudentExams([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingStudentExams(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, course.id, course.isEnrolled, hydrateCourseProgress]);

  useEffect(() => {
    const localProgress = activeLesson
      ? videoPositions[videoProgressStorageKey]?.[activeLesson.id]
      : undefined;
    const localPosition = localProgress?.positionSec ?? 0;
    watchedSegmentsRef.current = localProgress?.watchedSegments ?? [];
    const localMaxSeekablePosition = Math.max(
      localPosition,
      continuousWatchedEndSec(watchedSegmentsRef.current),
    );
    lastObservedPositionRef.current = null;
    lastObservedAtRef.current = 0;
    currentPositionRef.current = localPosition;
    currentDurationRef.current = localProgress?.durationSec ?? 0;
    maxSeekablePositionRef.current = localMaxSeekablePosition;
    lastLocalProgressRef.current = localPosition;
    lastRemoteSaveAtRef.current = 0;
    isResettingSeekRef.current = false;
    setCurrentVideoTime(localPosition);
    setCurrentVideoDuration(localProgress?.durationSec ?? 0);
    setMaxSeekablePosition(localMaxSeekablePosition);
    setIsVideoPlaying(false);
    setIsVideoMuted(false);
    setPlaybackRate(1);
    setResumePositionSec(localPosition);
    setTimedNoteInput('');
    setVideoNoteOverlayOpen(false);
  }, [activeLesson?.id, videoProgressStorageKey]);

  useEffect(() => {
    if (!activeLesson || activeLesson.type !== 'video' || user?.role !== 'student' || !course.isEnrolled) {
      return;
    }

    let cancelled = false;
    const lessonId = activeLesson.id;
    const localProgress = videoPositions[videoProgressStorageKey]?.[lessonId];
    getStudentVideoProgress(course.id, lessonId)
      .then(remoteProgress => {
        if (cancelled) return;
        const localUpdatedAt = localProgress?.updatedAt
          ? new Date(localProgress.updatedAt).getTime()
          : 0;
        const remoteUpdatedAt = remoteProgress.updatedAt
          ? new Date(remoteProgress.updatedAt).getTime()
          : 0;
        if (localProgress && localUpdatedAt > remoteUpdatedAt) return;

        currentPositionRef.current = remoteProgress.positionSec;
        currentDurationRef.current = remoteProgress.durationSec;
        watchedSegmentsRef.current = remoteProgress.watchedSegments ?? [];
        const remoteMaxSeekablePosition = Math.max(
          remoteProgress.positionSec,
          continuousWatchedEndSec(remoteProgress.watchedSegments ?? []),
        );
        maxSeekablePositionRef.current = remoteMaxSeekablePosition;
        setCurrentVideoTime(remoteProgress.positionSec);
        setCurrentVideoDuration(remoteProgress.durationSec);
        setMaxSeekablePosition(remoteMaxSeekablePosition);
        setResumePositionSec(remoteProgress.positionSec);
        saveVideoPosition(
          videoProgressStorageKey,
          lessonId,
          remoteProgress.positionSec,
          remoteProgress.durationSec,
          remoteProgress.updatedAt ?? undefined,
          remoteProgress.watchedSegments ?? [],
        );
      })
      .catch(() => {
        // Mất mạng không chặn việc học; vị trí cục bộ vẫn được dùng để khôi phục.
      });

    return () => {
      cancelled = true;
    };
  }, [activeLesson?.id, course.id, course.isEnrolled, user?.role, videoProgressStorageKey]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || resumePositionSec <= 0 || !Number.isFinite(video.duration)) return;
    if (video.duration - resumePositionSec <= 5) return;
    isResettingSeekRef.current = true;
    video.currentTime = Math.min(resumePositionSec, video.duration);
    window.setTimeout(() => {
      isResettingSeekRef.current = false;
    }, 0);
  }, [activeLesson?.id, resumePositionSec]);

  useEffect(() => {
    if (!activeLesson) return;

    const activeChapter = chapterSections.find(chapter =>
      chapter.lessons.some(lesson => lesson.id === activeLesson.id)
    );
    if (!activeChapter) return;

    setExpandedChapterIds(prev => {
      if (prev.has(activeChapter.id)) return prev;
      const next = new Set(prev);
      next.add(activeChapter.id);
      return next;
    });
  }, [activeLesson, chapterSections]);

  useEffect(() => {
    const shouldLoadNotes = activeTab === 'notes' || videoNoteOverlayOpen;
    if (!shouldLoadNotes || !activeLesson || user?.role !== 'student') {
      setActiveTimedNotes([]);
      return;
    }

    let cancelled = false;
    setLoadingTimedNotes(true);
    listStudentLessonNotes(course.id, activeLesson.id)
      .then(notes => {
        if (!cancelled) setActiveTimedNotes(notes);
      })
      .catch(error => {
        if (!cancelled) {
          setActiveTimedNotes([]);
          notify.error(error instanceof Error ? error.message : 'Không tải được ghi chú');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTimedNotes(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeLesson, activeTab, course.id, user?.role, videoNoteOverlayOpen]);

  useEffect(() => {
    if (activeTab !== 'qa') return;

    let cancelled = false;
    setLoadingDiscussion(true);
    listCourseDiscussionThreads(course.id)
      .then(items => {
        if (!cancelled) setDiscussionThreads(items);
      })
      .catch(error => {
        if (!cancelled) {
          notify.error(error instanceof Error ? error.message : 'Không tải được thảo luận');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDiscussion(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, course.id]);

  // Tính toán tiến độ học tập thực tế dựa trên completedLessons
  const progressStats = useMemo(
    () => getCourseProgressStats(chapterSections, completedList, completedQuizList),
    [chapterSections, completedList, completedQuizList],
  );
  const progressPercent = progressStats.progressPercent;

  // Router điều hướng click trong sidebar
  function handleLessonClick(lesson: Lesson) {
    const unlockState = getLessonUnlockState(course, lesson, orderedVideoLessons, completedList);
    if (!unlockState.canOpen) {
      notify.error(unlockState.reason ?? 'Bài học này hiện chưa thể mở.');
      return;
    }
    if (lesson.type === 'quiz') {
      setActiveQuiz(lesson);
    } else {
      setActiveLesson(lesson);
      setVideoUrlExpired(false); // reset lỗi URL cũ khi chuyển sang bài mới
      setUsingVideoFallback(false);
    }
  }

  function handleUnlockCourse() {
    if (!isLoggedIn) {
      navigate('/login', { state: { from: `/courses/${course.id}` } });
      return;
    }
    addToCart({
      id: course.id,
      title: course.title,
      priceVnd: parseInt((course.price ?? '0').replace(/\D/g, '')) || 0,
      image: course.image,
    });
    notify.success(`Đã thêm "${course.title}" vào giỏ hàng!`);
  }

  function persistCurrentVideoProgress(positionOverride?: number) {
    if (!activeLesson || activeLesson.type !== 'video') return;
    const position = Math.max(0, Math.floor(positionOverride ?? currentPositionRef.current));
    const duration = Math.max(0, Math.floor(currentDurationRef.current));
    const lessonId = activeLesson.id;
    const watchedSegments = watchedSegmentsRef.current;
    saveVideoPosition(videoProgressStorageKey, lessonId, position, duration, undefined, watchedSegments);

    if (user?.role !== 'student' || !course.isEnrolled) return;
    const payload = { positionSec: position, durationSec: duration, watchedSegments };
    if (!navigator.onLine) {
      queueVideoProgress(course.id, lessonId, payload);
      return;
    }
    lastRemoteSaveAtRef.current = Date.now();
    void saveStudentVideoProgress(course.id, activeLesson.id, payload).then(progress => {
      if (!progress.completed) return;
      markLessonCompleted(course.id, lessonId);
      void getCourseProgress(course.id)
        .then(latest => hydrateCourseProgress(course.id, latest.completedLessonIds, latest.completedQuizIds))
        .catch(() => undefined);
      notify.success('Đã hoàn thành video bài học!');
    }).catch(() => {
      completionRequestedRef.current.delete(lessonId);
      queueVideoProgress(course.id, lessonId, payload);
    });
  }

  function updateMaxSeekablePosition(positionSec: number) {
    if (!Number.isFinite(positionSec)) return;
    const normalizedPosition = Math.max(0, positionSec);
    if (normalizedPosition <= maxSeekablePositionRef.current) return;
    maxSeekablePositionRef.current = normalizedPosition;
    setMaxSeekablePosition(normalizedPosition);
  }

  function clampForwardSeek(video: HTMLVideoElement) {
    const maxAllowed = Math.min(
      Math.max(0, video.duration || maxSeekablePositionRef.current),
      maxSeekablePositionRef.current,
    );
    if (video.currentTime <= maxAllowed + 1) return false;

    isResettingSeekRef.current = true;
    video.currentTime = maxAllowed;
    currentPositionRef.current = maxAllowed;
    lastObservedPositionRef.current = maxAllowed;
    lastObservedAtRef.current = Date.now();
    setCurrentVideoTime(maxAllowed);
    window.setTimeout(() => {
      isResettingSeekRef.current = false;
    }, 0);
    notify.error('KhÃ´ng thá»ƒ tua tá»›i pháº§n chÆ°a xem.');
    return true;
  }

  function recordVideoProgress(positionSec: number, durationSec: number) {
    if (!Number.isFinite(positionSec) || !Number.isFinite(durationSec)) return;
    const normalizedPosition = Math.max(0, positionSec);
    const normalizedDuration = Math.max(0, durationSec);
    currentPositionRef.current = normalizedPosition;
    currentDurationRef.current = normalizedDuration;
    setCurrentVideoTime(normalizedPosition);
    setCurrentVideoDuration(normalizedDuration);

    const now = Date.now();
    const previousPosition = lastObservedPositionRef.current;
    const elapsedSec = lastObservedAtRef.current > 0
      ? Math.max(0, (now - lastObservedAtRef.current) / 1000)
      : 0;
    const contentDelta = previousPosition == null ? 0 : normalizedPosition - previousPosition;
    const maxContinuousDelta = Math.max(3, elapsedSec * playbackRate * 2 + 1);
    const isForwardJump = previousPosition != null
      && contentDelta > maxContinuousDelta
      && normalizedPosition > maxSeekablePositionRef.current + 1;
    if (isForwardJump) {
      const clampedPosition = Math.max(0, maxSeekablePositionRef.current);
      currentPositionRef.current = clampedPosition;
      setCurrentVideoTime(clampedPosition);
      lastObservedPositionRef.current = clampedPosition;
      lastObservedAtRef.current = now;
      return;
    }

    if (previousPosition != null && contentDelta >= 0 && contentDelta <= maxContinuousDelta) {
      watchedSegmentsRef.current = mergeWatchedSegments(
        watchedSegmentsRef.current,
        [{ startSec: previousPosition, endSec: normalizedPosition }],
        normalizedDuration,
      );
      updateMaxSeekablePosition(normalizedPosition);
    } else if (previousPosition == null || normalizedPosition <= maxSeekablePositionRef.current + 1) {
      updateMaxSeekablePosition(normalizedPosition);
    }
    lastObservedPositionRef.current = normalizedPosition;
    lastObservedAtRef.current = now;

    const wholeSecond = Math.floor(normalizedPosition);
    if (Math.abs(wholeSecond - lastLocalProgressRef.current) >= 2) {
      lastLocalProgressRef.current = wholeSecond;
      if (activeLesson) {
        saveVideoPosition(videoProgressStorageKey, activeLesson.id, wholeSecond, normalizedDuration, undefined, watchedSegmentsRef.current);
      }
    }
    const watched = watchedDurationSec(watchedSegmentsRef.current);
    const reachedCompletionThreshold = normalizedDuration > 0
      && watched >= Math.ceil(normalizedDuration * 0.9);
    if (reachedCompletionThreshold && activeLesson && !completionRequestedRef.current.has(activeLesson.id)) {
      completionRequestedRef.current.add(activeLesson.id);
      persistCurrentVideoProgress();
    } else if (Date.now() - lastRemoteSaveAtRef.current >= 10_000) {
      persistCurrentVideoProgress();
    }
  }

  useEffect(() => {
    function saveWhenLeavingPage() {
      if (document.visibilityState === 'hidden') persistCurrentVideoProgress();
    }
    document.addEventListener('visibilitychange', saveWhenLeavingPage);
    return () => {
      document.removeEventListener('visibilitychange', saveWhenLeavingPage);
      persistCurrentVideoProgress();
    };
  }, [activeLesson?.id, course.id, course.isEnrolled, user?.role, videoProgressStorageKey]);

  // Callback từ QuizModal khi user nộp bài
  async function syncCompletedProgressItem(itemId: string, itemType: 'lesson' | 'quiz') {
    if (!course.isEnrolled || !accessToken) return;

    try {
      const progress = await completeCourseProgressItem(course.id, { itemId, itemType });
      hydrateCourseProgress(course.id, progress.completedLessonIds, progress.completedQuizIds);
    } catch (error) {
      queueCompletion(course.id, itemId, itemType);
      console.error('Không lưu được tiến độ khóa học:', error);
    }
  }

  useEffect(() => {
    if (!course.isEnrolled || !activeLesson || activeLesson.type === 'video') return;
    if (activeLesson.completionRule === 'DOCUMENT_OPENED') {
      void syncCompletedProgressItem(activeLesson.id, 'lesson');
    }
  }, [activeLesson?.id, activeLesson?.completionRule, course.isEnrolled]);

  function markNonVideoLessonComplete() {
    if (!activeLesson || activeLesson.type === 'video') return;
    if (activeLesson.completionRule !== 'MARK_AS_COMPLETE') {
      notify.error('Bài học chưa cho phép đánh dấu hoàn thành thủ công.');
      return;
    }
    void syncCompletedProgressItem(activeLesson.id, 'lesson');
  }

  async function handleDownloadDocument(documentId: string) {
    if (!activeLesson || isPreviewMode) return;
    setDownloadingDocumentId(documentId);
    try {
      const result = await getStudentDocumentDownload(course.id, activeLesson.id, documentId);
      const link = document.createElement('a');
      link.href = new URL(result.downloadUrl, apiClient.defaults.baseURL).toString();
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Khong the tai tai lieu.');
    } finally {
      setDownloadingDocumentId(null);
    }
  }

  function handleVideoEnded() {
    currentPositionRef.current = 0;
    setIsVideoPlaying(false);
    persistCurrentVideoProgress(0);
  }

  function handleVideoMetadataLoaded(event: SyntheticEvent<HTMLVideoElement>) {
    if (!activeLesson) {
      return;
    }
    const video = event.currentTarget;
    saveLessonDuration(course.id, activeLesson.id, video.duration);
    currentDurationRef.current = video.duration;
    setCurrentVideoDuration(video.duration);
    if (resumePositionSec > 0 && video.duration - resumePositionSec > 5) {
      isResettingSeekRef.current = true;
      video.currentTime = Math.min(resumePositionSec, video.duration);
      window.setTimeout(() => {
        isResettingSeekRef.current = false;
      }, 0);
    }
  }

  function handleVideoTimeUpdate(event: SyntheticEvent<HTMLVideoElement>) {
    if (isResettingSeekRef.current) {
      return;
    }

    recordVideoProgress(event.currentTarget.currentTime, event.currentTarget.duration);

  }

  function handleVideoPlaybackError() {
    if (!usingVideoFallback && activeLesson?.videoFallbackUrl
        && activeLesson.videoFallbackUrl !== activeLesson.url) {
      setUsingVideoFallback(true);
      setVideoUrlExpired(false);
      notify.info('Nguồn chính gặp sự cố. Đang chuyển sang nguồn video dự phòng.');
      return;
    }
    setVideoUrlExpired(true);
  }

  function handleVideoSeeking(event: SyntheticEvent<HTMLVideoElement>) {
    const video = event.currentTarget;

    if (isResettingSeekRef.current) {
      return;
    }

    if (clampForwardSeek(video)) {
      return;
    }

    currentPositionRef.current = video.currentTime;
    lastObservedPositionRef.current = video.currentTime;
    lastObservedAtRef.current = Date.now();
  }

  function toggleDirectVideoPlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }

  function toggleDirectVideoMuted() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsVideoMuted(video.muted);
  }

  function openDirectVideoFullscreen() {
    const container = playerContainerRef.current;
    if (container?.requestFullscreen) {
      void container.requestFullscreen();
    }
  }

  function toggleChapter(chapterId: string) {
    setExpandedChapterIds(prev => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  }

  function handleQuizComplete(lessonId: string, score: number) {
    saveQuizScore(course.id, lessonId, score);
    markQuizCompleted(course.id, lessonId);
    void syncCompletedProgressItem(lessonId, 'quiz');
  }

  async function handleAddTimedNote() {
    if (!activeLesson || !isDirectVideo || !videoRef.current) {
      notify.error('Ghi chú theo mốc thời gian hiện hỗ trợ video tải trực tiếp.');
      return;
    }
    if (!timedNoteInput.trim()) {
      notify.error('Vui lòng nhập nội dung ghi chú.');
      return;
    }
    const timeSec = Math.max(0, Math.floor(videoRef.current.currentTime));
    try {
      setSavingTimedNote(true);
      const note = await createStudentLessonNote(course.id, activeLesson.id, {
        timeSec,
        content: timedNoteInput.trim(),
      });
      setActiveTimedNotes(previous =>
        [...previous, note].sort((a, b) => a.timeSec - b.timeSec),
      );
      setTimedNoteInput('');
      notify.success(`Đã lưu ghi chú tại ${formatDurationSec(timeSec)}`);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không lưu được ghi chú');
    } finally {
      setSavingTimedNote(false);
    }
  }

  async function handleDeleteTimedNote(noteId: string) {
    if (!activeLesson) return;
    try {
      setDeletingTimedNoteId(noteId);
      await deleteStudentLessonNote(course.id, activeLesson.id, noteId);
      setActiveTimedNotes(previous => previous.filter(note => note.id !== noteId));
      notify.success('Đã xóa ghi chú');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không xóa được ghi chú');
    } finally {
      setDeletingTimedNoteId(null);
    }
  }

  function upsertDiscussionThread(thread: CourseDiscussionThread) {
    setDiscussionThreads(prev => {
      const exists = prev.some(item => item.id === thread.id);
      const next = exists
        ? prev.map(item => item.id === thread.id ? thread : item)
        : [thread, ...prev];
      return next.sort((a, b) =>
        new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
      );
    });
  }

  const handleAddQuestion = async () => {
    const content = qaInput.trim();
    if (!content) return;
    try {
      setPostingQuestion(true);
      const attachment = qaImageFile ? await uploadQaImage(qaImageFile) : undefined;
      const thread = await createCourseDiscussionThread(course.id, {
        lessonId: activeLesson?.id ?? null,
        content,
        attachment,
      });
      upsertDiscussionThread(thread);
      setQaInput('');
      setQaImageFile(null);
      notify.success('Đã đăng câu hỏi thảo luận thành công!');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không đăng được câu hỏi');
    } finally {
      setPostingQuestion(false);
    }
  };

  const handleAddReply = async (questionId: string) => {
    const text = replyInputs[questionId] ?? '';
    if (!text.trim()) return;
    try {
      setPostingReplyId(questionId);
      const thread = await addCourseDiscussionReply(course.id, questionId, text.trim());
      upsertDiscussionThread(thread);
      setReplyInputs((prev) => ({ ...prev, [questionId]: '' }));
      notify.success('Đã gửi phản hồi thành công!');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không gửi được phản hồi');
    } finally {
      setPostingReplyId(null);
    }
  };

  const currentUserId = user?.id ?? jwtSubject(accessToken);

  function canEditDiscussionItem(authorId: string) {
    return Boolean(currentUserId && authorId === currentUserId);
  }

  function startEditQuestion(qa: CourseDiscussionThread) {
    setEditingReplyId(null);
    setEditingReplyText('');
    setEditingQuestionId(qa.id);
    setEditingQuestionText(qa.content);
  }

  async function handleUpdateQuestion(questionId: string) {
    const content = editingQuestionText.trim();
    if (!content) {
      notify.error('Vui lòng nhập nội dung câu hỏi');
      return;
    }
    try {
      setSavingDiscussionId(questionId);
      const updated = await updateCourseDiscussionThread(course.id, questionId, content);
      upsertDiscussionThread(updated);
      setEditingQuestionId(null);
      setEditingQuestionText('');
      notify.success('Đã cập nhật câu hỏi');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không cập nhật được câu hỏi');
    } finally {
      setSavingDiscussionId(null);
    }
  }

  async function handleDeleteQuestion(questionId: string) {
    if (!window.confirm('Xóa câu hỏi này và toàn bộ phản hồi bên dưới?')) return;
    try {
      setSavingDiscussionId(questionId);
      await deleteCourseDiscussionThread(course.id, questionId);
      setDiscussionThreads(prev => prev.filter(item => item.id !== questionId));
      notify.success('Đã xóa câu hỏi');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không xóa được câu hỏi');
    } finally {
      setSavingDiscussionId(null);
    }
  }

  function startEditReply(replyId: string, content: string) {
    setEditingQuestionId(null);
    setEditingQuestionText('');
    setEditingReplyId(replyId);
    setEditingReplyText(content);
  }

  async function handleUpdateReply(questionId: string, replyId: string) {
    const content = editingReplyText.trim();
    if (!content) {
      notify.error('Vui lòng nhập nội dung phản hồi');
      return;
    }
    try {
      setSavingDiscussionId(replyId);
      const updated = await updateCourseDiscussionReply(course.id, questionId, replyId, content);
      upsertDiscussionThread(updated);
      setEditingReplyId(null);
      setEditingReplyText('');
      notify.success('Đã cập nhật phản hồi');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không cập nhật được phản hồi');
    } finally {
      setSavingDiscussionId(null);
    }
  }

  async function handleDeleteReply(questionId: string, replyId: string) {
    if (!window.confirm('Xóa phản hồi này?')) return;
    try {
      setSavingDiscussionId(replyId);
      const updated = await deleteCourseDiscussionReply(course.id, questionId, replyId);
      upsertDiscussionThread(updated);
      notify.success('Đã xóa phản hồi');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không xóa được phản hồi');
    } finally {
      setSavingDiscussionId(null);
    }
  }

  // Q&A trong màn hình học thuộc về từng bài học, không phải toàn khóa học.
  // API trả về các thảo luận của cả khóa để tái sử dụng cho trang quản lý của giáo viên,
  // vì vậy chỉ hiển thị những câu hỏi gắn đúng với bài đang mở tại đây.
  const questionsList = discussionThreads.filter(
    thread => thread.lessonId === activeLesson?.id,
  );

  return (
    <div className="h-screen bg-surface flex flex-col font-sans overflow-hidden">

      {/* ── Topbar cố định ── */}
      <header className="h-16 bg-surface-container-lowest border-b border-outline-variant/30 flex items-center justify-between px-4 z-50 flex-shrink-0">
        <div className="flex items-center gap-4">
          {/* Nút back về danh sách khóa học */}
          <Link to="/courses" className="p-2 hover:bg-surface-container rounded-full transition-colors text-on-surface-variant hover:text-on-surface">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="h-6 w-px bg-outline-variant/50 hidden sm:block" />
          <h1 className="font-bold text-on-surface truncate max-w-[200px] sm:max-w-md text-sm">
            {course.title}
          </h1>
          {isPreviewMode && (
            <span className="hidden sm:inline-flex items-center rounded-full bg-amber-500/10 px-3 py-1 text-xs font-extrabold text-amber-600">
              Học thử
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {/* Thanh tiến độ tổng — Tính toán động từ store */}
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-sm font-semibold text-primary">{progressPercent}%</span>
            <div className="w-32 h-2 bg-surface-container-high rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
          {isPreviewMode && onExitPreview && (
            <button
              onClick={onExitPreview}
              className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-outline-variant/50 bg-surface px-4 py-2 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container"
            >
              <ChevronLeft className="h-4 w-4" />
              Thông tin khóa học
            </button>
          )}
          {isPreviewMode && (
            <button
              onClick={handleUnlockCourse}
              className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-extrabold text-on-primary shadow-md shadow-primary/20 transition-colors hover:bg-primary/90"
            >
              <ShoppingCart className="h-4 w-4" />
              Mua khóa
            </button>
          )}
          {/* Toggle sidebar mục lục */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-surface-container rounded-lg text-on-surface transition-colors flex items-center gap-2"
          >
            <Menu className="w-5 h-5" />
            <span className="hidden sm:inline font-semibold text-sm">Mục lục</span>
          </button>
        </div>
      </header>

      {/* ── Main area: player + sidebar ── */}
      <div className="flex-grow flex relative overflow-hidden bg-surface-container-lowest">

        {/* Cột nội dung: player + tabs thông tin bài học */}
        <div className={`flex flex-col flex-grow transition-all duration-300 overflow-y-auto ${isSidebarOpen ? 'lg:pr-[380px]' : ''}`}>

          {/* Video / PDF player (giả lập) */}
          <div
            ref={playerContainerRef}
            className="w-full bg-black aspect-video relative group flex-shrink-0 overflow-hidden"
          >
            {/* Lỗi tải/phát video, bao gồm signed URL đã hết hạn. */}
            {videoUrlExpired ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 px-8 text-center">
                <SafeCourseImage course={course} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
                <AlertCircle className="w-14 h-14 text-orange-400 relative z-10" />
                <p className="text-base font-semibold relative z-10">Không thể phát video, vui lòng thử lại</p>
                <p className="text-sm text-white/60 relative z-10 max-w-xs">
                  Liên kết video có thể đã hết hạn hoặc kết nối gặp sự cố. Tải lại trang để thử lại.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="relative z-10 mt-1 px-5 py-2 bg-primary hover:bg-primary/90 rounded-lg text-sm font-bold transition-colors text-on-primary"
                >
                  Tải lại trang
                </button>
              </div>
            ) : activeLesson?.type === 'video' && playableVideoUrl && playableVideoUrl !== '#' ? (
              // Kiểm tra embed URL (YouTube/Vimeo) hay direct video
              playableVideoUrl.includes('youtube.com') ||
              playableVideoUrl.includes('youtu.be') ||
              playableVideoUrl.includes('vimeo.com') ||
              playableVideoUrl.includes('/embed/') ? (
                <div className="absolute inset-0">
                  <EmbeddedVideoPlayer
                    key={`${activeLesson.id}-${playbackRate}-${usingVideoFallback ? 'fallback' : 'primary'}`}
                    url={playableVideoUrl}
                    title={activeLesson.title}
                    initialPositionSec={resumePositionSec}
                    maxAllowedPositionSec={maxSeekablePosition}
                    playbackRate={playbackRate}
                    onProgress={recordVideoProgress}
                    onPause={() => persistCurrentVideoProgress()}
                    onEnded={handleVideoEnded}
                    onError={handleVideoPlaybackError}
                  />
                  <label className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-xs font-semibold text-white">
                    Tốc độ
                    <select
                      value={playbackRate}
                      onChange={(event) => setPlaybackRate(Number(event.target.value))}
                      className="bg-transparent text-white outline-none"
                      aria-label="Tốc độ phát video"
                    >
                      {[0.75, 1, 1.25, 1.5, 2].map(rate => (
                        <option key={rate} value={rate} className="text-black">{rate}x</option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : (
                // <video> cho file upload (signed URL từ Supabase Storage, TTL 1 giờ)
                <>
                  <video
                    ref={videoRef}
                    key={`${activeLesson.id}-${usingVideoFallback ? 'fallback' : 'primary'}`}
                    src={playableVideoUrl}
                    className="absolute inset-0 h-full w-full cursor-pointer"
                    controls={false}
                    controlsList="nodownload noplaybackrate"
                    disablePictureInPicture
                    // preload="metadata": chỉ tải header video (duration, kích thước) thay vì buffer trước cả file
                    preload="metadata"
                    playsInline
                    tabIndex={-1}
                    onClick={toggleDirectVideoPlayback}
                    onLoadedMetadata={handleVideoMetadataLoaded}
                    onTimeUpdate={handleVideoTimeUpdate}
                    onSeeking={handleVideoSeeking}
                    onPlay={() => setIsVideoPlaying(true)}
                    onPause={() => {
                      setIsVideoPlaying(false);
                      persistCurrentVideoProgress();
                    }}
                    onEnded={handleVideoEnded}
                    onError={handleVideoPlaybackError}
                  >
                    {activeLesson.subtitleUrl && (
                      <track
                        kind="subtitles"
                        src={activeLesson.subtitleUrl}
                        srcLang="vi"
                        label="Tiếng Việt"
                        default
                      />
                    )}
                  </video>

                  <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-4 pb-3 pt-10 text-white">
                    <div
                      role="progressbar"
                      aria-label="Tiến trình video"
                      aria-valuemin={0}
                      aria-valuemax={Math.max(1, Math.floor(currentVideoDuration))}
                      aria-valuenow={Math.max(0, Math.floor(currentVideoTime))}
                      tabIndex={-1}
                      className="mb-3 h-2 w-full touch-none select-none overflow-hidden rounded-full bg-white/30"
                      title="Tiến trình đã xem"
                    >
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-200"
                        style={{
                          width: `${currentVideoDuration > 0
                            ? Math.min(100, (currentVideoTime / currentVideoDuration) * 100)
                            : 0}%`,
                        }}
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={toggleDirectVideoPlayback}
                        className="rounded-full p-1.5 hover:bg-white/15"
                        aria-label={isVideoPlaying ? 'Tạm dừng video' : 'Phát video'}
                      >
                        {isVideoPlaying
                          ? <Pause className="h-5 w-5 fill-current" />
                          : <PlayCircle className="h-5 w-5" />}
                      </button>
                      <button
                        type="button"
                        onClick={toggleDirectVideoMuted}
                        className="rounded-full p-1.5 hover:bg-white/15"
                        aria-label={isVideoMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                      >
                        {isVideoMuted
                          ? <VolumeX className="h-5 w-5" />
                          : <Volume2 className="h-5 w-5" />}
                      </button>
                      <span className="font-mono text-xs font-semibold tabular-nums">
                        {formatDurationSec(Math.floor(currentVideoTime))}
                        {' / '}
                        {formatDurationSec(Math.floor(currentVideoDuration))}
                      </span>
                      <label className="ml-auto flex items-center gap-1 text-xs font-semibold">
                        Tốc độ
                        <select
                          value={playbackRate}
                          onChange={(event) => {
                            const nextRate = Number(event.target.value);
                            setPlaybackRate(nextRate);
                            if (videoRef.current) videoRef.current.playbackRate = nextRate;
                          }}
                          className="rounded bg-black/40 px-1.5 py-1 text-xs text-white outline-none"
                          aria-label="Tốc độ phát video"
                        >
                          {[0.75, 1, 1.25, 1.5, 2].map(rate => (
                            <option key={rate} value={rate}>{rate}x</option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={openDirectVideoFullscreen}
                        className="rounded-full p-1.5 hover:bg-white/15"
                        aria-label="Xem toàn màn hình"
                      >
                        <Maximize className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </>
              )
            ) : activeLesson?.type === 'video' ? (
              // Video chưa có URL — có thể chưa upload hoặc backend chưa trả signed URL
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 px-8 text-center">
                <SafeCourseImage course={course} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
                <AlertCircle className="w-14 h-14 text-yellow-400 relative z-10" />
                <p className="text-base font-semibold relative z-10">Không thể phát video, vui lòng thử lại</p>
                <p className="text-sm text-white/60 relative z-10 max-w-xs">
                  {activeLesson.isFree
                    ? 'Bài học thử chưa có video khả dụng. Vui lòng thử lại sau.'
                    : 'Nội dung đang được tải lên hoặc xử lý. Vui lòng tải lại trang sau ít phút.'}
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="relative z-10 mt-2 px-5 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-bold transition-colors"
                >
                  Tải lại trang
                </button>
              </div>
            ) : activeLesson?.type === 'pdf' ? (
              // PDF viewer
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                <SafeCourseImage course={course} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
                <FileText className="w-16 h-16 mb-4 opacity-80 text-blue-400 relative z-10" />
                <h3 className="text-2xl font-bold relative z-10">Tài liệu PDF</h3>
                {activeLesson?.url && activeLesson.url !== '#' ? (
                  isPreviewMode ? (
                    <iframe
                      src={activeLesson.url}
                      title={`Tài liệu học thử ${activeLesson.title}`}
                      className="absolute inset-0 h-full w-full bg-white"
                    />
                  ) : (
                  <button
                    type="button"
                    onClick={() => activeLesson.documents?.[0]?.id && handleDownloadDocument(activeLesson.documents[0].id)}
                    disabled={!activeLesson.documents?.[0]?.id || downloadingDocumentId === activeLesson.documents[0].id}
                    className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-colors relative z-10"
                  >
                    Mở tài liệu
                  </button>
                  )
                ) : (
                  <p className="mt-4 text-sm text-white/60 relative z-10">Tài liệu đang được chuẩn bị</p>
                )}
              </div>
            ) : (
              // Thumbnail mặc định
              <SafeCourseImage course={course} alt="Thumbnail" className="absolute inset-0 w-full h-full object-cover opacity-40" />
            )}

            {synchronizedSlideDocument && (loadingSlidePreview || slidePreviewUrl) && (
              <div className="absolute left-3 top-3 z-30 hidden w-[min(34%,360px)] overflow-hidden rounded-xl border border-white/30 bg-slate-950/95 shadow-2xl lg:block">
                <div className="flex items-center justify-between border-b border-white/15 px-3 py-2 text-xs font-bold text-white">
                  <span>Slide đồng bộ</span>
                  <span>Trang {synchronizedSlidePage}</span>
                </div>
                {slidePreviewUrl ? (
                  <iframe
                    src={`${slidePreviewUrl}#page=${synchronizedSlidePage}&view=FitH`}
                    title={`Slide đồng bộ ${activeLesson?.title ?? ''}`}
                    className="h-52 w-full bg-white"
                  />
                ) : (
                  <div className="flex h-52 items-center justify-center text-xs text-white/70">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tải slide...
                  </div>
                )}
              </div>
            )}

            {/* Ghi chú nổi trực tiếp trên video để học sinh không phải cuộn xuống dưới. */}
            {user?.role === 'student' && activeLesson?.type === 'video' && !videoUrlExpired && (
              <div className="absolute right-3 top-3 z-40 sm:right-5 sm:top-5">
                {!videoNoteOverlayOpen ? (
                  <button
                    type="button"
                    onClick={() => setVideoNoteOverlayOpen(true)}
                    className="flex items-center gap-2 rounded-xl border border-white/20 bg-black/75 px-3 py-2 text-xs font-extrabold text-white shadow-xl backdrop-blur-md transition-colors hover:bg-black/90 sm:px-4 sm:py-2.5 sm:text-sm"
                  >
                    <Pencil className="h-4 w-4 text-amber-300" />
                    Ghi chú
                    {isDirectVideo && (
                      <span className="rounded-md bg-white/15 px-1.5 py-0.5 font-mono text-[11px] text-white/90">
                        {formatDurationSec(Math.floor(currentVideoTime))}
                      </span>
                    )}
                  </button>
                ) : (
                  <div className="flex max-h-[calc(56.25vw-1.5rem)] w-[min(360px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-white/20 bg-slate-950/95 text-white shadow-2xl backdrop-blur-xl sm:max-h-[calc(56.25vw-2.5rem)]">
                    <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
                      <div>
                        <h3 className="flex items-center gap-2 text-sm font-extrabold">
                          <Clock className="h-4 w-4 text-amber-300" />
                          Ghi chú tại {formatDurationSec(Math.floor(currentVideoTime))}
                        </h3>
                        <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-emerald-300">
                          <Lock className="h-3 w-3" />
                          Chỉ mình bạn xem được
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setVideoNoteOverlayOpen(false)}
                        className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
                        aria-label="Đóng ghi chú"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-3 overflow-y-auto p-3 sm:p-4">
                      {isDirectVideo ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={timedNoteInput}
                            onChange={event => setTimedNoteInput(event.target.value)}
                            onKeyDown={event => {
                              if (event.key === 'Enter') handleAddTimedNote();
                            }}
                            maxLength={2000}
                            disabled={savingTimedNote}
                            autoFocus
                            placeholder="Điều bạn chưa hiểu hoặc còn thắc mắc..."
                            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white outline-none placeholder:text-white/45 focus:border-amber-300/70"
                          />
                          <button
                            type="button"
                            onClick={handleAddTimedNote}
                            disabled={!timedNoteInput.trim() || savingTimedNote}
                            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-amber-400 px-3 py-2 text-xs font-extrabold text-slate-950 hover:bg-amber-300 disabled:opacity-50"
                            title="Lưu ghi chú tại thời điểm hiện tại"
                          >
                            {savingTimedNote
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <Send className="h-4 w-4" />}
                          </button>
                        </div>
                      ) : (
                        <p className="rounded-xl bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
                          Video nhúng chưa cung cấp mốc thời gian cho hệ thống. Hãy dùng video tải trực tiếp để ghi chú đúng giây đang phát.
                        </p>
                      )}

                      {loadingTimedNotes ? (
                        <div className="flex items-center justify-center gap-2 py-3 text-xs text-white/60">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Đang tải ghi chú...
                        </div>
                      ) : activeTimedNotes.length > 0 ? (
                        <div className="space-y-2">
                          {activeTimedNotes.map(note => (
                            <div key={note.id} className="flex items-start gap-2 rounded-xl bg-white/8 p-2.5">
                              <span className="shrink-0 rounded-lg bg-amber-400/15 px-2 py-1 font-mono text-[10px] font-extrabold text-amber-200">
                                {formatDurationSec(note.timeSec)}
                              </span>
                              <p className="min-w-0 flex-1 whitespace-pre-wrap text-xs leading-relaxed text-white/90">
                                {note.content}
                              </p>
                              <button
                                type="button"
                                onClick={() => handleDeleteTimedNote(note.id)}
                                disabled={deletingTimedNoteId === note.id}
                                className="shrink-0 rounded-lg p-1 text-red-300 hover:bg-red-400/10 disabled:opacity-50"
                                title="Xóa ghi chú"
                              >
                                {deletingTimedNoteId === note.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Trash2 className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="py-2 text-center text-xs text-white/50">
                          Chưa có ghi chú nào trong bài học này.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Thông tin bài học + tabs (Overview / Q&A / Notes) */}
          <div className="p-6 md:p-10 max-w-5xl mx-auto w-full">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
              <div>
                <h2 className="text-3xl font-extrabold text-on-surface mb-2">{activeLesson?.title}</h2>
                <div className="text-on-surface-variant font-medium flex items-center gap-2">
                  <span>Bài học</span> ·
                  <span className="text-primary">{activeLesson?.type === 'video' ? 'Video giảng' : 'Tài liệu lý thuyết'}</span>
                </div>
              </div>
            </div>

            {/* Tab navigation với animated underline indicator (layoutId) */}
            <div className="border-b border-outline-variant/30 flex gap-8 mb-8">
              {([
                { id: 'overview', label: 'Tổng quan' },
                { id: 'qa', label: 'Hỏi đáp (Q&A)' },
                { id: 'notes', label: 'Ghi chú của tôi' },
                { id: 'assignments', label: 'Bài tập' },
                { id: 'reviews', label: 'Đánh giá khóa học' },
              ] as const)
                .filter(tab => tab.id !== 'notes' || user?.role === 'student')
                .filter(tab => tab.id !== 'assignments'
                  || (user?.role === 'student' && course.isEnrolled))
                .map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-4 font-bold text-sm md:text-base transition-colors relative ${activeTab === tab.id ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div layoutId="learningTabIndicator" className="absolute bottom-0 inset-x-0 h-1 bg-primary rounded-t-full" />
                  )}
                </button>
              ))}
            </div>

            <div className="min-h-[200px]">
              <AnimatePresence mode="wait">
                {activeTab === 'overview' && (
                  <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                    <p className="text-on-surface-variant leading-relaxed text-lg">
                      Nội dung chi tiết của {activeLesson?.title}. Chú ý theo dõi kỹ các ví dụ thực hành trong bài. Sau khi học xong, hãy làm bài kiểm tra cuối chương để củng cố kiến thức.
                    </p>
                    {activeLesson?.type === 'pdf' && (
                      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h4 className="font-bold text-on-surface">Trạng thái bài học</h4>
                            <p className="text-sm text-on-surface-variant mt-1">
                              {activeLesson.completionRule === 'DOCUMENT_OPENED'
                                ? 'Bài học được hoàn thành khi tài liệu được mở.'
                                : activeLesson.completionRule === 'MARK_AS_COMPLETE'
                                ? 'Hãy đánh dấu hoàn thành sau khi học xong nội dung.'
                                : activeLesson.completionRule
                                ? 'Bài học được hoàn thành sau khi bài tập đạt điều kiện.'
                                : 'Bài học chưa được cấu hình điều kiện hoàn thành.'}
                            </p>
                          </div>
                          {activeLesson.completionRule === 'MARK_AS_COMPLETE' && !completedList.includes(activeLesson.id) && (
                            <button
                              type="button"
                              onClick={markNonVideoLessonComplete}
                              className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-on-primary hover:opacity-90"
                            >
                              Đánh dấu hoàn thành
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {activeLesson?.transcript && (
                      <details className="rounded-2xl border border-outline-variant/30 bg-surface-container p-4">
                        <summary className="cursor-pointer font-bold text-on-surface">Transcript / nội dung lời thoại</summary>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-on-surface-variant">{activeLesson.transcript}</p>
                      </details>
                    )}
                    {activeLesson?.documents && activeLesson.documents.length > 0 && (
                      <div>
                        <h4 className="font-bold text-on-surface mb-3 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          Tài liệu đính kèm
                        </h4>
                        <div className="space-y-2">
                          {activeLesson.documents.map((doc, idx) => {
                            const ext = doc.fileType?.toUpperCase() ?? 'FILE';
                            const sizeKb = doc.fileSizeBytes ? Math.round(doc.fileSizeBytes / 1024) : null;
                            if (isPreviewMode) {
                              return (
                                <div
                                  key={doc.id ?? idx}
                                  className="overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container"
                                >
                                  <div className="flex items-center gap-3 px-3 py-2">
                                    <FileText className="h-4 w-4 text-primary" />
                                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-on-surface">{doc.name}</p>
                                    <span className="text-[11px] font-bold text-on-surface-variant">Chỉ xem trực tuyến</span>
                                  </div>
                                  {doc.fileUrl ? (
                                    <iframe
                                      src={doc.fileUrl}
                                      title={`Tài liệu học thử ${doc.name}`}
                                      className="h-80 w-full bg-white"
                                    />
                                  ) : (
                                    <p className="px-3 pb-3 text-xs text-on-surface-variant">
                                      Tài liệu chưa được công khai trong bài học thử. Hãy đăng ký khóa học để tải bản cá nhân hóa.
                                    </p>
                                  )}
                                </div>
                              );
                            }
                            return (
                              <button
                                type="button"
                                key={doc.id ?? idx}
                                onClick={() => doc.id && handleDownloadDocument(doc.id)}
                                disabled={!doc.id || downloadingDocumentId === doc.id}
                                className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant/40 bg-surface-container hover:border-primary hover:bg-surface-container-high transition-all group"
                              >
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <FileText className="w-5 h-5 text-primary" />
                                </div>
                                <div className="flex-grow min-w-0">
                                  <p className="font-semibold text-sm text-on-surface truncate group-hover:text-primary transition-colors">
                                    {doc.name}
                                  </p>
                                  <p className="text-xs text-on-surface-variant mt-0.5">
                                    {ext}{sizeKb != null ? ` · ${sizeKb} KB` : ''}
                                  </p>
                                </div>
                                {downloadingDocumentId === doc.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
                                ) : (
                                  <ArrowLeft className="w-4 h-4 text-on-surface-variant group-hover:text-primary rotate-180 flex-shrink-0 transition-colors" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
                {activeTab === 'qa' && (
                  <motion.div key="qa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                    {/* Form câu hỏi mới */}
                    <div className="bg-surface-container p-5 rounded-2xl border border-outline-variant/30 space-y-3">
                      <h4 className="font-bold text-sm text-on-surface">Đặt câu hỏi thảo luận</h4>
                      {activeLesson && (
                        <p className="text-xs text-on-surface-variant font-medium">
                          Bài hiện tại: <span className="text-on-surface">{activeLesson.title}</span>
                        </p>
                      )}
                      <div className="flex gap-3">
                        <textarea
                          value={qaInput}
                          onChange={(e) => setQaInput(e.target.value)}
                          placeholder="Viết câu hỏi thắc mắc của bạn tại đây để mọi người cùng trao đổi..."
                          className="flex-grow min-h-[90px] p-4 text-sm rounded-2xl bg-surface border border-outline-variant/40 focus:border-primary outline-none resize-none text-on-surface transition-all placeholder:text-on-surface-variant/40"
                        />
                      </div>
                      <QaImagePicker
                        file={qaImageFile}
                        onChange={setQaImageFile}
                        disabled={postingQuestion}
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={handleAddQuestion}
                          disabled={postingQuestion}
                          className="px-5 py-2.5 bg-primary hover:bg-primary/95 text-on-primary rounded-xl font-bold text-xs shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-60"
                        >
                          {postingQuestion ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          Gửi câu hỏi
                        </button>
                      </div>
                    </div>

                    {/* Danh sách các câu hỏi Q&A */}
                    <div className="space-y-4">
                      {loadingDiscussion ? (
                        <div className="flex items-center justify-center py-10 text-on-surface-variant">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      ) : questionsList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 opacity-60">
                          <MessageSquare className="w-12 h-12 mb-4 text-on-surface-variant" />
                          <p className="font-semibold text-on-surface text-sm">Chưa có câu hỏi nào.</p>
                        </div>
                      ) : (
                        questionsList.map((qa) => (
                          <div key={qa.id} className="bg-surface border border-outline-variant/20 p-5 rounded-2xl space-y-4 shadow-sm">
                            <div className="flex gap-3 items-start">
                              <img
                                src={avatarFor(qa.authorName, qa.authorAvatarUrl, 40)}
                                alt={qa.authorName}
                                className="w-10 h-10 rounded-full flex-shrink-0 shadow-sm"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-sm text-on-surface">{qa.authorName}</span>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                                    {roleLabel(qa.authorRole)}
                                  </span>
                                  {qa.lessonTitle && (
                                    <span className="text-[10px] text-on-surface-variant/70 line-clamp-1">
                                      {qa.lessonTitle}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-on-surface-variant/60">{formatDiscussionDate(qa.createdAt)}</span>
                                </div>
                                {editingQuestionId === qa.id ? (
                                  <div className="mt-2 space-y-2">
                                    <textarea
                                      value={editingQuestionText}
                                      onChange={(event) => setEditingQuestionText(event.target.value)}
                                      className="w-full min-h-[86px] rounded-xl border border-outline-variant/40 bg-surface-container/40 px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                                    />
                                    <div className="flex justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingQuestionId(null);
                                          setEditingQuestionText('');
                                        }}
                                        className="rounded-lg px-3 py-1.5 text-xs font-bold text-on-surface-variant hover:bg-surface-container"
                                      >
                                        Hủy
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateQuestion(qa.id)}
                                        disabled={savingDiscussionId === qa.id}
                                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary disabled:opacity-60"
                                      >
                                        {savingDiscussionId === qa.id ? 'Đang lưu...' : 'Lưu'}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-on-surface text-sm mt-2 leading-relaxed font-semibold">
                                    {qa.content}
                                  </p>
                                )}
                                {qa.attachmentUrl && qa.attachmentType?.startsWith('image/') && (
                                  <a href={qa.attachmentUrl} target="_blank" rel="noreferrer" className="block mt-3">
                                    <img
                                      src={qa.attachmentUrl}
                                      alt={qa.attachmentName ?? 'Ảnh câu hỏi'}
                                      className="max-h-80 max-w-full rounded-xl border border-outline-variant/30 object-contain bg-black/5"
                                    />
                                  </a>
                                )}
                                {canEditDiscussionItem(qa.authorId) && editingQuestionId !== qa.id && (
                                  <div className="mt-3 flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => startEditQuestion(qa)}
                                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-on-surface-variant hover:bg-surface-container"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                      Sửa
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteQuestion(qa.id)}
                                      disabled={savingDiscussionId === qa.id}
                                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-60"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Xóa
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Replies List */}
                            {qa.replies && qa.replies.length > 0 && (
                              <div className="pl-6 border-l-2 border-outline-variant/40 space-y-3 mt-3">
                                {qa.replies.map((reply) => (
                                  <div key={reply.id} className="flex gap-2.5 items-start">
                                    <img
                                      src={avatarFor(reply.authorName, reply.authorAvatarUrl, 32)}
                                      alt={reply.authorName}
                                      className="w-8 h-8 rounded-full flex-shrink-0"
                                    />
                                    <div className="min-w-0 flex-1 bg-surface-container/20 p-3 rounded-xl">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-bold text-xs text-on-surface">{reply.authorName}</span>
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                                          {roleLabel(reply.authorRole)}
                                        </span>
                                        <span className="text-[9px] text-on-surface-variant/50">{formatDiscussionDate(reply.createdAt)}</span>
                                      </div>
                                      {editingReplyId === reply.id ? (
                                        <div className="mt-2 space-y-2">
                                          <textarea
                                            value={editingReplyText}
                                            onChange={(event) => setEditingReplyText(event.target.value)}
                                            className="w-full min-h-[70px] rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-xs text-on-surface outline-none focus:border-primary"
                                          />
                                          <div className="flex justify-end gap-2">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditingReplyId(null);
                                                setEditingReplyText('');
                                              }}
                                              className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-on-surface-variant hover:bg-surface-container"
                                            >
                                              Hủy
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleUpdateReply(qa.id, reply.id)}
                                              disabled={savingDiscussionId === reply.id}
                                              className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-on-primary disabled:opacity-60"
                                            >
                                              {savingDiscussionId === reply.id ? 'Đang lưu...' : 'Lưu'}
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <p className="text-xs text-on-surface-variant mt-1 leading-relaxed font-medium">
                                          {reply.content}
                                        </p>
                                      )}
                                      {reply.attachmentUrl && reply.attachmentType?.startsWith('image/') && (
                                        <a href={reply.attachmentUrl} target="_blank" rel="noreferrer" className="block mt-2">
                                          <img
                                            src={reply.attachmentUrl}
                                            alt={reply.attachmentName ?? 'Ảnh phản hồi'}
                                            className="max-h-64 max-w-full rounded-lg object-contain bg-black/5"
                                          />
                                        </a>
                                      )}
                                      {canEditDiscussionItem(reply.authorId) && editingReplyId !== reply.id && (
                                        <div className="mt-2 flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => startEditReply(reply.id, reply.content)}
                                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold text-on-surface-variant hover:bg-surface"
                                          >
                                            <Pencil className="h-3 w-3" />
                                            Sửa
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteReply(qa.id, reply.id)}
                                            disabled={savingDiscussionId === reply.id}
                                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-60"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                            Xóa
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Reply Input Form */}
                            <div className="flex gap-2 items-center pl-6 pt-2">
                              <input
                                type="text"
                                placeholder="Viết phản hồi thảo luận..."
                                value={replyInputs[qa.id] ?? ''}
                                onChange={(e) => setReplyInputs((prev) => ({ ...prev, [qa.id]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleAddReply(qa.id);
                                  }
                                }}
                                className="flex-grow px-3 py-2 text-xs rounded-xl bg-surface-container/50 border border-outline-variant/30 focus:border-primary focus:bg-surface outline-none text-on-surface placeholder:text-on-surface-variant/40 transition-colors"
                              />
                              <button
                                onClick={() => handleAddReply(qa.id)}
                                disabled={postingReplyId === qa.id}
                                className="px-3.5 py-2 bg-secondary-container hover:bg-secondary-container/95 text-on-secondary-container rounded-xl font-bold text-xs transition-colors whitespace-nowrap disabled:opacity-60"
                              >
                                {postingReplyId === qa.id ? 'Đang gửi...' : 'Phản hồi'}
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
                {activeTab === 'notes' && user?.role === 'student' && (
                  <motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                    <div className="rounded-2xl border border-outline-variant/40 bg-surface-container/40 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-extrabold text-on-surface">Ghi chú theo thời gian video</h3>
                          <p className="text-xs text-on-surface-variant mt-1">
                            Ghi lại nội dung tại đúng thời điểm video đang phát.
                          </p>
                          <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-primary">
                            <Lock className="h-3 w-3" />
                            Riêng tư — chỉ bạn mới xem được các ghi chú này.
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary">
                          <Clock className="h-4 w-4" />
                          {formatDurationSec(Math.floor(currentVideoTime))}
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={timedNoteInput}
                          onChange={event => setTimedNoteInput(event.target.value)}
                          onKeyDown={event => {
                            if (event.key === 'Enter') handleAddTimedNote();
                          }}
                          maxLength={2000}
                          disabled={!isDirectVideo || savingTimedNote}
                          placeholder={isDirectVideo ? 'Nhập ghi chú cho mốc thời gian hiện tại...' : 'Chỉ hỗ trợ video tải trực tiếp'}
                          className="flex-1 rounded-xl border border-outline-variant/40 bg-surface px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary disabled:opacity-60"
                        />
                        <button
                          type="button"
                          onClick={handleAddTimedNote}
                          disabled={!isDirectVideo || !timedNoteInput.trim() || savingTimedNote}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50"
                        >
                          {savingTimedNote
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Plus className="h-4 w-4" />}
                          {savingTimedNote
                            ? 'Đang lưu...'
                            : `Thêm tại ${formatDurationSec(Math.floor(currentVideoTime))}`}
                        </button>
                      </div>

                      {loadingTimedNotes ? (
                        <div className="flex items-center gap-2 py-3 text-sm text-on-surface-variant">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Đang tải ghi chú của bạn...
                        </div>
                      ) : activeTimedNotes.length > 0 ? (
                        <div className="space-y-2 pt-1">
                          {activeTimedNotes.map(note => (
                            <div key={note.id} className="flex items-start gap-3 rounded-xl bg-surface px-3 py-2.5 border border-outline-variant/30">
                              <span className="shrink-0 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-extrabold text-primary">
                                {formatDurationSec(note.timeSec)}
                              </span>
                              <p className="flex-1 text-sm text-on-surface whitespace-pre-wrap">{note.content}</p>
                              <button
                                type="button"
                                onClick={() => handleDeleteTimedNote(note.id)}
                                disabled={deletingTimedNoteId === note.id}
                                className="shrink-0 rounded-lg p-1.5 text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                                title="Xóa ghi chú"
                              >
                                {deletingTimedNoteId === note.id
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <Trash2 className="h-4 w-4" />}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-on-surface-variant">Chưa có ghi chú theo mốc thời gian cho video này.</p>
                      )}
                    </div>

                  </motion.div>
                )}
                {activeTab === 'assignments' && user?.role === 'student' && course.isEnrolled && (
                  <motion.div key="assignments" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <CourseAssignmentsPanel courseId={courseId} />
                  </motion.div>
                )}
                {activeTab === 'reviews' && (
                  <motion.div key="reviews" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <CourseReviewsPanel
                      courseId={course.id}
                      fallbackRating={course.rating}
                      fallbackReviewCount={course.reviewCount ?? 0}
                      canSubmitReview={canSubmitReview}
                      isOwnedCourse={course.isEnrolled}
                      progressPct={course.progress ?? 0}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ── Sidebar mục lục (slide từ phải) ── */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              initial={{ x: 380 }}
              animate={{ x: 0 }}
              exit={{ x: 380 }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="w-full lg:w-[380px] bg-surface border-l border-outline-variant/30 flex flex-col h-full absolute right-0 top-0 bottom-0 z-20 shadow-2xl lg:shadow-none"
            >
              <div className="p-4 border-b border-outline-variant/30 flex items-center justify-between bg-surface sticky top-0 z-10">
                <h3 className="text-base font-bold text-on-surface">Mục lục khóa học</h3>
                {/* Nút đóng sidebar — chỉ hiện trên mobile */}
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-surface-container rounded-lg lg:hidden">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto px-3 py-4 space-y-4">
                {chapterSections.map((chapter, chapterIndex) => {
                  const isExpanded = expandedChapterIds.has(chapter.id);
                  const videoLessonsInChapter = chapter.lessons.filter(lesson => lesson.type === 'video');
                  const completedVideoCount = videoLessonsInChapter.filter(lesson =>
                    completedList.includes(lesson.id)
                  ).length;
                  const isChapterVideoCompleted = videoLessonsInChapter.length === 0 ||
                    completedVideoCount === videoLessonsInChapter.length;
                  const isChapterQuizCompleted = completedQuizList.includes(chapter.id);
                  const examsAfterChapter = examsByPlacementChapterId[chapter.id] ?? [];

                  return (
                    <div key={chapter.id} className="space-y-2">
                      <section className="border-b border-outline-variant/30 last:border-b-0 pb-2">
                        <button
                          type="button"
                          onClick={() => toggleChapter(chapter.id)}
                          aria-expanded={isExpanded}
                          className="w-full rounded-xl px-2.5 py-2 flex items-start justify-between gap-3 text-left hover:bg-surface-container transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold uppercase tracking-wide text-on-surface-variant">
                              Chương {chapterIndex + 1}
                            </p>
                            <h4 className="text-sm font-extrabold text-on-surface leading-snug line-clamp-2">
                              {chapter.title}
                            </h4>
                          </div>
                          <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-on-surface hover:bg-surface-container-high">
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
                              <div className="space-y-1 pl-3 pt-1">
                                {chapter.lessons.map((lesson, lessonIndex) => {
                                  const isActive = activeLesson?.id === lesson.id;
                                  const isCompleted = lesson.type === 'quiz'
                                    ? completedQuizList.includes(lesson.id)
                                    : completedList.includes(lesson.id);
                                  const unlockState = getLessonUnlockState(course, lesson, orderedVideoLessons, completedList);
                                  const isLocked = !unlockState.canOpen;
                                  const lockLabel = unlockState.lockedByPrerequisite
                                    ? 'Hoàn thành bài trước'
                                    : 'Cần mua khóa';

                                  return (
                                    <button
                                      key={lesson.id}
                                      onClick={() => handleLessonClick(lesson)}
                                      className={`w-full text-left rounded-xl border px-3 py-2.5 flex gap-3 transition-all ${isLocked
                                          ? 'bg-surface-container/40 border-transparent opacity-75 hover:opacity-100'
                                          : isActive
                                            ? 'bg-primary/10 border-primary/30 shadow-sm'
                                            : 'bg-surface hover:bg-surface-container border-transparent'
                                        }`}
                                    >
                                      <div className="mt-0.5 flex-shrink-0">
                                        {isLocked
                                          ? <Lock className="w-4.5 h-4.5 text-on-surface-variant" />
                                          : isCompleted
                                            ? <CheckCircle2 className="w-4.5 h-4.5 text-green-500" />
                                            : lesson.type === 'video'
                                              ? <PlayCircle className={`w-4.5 h-4.5 ${isActive ? 'text-primary' : 'text-on-surface-variant'}`} />
                                              : <FileText className={`w-4.5 h-4.5 ${isActive ? 'text-blue-500' : 'text-on-surface-variant'}`} />
                                        }
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className={`text-sm font-semibold leading-snug line-clamp-2 ${isActive ? 'text-primary' : 'text-on-surface'}`}>
                                          Bài {lessonIndex + 1}: {lesson.title.replace(/^Bài\s*\d+\s*[:.-]?\s*/i, '')}
                                        </p>
                                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                                          <span className="text-xs text-on-surface-variant">
                                            {getLessonDisplayDuration(course.id, lesson, lessonDurations)}
                                          </span>
                                          {lesson.isFree && isPreviewMode && (
                                            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-extrabold text-amber-600">
                                              Học thử
                                            </span>
                                          )}
                                          {isLocked && (
                                            <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-extrabold text-on-surface-variant">
                                              {lockLabel}
                                            </span>
                                          )}
                                        </div>
                                        {isLocked && unlockState.reason && (
                                          <p className="mt-1 text-xs text-on-surface-variant">
                                            {unlockState.reason}
                                          </p>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}

                                {chapter.hasQuizConfig && chapter.id !== 'flat-lessons' && (
                                  course.isEnrolled && isChapterVideoCompleted ? (
                                    <Link
                                      to={`/courses/${courseId}/chapters/${chapter.id}/quiz?returnTo=${encodeURIComponent(`/courses/${courseId}?learn=1${activeLesson ? `&lesson=${activeLesson.id}` : ''}`)}`}
                                      className="w-full text-left rounded-xl border border-transparent px-3 py-2.5 flex items-center gap-3 bg-surface hover:bg-amber-500/5 hover:border-amber-500/20 transition-all group"
                                    >
                                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isChapterQuizCompleted
                                          ? 'bg-green-500/10 text-green-600'
                                          : 'bg-amber-500/10 text-amber-500 group-hover:bg-amber-500/20'
                                        }`}>
                                        {isChapterQuizCompleted
                                          ? <CheckCircle2 className="w-4 h-4" />
                                          : <ClipboardList className="w-4 h-4" />
                                        }
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-on-surface line-clamp-1">Quiz chương {chapterIndex + 1}</p>
                                        <p className={`text-xs font-medium ${isChapterQuizCompleted ? 'text-green-600' : 'text-amber-600'}`}>
                                          {isChapterQuizCompleted ? 'Đã hoàn thành quiz' : 'Làm quiz ngay'}
                                        </p>
                                      </div>
                                    </Link>
                                  ) : (
                                    <div className="w-full text-left rounded-xl border border-transparent px-3 py-2.5 flex items-center gap-3 bg-surface-container/40 opacity-75">
                                      <div className="w-7 h-7 rounded-lg bg-surface-container-high text-on-surface-variant flex items-center justify-center flex-shrink-0">
                                        <Lock className="w-4 h-4" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-on-surface line-clamp-1">Quiz chương {chapterIndex + 1}</p>
                                        <p className="text-xs text-on-surface-variant font-medium">
                                          {course.isEnrolled
                                            ? `Hoàn thành ${completedVideoCount}/${videoLessonsInChapter.length} video để mở quiz`
                                            : 'Cần mua khóa để làm quiz'}
                                        </p>
                                      </div>
                                    </div>
                                  )
                                )}

                                {examsAfterChapter.map(exam => (
                                  <Link
                                    key={exam.id}
                                    to={`/courses/${courseId}/exams/${exam.slotIndex}?returnTo=${encodeURIComponent(`/courses/${courseId}?learn=1${activeLesson ? `&lesson=${activeLesson.id}` : ''}`)}`}
                                    className="w-full text-left rounded-xl border border-transparent px-3 py-2.5 flex items-center gap-3 bg-surface hover:bg-primary/5 hover:border-primary/20 transition-all group"
                                  >
                                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 flex items-center justify-center flex-shrink-0">
                                      <GraduationCap className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-on-surface line-clamp-1">
                                        {exam.name}
                                      </p>
                                      <p className="text-xs font-medium text-primary">
                                        {exam.questionCount} câu · {exam.durationMinutes} phút · Mở bài kiểm tra
                                      </p>
                                    </div>
                                  </Link>
                                ))}

                                {loadingStudentExams && chapterIndex === 0 && (
                                  <div className="w-full rounded-xl border border-transparent bg-surface-container/40 px-3 py-2.5 text-xs font-semibold text-on-surface-variant">
                                    Đang tải bài kiểm tra...
                                  </div>
                                )}

                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </section>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* QuizModal */}
      <AnimatePresence>
        {activeQuiz && (
          <QuizModal
            lesson={activeQuiz}
            prevScore={quizScores[course.id]?.[activeQuiz.id]}
            onClose={() => setActiveQuiz(null)}
            onComplete={handleQuizComplete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Star,
  Users,
  PlayCircle,
  FileText,
  CheckCircle2,
  Lock,
  ShoppingCart,
  Video,
  MessageSquare,
  BookOpen,
  ClipboardList,
  Loader2,
  Clock,
} from 'lucide-react';
import DashboardHeader from '../../../components/DashboardHeader';
import type { Course } from '../../../data/mockCourses';
import { notify } from '../../../lib/toast';
import { useCartStore } from '../../../store/useCartStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useCourseStore } from '../../../store/useCourseStore';
import { formatDurationSec } from '../../../api/adapter';
import { listOrders, verifyPayment } from '../../../api/orderService';
import { getStudentLearningContext } from '../../../api/studentLearningContextService';
import type { StudentVideoProgress } from '../../../api/studentVideoProgressService';
import type { ChapterDetail } from '../../../types/api';
import { CourseReviewsPanel } from './CourseReviewsPanel';
import { MarketingSyllabusList } from './MarketingSyllabusList';
import { RelatedCourses } from './RelatedCourses';
import { SafeCourseImage, adaptLearningLesson, getContinueLearningLesson, getCourseProgressStats, getOrderedVideoLessons, isDirectVideoUrl, toEmbeddableVideoUrl, type MarketingSyllabusSection, watchedDurationSec } from './shared';


export function MarketingView({
  course,
  rawChapters,
  onStartPreview,
  onOpenLearning,
}: {
  course: Course;
  rawChapters: ChapterDetail[];
  onStartPreview?: (lessonId?: string) => void;
  onOpenLearning?: (lessonId?: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'syllabus' | 'instructor' | 'reviews'>('overview');

  const addToCart = useCartStore(state => state.addToCart);
  const isLoggedIn = useAuthStore(state => state.isLoggedIn);
  const user = useAuthStore(state => state.user);
  const purchasedIds = useCourseStore(state => state.purchasedIds);
  const enrollCourses = useCourseStore(state => state.enrollCourses);
  const completedLessons = useCourseStore(state => state.completedLessons);
  const completedQuizzes = useCourseStore(state => state.completedQuizzes);
  const lessonDurations = useCourseStore(state => state.lessonDurations);
  const videoPositions = useCourseStore(state => state.videoPositions);
  const hydrateCourseProgress = useCourseStore(state => state.hydrateCourseProgress);
  const navigate = useNavigate();
  const [activating, setActivating] = useState(false);
  const [openingLearning, setOpeningLearning] = useState(false);
  const syllabusSections = useMemo<MarketingSyllabusSection[]>(() => (
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
  const [expandedChapterIds, setExpandedChapterIds] = useState<Set<string>>(
    () => new Set(syllabusSections.slice(0, 2).map(chapter => chapter.id))
  );
  const previewLessons = useMemo(
    () => course.lessons?.filter(lesson => lesson.type !== 'quiz' && Boolean(lesson.isFree)) ?? [],
    [course.lessons],
  );
  const completedList = completedLessons[course.id] ?? [];
  const completedQuizList = completedQuizzes[course.id] ?? [];
  const progressStats = useMemo(
    () => getCourseProgressStats(syllabusSections, completedList, completedQuizList),
    [syllabusSections, completedList, completedQuizList],
  );
  const progressPercent = progressStats.progressPercent;
  const isOwnedCourse = course.isEnrolled || purchasedIds.includes(course.id);
  const canSubmitReview = isOwnedCourse && user?.role === 'student';
  const primaryPreviewLesson = previewLessons.find(lesson => lesson.type === 'video') ?? previewLessons[0] ?? null;
  const previewCtaLabel = primaryPreviewLesson?.type === 'video'
    ? 'Xem video học thử'
    : 'Xem nội dung học thử';
  const orderedVideoLessons = useMemo(
    () => getOrderedVideoLessons(syllabusSections),
    [syllabusSections],
  );

  const introVideoUrl = course.introVideoUrl?.trim();
  const introEmbedUrl = introVideoUrl ? toEmbeddableVideoUrl(introVideoUrl) : null;
  const introDirectUrl = introVideoUrl && isDirectVideoUrl(introVideoUrl) ? introVideoUrl : null;

  useEffect(() => {
    setExpandedChapterIds(new Set(syllabusSections.slice(0, 2).map(chapter => chapter.id)));
  }, [syllabusSections]);

  function toggleSyllabusChapter(chapterId: string) {
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

  async function handleOpenLearning() {
    if (!onOpenLearning || openingLearning) return;

    setOpeningLearning(true);
    let latestCompletedLessonIds = completedList;
    const localCourseProgress = videoPositions[`${user?.id ?? 'guest'}:${course.id}`] ?? {};
    let latestVideoProgress: StudentVideoProgress | null = Object.entries(localCourseProgress)
      .map(([lessonId, progress]) => ({
        lessonId,
        ...progress,
        watchedSegments: progress.watchedSegments ?? [],
        watchedDurationSec: watchedDurationSec(progress.watchedSegments ?? []),
        completed: false,
      }))
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0]
      ?? null;

    if (user?.role === 'student' && course.isEnrolled) {
      try {
        const { progress: courseProgress, latestVideoProgress: remoteVideoProgress } =
          await getStudentLearningContext(course.id);
        latestCompletedLessonIds = courseProgress.completedLessonIds;
        hydrateCourseProgress(
          course.id,
          courseProgress.completedLessonIds,
          courseProgress.completedQuizIds,
        );

        const localUpdatedAt = latestVideoProgress?.updatedAt
          ? Date.parse(latestVideoProgress.updatedAt)
          : 0;
        const remoteUpdatedAt = remoteVideoProgress?.updatedAt
          ? Date.parse(remoteVideoProgress.updatedAt)
          : 0;
        if (remoteVideoProgress && remoteUpdatedAt >= localUpdatedAt) {
          latestVideoProgress = remoteVideoProgress;
        }
      } catch {
        // Mất mạng không chặn việc học; dùng vị trí cục bộ gần nhất.
      }
    }

    const continueLesson = getContinueLearningLesson(
      orderedVideoLessons,
      latestCompletedLessonIds,
      latestVideoProgress,
    );
    onOpenLearning(continueLesson?.id);
    setOpeningLearning(false);
  }

  function handleAddToCart() {
    // Guard 1: chưa đăng nhập → redirect sang /login
    // Truyền state { from } để Login.tsx biết phải redirect về đâu sau khi login xong
    if (!isLoggedIn) {
      navigate('/login', { state: { from: `/courses/${course.id}` } });
      return;
    }
    // Guard 2: đã sở hữu rồi → không cho add thêm vào cart
    if (course.isEnrolled || purchasedIds.includes(course.id)) {
      notify.error('Bạn đã sở hữu khóa học này!');
      return;
    }
    // Hợp lệ → thêm vào giỏ + thông báo thành công
    addToCart({
      id: course.id,
      title: course.title,
      priceVnd: parseInt((course.price ?? '0').replace(/\D/g, '')) || 0,
      image: course.image,
    });
    notify.success(`Đã thêm "${course.title}" vào giỏ hàng!`);
  }

  // Kích hoạt khóa học khi đã thanh toán nhưng enrollment chưa được ghi
  async function handleActivate() {
    if (!isLoggedIn) {
      navigate('/login', { state: { from: `/courses/${course.id}` } });
      return;
    }
    setActivating(true);
    try {
      const orders = await listOrders();
      const pending = orders.find(o =>
        o.status === 'PENDING' &&
        o.items.some(i => i.courseId === course.id)
      );
      if (!pending) {
        notify.error('Không tìm thấy đơn hàng cho khóa học này.');
        return;
      }
      const result = await verifyPayment(pending.id);
      if (result.status === 'PAID') {
        enrollCourses([course.id]);
        notify.success('Kích hoạt thành công! Đang tải...');
        window.location.reload();
      } else {
        notify.error('PayOS chưa xác nhận thanh toán. Vui lòng thử lại sau.');
      }
    } catch {
      notify.error('Không thể kích hoạt. Vui lòng liên hệ hỗ trợ.');
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <DashboardHeader />

      {/* HERO — nền gradient, tiêu đề lớn, thông số tóm tắt */}
      <div className="bg-surface-container-highest border-b border-outline-variant/30 pt-10 pb-20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="max-w-[1200px] mx-auto w-full px-4 md:px-10 relative z-10">
          <Link to="/courses" className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary mb-6 transition-colors font-semibold text-sm">
            <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
          </Link>
          <div className="flex gap-3 mb-6">
            <span className="bg-surface text-on-surface text-sm font-bold px-4 py-1.5 rounded-full shadow-sm">{course.grade}</span>
            <span className="bg-primary text-on-primary text-sm font-bold px-4 py-1.5 rounded-full shadow-sm">{course.subject}</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-on-surface mb-6 leading-tight max-w-4xl">
            {course.title}
          </h1>
          <p className="text-xl text-on-surface-variant mb-8 max-w-3xl leading-relaxed">{course.description}</p>
          <div className="flex flex-wrap items-center gap-8 text-on-surface-variant font-medium">
            <div className="flex items-center gap-2 text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-lg">
              <Star className="w-5 h-5 fill-amber-500" />
              <span className="text-lg font-bold">{course.rating > 0 ? course.rating.toFixed(1) : 'Mới'}</span>
              <span className="text-sm text-amber-700/80">
                ({(course.reviewCount ?? 0).toLocaleString('vi-VN')} đánh giá)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <span>{course.students.toLocaleString('vi-VN')} học viên</span>
            </div>
            {(course.totalChapters ?? 0) > 0 && (
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                <span>{course.totalChapters} chương</span>
              </div>
            )}
            {(course.totalDurationSec ?? 0) > 0 && (
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <span>{formatDurationSec(course.totalDurationSec ?? 0)}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              Giảng viên: <strong className="text-on-surface">{course.instructor}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN: -mt-10 để content đè lên hero banner tạo hiệu ứng nổi */}
      <main className="flex-grow max-w-[1200px] mx-auto w-full px-4 md:px-10 -mt-10 pb-20 relative z-20">
        <div className="grid lg:grid-cols-3 gap-10">
          {/* Cột nội dung (trái): tabs thông tin */}
          <div className="lg:col-span-2">
            {/* Tab navigation */}
            <div className="bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/50 p-2 mb-8 flex overflow-x-auto">
              {([
                { id: 'overview', label: 'Tổng quan' },
                { id: 'syllabus', label: 'Nội dung học' },
                { id: 'instructor', label: 'Giảng viên' },
                { id: 'reviews', label: 'Đánh giá' },
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-3 px-6 rounded-2xl font-bold text-sm md:text-base whitespace-nowrap transition-all ${activeTab === tab.id
                      ? 'bg-primary text-on-primary shadow-md'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content — AnimatePresence mode="wait" để chuyển tab mượt mà */}
            <div className="bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/50 p-6 md:p-10 min-h-[400px]">
              <AnimatePresence mode="wait">
                {activeTab === 'overview' && (
                  <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <h2 className="text-2xl font-bold text-on-surface mb-6 flex items-center gap-2">
                      <BookOpen className="text-primary w-6 h-6" /> Bạn sẽ học được gì?
                    </h2>
                    <div className="text-on-surface-variant leading-relaxed space-y-4 text-lg">
                      <p>{course.detailedDescription}</p>
                      {(course.objective || course.audience) && (
                        <div className="grid md:grid-cols-2 gap-5">
                          {course.objective && (
                            <section className="border-l-4 border-primary/50 pl-4 py-1">
                              <h3 className="text-sm font-extrabold text-on-surface mb-1">Mục tiêu khóa học</h3>
                              <p className="text-sm leading-relaxed text-on-surface-variant whitespace-pre-line">{course.objective}</p>
                            </section>
                          )}
                          {course.audience && (
                            <section className="border-l-4 border-primary/50 pl-4 py-1">
                              <h3 className="text-sm font-extrabold text-on-surface mb-1">Đối tượng học viên</h3>
                              <p className="text-sm leading-relaxed text-on-surface-variant whitespace-pre-line">{course.audience}</p>
                            </section>
                          )}
                        </div>
                      )}
                      <p>Khóa học bao gồm đầy đủ hệ thống bài giảng video chất lượng cao, bài tập tự luyện và tài liệu PDF đính kèm.</p>
                      <ul className="grid sm:grid-cols-2 gap-4 mt-8">
                        {['Nắm vững kiến thức trọng tâm', 'Luyện tập với bài tập thực tế', 'Hỗ trợ giải đáp 24/7', 'Truy cập trọn đời'].map((item, idx) => (
                          <li key={idx} className="flex items-start gap-3">
                            <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0" />
                            <span className="text-on-surface">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                )}
                {activeTab === 'syllabus' && (
                  <motion.div key="syllabus" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <div className="flex justify-between items-end mb-6">
                      <h2 className="text-2xl font-bold text-on-surface">Mục lục khóa học</h2>
                      <span className="text-on-surface-variant text-sm font-medium">{course.lessons?.length ?? 0} bài</span>
                    </div>
                    <MarketingSyllabusList
                      course={course}
                      sections={syllabusSections}
                      expandedChapterIds={expandedChapterIds}
                      completedList={completedList}
                      lessonDurations={lessonDurations}
                      isOwnedCourse={isOwnedCourse}
                      onToggleChapter={toggleSyllabusChapter}
                      onStartPreview={onStartPreview}
                      onOpenLearning={onOpenLearning}
                    />
                  </motion.div>
                )}
                {activeTab === 'instructor' && (
                  <motion.div key="instructor" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <h2 className="text-2xl font-bold text-on-surface mb-6">Thông tin Giảng viên</h2>
                    <div className="flex flex-col sm:flex-row gap-6 items-start">
                      <img
                        src={`https://ui-avatars.com/api/?name=${course.instructor.replace(/ /g, '+')}&background=random&size=128`}
                        alt={course.instructor}
                        className="w-24 h-24 rounded-full shadow-md"
                      />
                      <div>
                        <h3 className="text-xl font-bold text-on-surface mb-2">{course.instructor}</h3>
                        <p className="text-primary font-semibold mb-4">Giảng viên xuất sắc tại Bee Academy</p>
                        <p className="text-on-surface-variant leading-relaxed">
                          Với hơn 10 năm kinh nghiệm giảng dạy, luôn truyền cảm hứng và đem đến phương pháp học tập hiệu quả, dễ hiểu nhất. Hàng ngàn học sinh đã đạt điểm giỏi nhờ khóa học này.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
                {activeTab === 'reviews' && (
                  <motion.div key="reviews" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <CourseReviewsPanel
                      courseId={course.id}
                      fallbackRating={course.rating}
                      fallbackReviewCount={course.reviewCount ?? 0}
                      canSubmitReview={canSubmitReview}
                      isOwnedCourse={isOwnedCourse}
                      progressPct={progressPercent}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Cột mua hàng (phải): sticky card — luôn hiển thị khi scroll */}
          <div className="lg:col-span-1 relative">
            <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-[2rem] p-6 shadow-2xl shadow-primary/10 sticky top-28">
              <div className="rounded-2xl overflow-hidden mb-6 aspect-video relative group">
                {introEmbedUrl ? (
                  <iframe
                    src={introEmbedUrl}
                    title={`Video giới thiệu ${course.title}`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : introDirectUrl ? (
                  <video
                    src={introDirectUrl}
                    poster={course.image && !isDirectVideoUrl(course.image) ? course.image : undefined}
                    controls
                    // preload="none": không tải trước mp4 cho mọi khách vào trang — tiết kiệm egress Supabase
                    preload="none"
                    className="w-full h-full object-cover bg-black"
                  />
                ) : (
                  <>
                    <SafeCourseImage
                      course={course}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-black/20" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      {primaryPreviewLesson && onStartPreview ? (
                        <button
                          type="button"
                          onClick={() => onStartPreview(primaryPreviewLesson.id)}
                          className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center text-primary shadow-lg cursor-pointer hover:scale-110 transition-transform"
                        >
                          <PlayCircle className="w-8 h-8 ml-1" />
                        </button>
                      ) : (
                        <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center text-primary shadow-lg">
                          <PlayCircle className="w-8 h-8 ml-1" />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              {isOwnedCourse ? (
                <>
                  <div className="mb-4 rounded-2xl border border-green-500/20 bg-green-500/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-green-500/10 text-green-600">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-extrabold text-on-surface">Bạn đã sở hữu khóa học này</p>
                        <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                          {progressPercent > 0
                            ? `Bạn đã hoàn thành ${progressStats.completedItems}/${progressStats.totalItems} nội dung học.`
                            : 'Khóa học đã sẵn sàng để bạn bắt đầu học ngay.'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenLearning}
                    disabled={openingLearning}
                    className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-lg font-bold text-on-primary shadow-lg shadow-primary/30 transition-all hover:-translate-y-1 hover:shadow-primary/50 disabled:cursor-wait disabled:opacity-70"
                  >
                    {openingLearning
                      ? <Loader2 className="h-6 w-6 animate-spin" />
                      : <PlayCircle className="h-6 w-6" />}
                    {progressPercent > 0 ? 'Tiếp tục học' : 'Vào học ngay'}
                  </button>
                  <div className="mb-6 rounded-2xl bg-surface-container p-4">
                    <div className="mb-2 flex items-center justify-between text-sm font-semibold">
                      <span className="text-primary">Tiến độ học tập</span>
                      <span className="text-on-surface">{progressPercent}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Giá lấy trực tiếp từ API; chỉ hiển thị giá gốc khi thật sự có khuyến mãi. */}
                  <div className="text-3xl font-extrabold text-primary mb-1 text-center">{course.price}</div>
                  {course.isOnSale && course.originalPrice && (
                    <div className="text-center text-sm text-on-surface-variant line-through mb-6">
                      {course.originalPrice}
                    </div>
                  )}
                  {!course.isOnSale && <div className="mb-6" />}
                  {isLoggedIn ? (
                    <button
                      onClick={handleAddToCart}
                      className="w-full py-4 bg-primary text-on-primary rounded-xl font-bold text-lg shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 mb-3"
                    >
                      <ShoppingCart className="w-6 h-6" />
                      Thêm vào giỏ hàng
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled
                        className="w-full py-4 bg-surface-container-high text-on-surface-variant rounded-xl font-bold text-lg flex items-center justify-center gap-2 mb-3 cursor-not-allowed"
                      >
                        <Lock className="w-6 h-6" />
                        Đăng nhập để mua khóa học
                      </button>
                      <Link
                        to="/login"
                        state={{ from: `/courses/${course.id}` }}
                        className="mb-3 flex w-full items-center justify-center rounded-xl border border-primary px-4 py-2.5 text-sm font-bold text-primary hover:bg-primary/5"
                      >
                        Đăng nhập để tiếp tục
                      </Link>
                    </>
                  )}
                </>
              )}
              {!isOwnedCourse && primaryPreviewLesson && onStartPreview && (
                <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                      <PlayCircle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-on-surface">Nội dung học thử</p>
                      <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                        Xem trước {previewLessons.length} bài miễn phí trước khi quyết định mua khóa học.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onStartPreview(primaryPreviewLesson.id)}
                    className="mt-4 w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-extrabold text-white transition-colors hover:bg-amber-500/90"
                  >
                    {previewCtaLabel}
                  </button>
                </div>
              )}
              {!isOwnedCourse && isLoggedIn && (
                <button
                  onClick={handleActivate}
                  disabled={activating}
                  className="w-full py-2.5 border border-outline-variant text-on-surface-variant rounded-xl text-sm font-medium hover:bg-surface-container transition-colors flex items-center justify-center gap-2 mb-4 disabled:opacity-50"
                >
                  {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {activating ? 'Đang kích hoạt...' : 'Đã thanh toán? Kích hoạt khóa học'}
                </button>
              )}
              <div className="text-center text-xs font-semibold text-on-surface-variant mb-6 uppercase tracking-wider">
                Thanh toán an toàn · Truy cập trọn đời
              </div>
              <hr className="border-outline-variant/40 my-6" />
              {/* Tóm tắt những gì có trong khóa học — đếm từ course.lessons theo type */}
              <h4 className="font-bold mb-4 text-on-surface">Khóa học bao gồm:</h4>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-on-surface-variant font-medium text-sm">
                  <Video className="w-5 h-5 text-primary" />
                  {course.lessons?.filter(l => l.type === 'video').length ?? 0} video bài giảng
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant font-medium text-sm">
                  <FileText className="w-5 h-5 text-primary" />
                  {course.lessons?.filter(l => l.type === 'pdf').length ?? 0} tài liệu PDF
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant font-medium text-sm">
                  <ClipboardList className="w-5 h-5 text-amber-500" />
                  {course.lessons?.filter(l => l.type === 'quiz').length ?? 0} bài kiểm tra theo chương
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant font-medium text-sm">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  Q&A hỗ trợ trực tiếp
                </li>
                <li className="flex items-center gap-3 text-on-surface-variant font-medium text-sm">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  Chứng nhận hoàn thành
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
      <RelatedCourses currentCourseId={course.id} subjectSlug={course.categorySlug} />
    </div>
  );
}

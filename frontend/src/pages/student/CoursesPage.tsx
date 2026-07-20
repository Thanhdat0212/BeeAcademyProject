import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Heart,
  Loader2,
  PlayCircle,
  Search,
  Star,
  Users,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import DashboardHeader from '../../components/DashboardHeader';
import PageBanner from '../../components/PageBanner';
import type { Course as UiCourse } from '../../types/course';
import { useCourseStore } from '../../store/useCourseStore';
import { useAuthStore } from '../../store/useAuthStore';
import {
  getEnrolledCourses,
  inferGradeFromSearchQuery,
  listCategories,
  searchCourses,
} from '../../api/courseService';
import { adaptCourseSummary } from '../../api/adapter';
import { isApiError } from '../../api/client';
import { reconcileOrders } from '../../api/orderService';
import { notify } from '../../lib/toast';
import type { Category, CourseSummary } from '../../types/api';

const GRADE_OPTIONS = [
  { value: null, label: 'Tất cả' },
  { value: 6, label: 'Lớp 6' },
  { value: 7, label: 'Lớp 7' },
  { value: 8, label: 'Lớp 8' },
  { value: 9, label: 'Lớp 9' },
] as const;

const PAGE_SIZE = 20;

type PriceRange = 'all' | 'under200' | '200to500' | 'over500';
type SortOption = 'relevance' | 'newest' | 'best_selling' | 'price_asc' | 'price_desc' | 'rating';
type OwnedCourseFilter = 'all' | 'in_progress' | 'completed' | 'not_started';

const PRICE_RANGE_OPTIONS: Array<{ value: PriceRange; label: string; minPrice?: number; maxPrice?: number }> = [
  { value: 'all', label: 'Tất cả mức giá' },
  { value: 'under200', label: 'Dưới 200.000đ', maxPrice: 200000 },
  { value: '200to500', label: '200.000đ - 500.000đ', minPrice: 200000, maxPrice: 500000 },
  { value: 'over500', label: 'Trên 500.000đ', minPrice: 500000 },
];

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: 'relevance', label: 'Phù hợp nhất' },
  { value: 'newest', label: 'Mới nhất' },
  { value: 'best_selling', label: 'Bán chạy nhất' },
  { value: 'price_asc', label: 'Giá tăng dần' },
  { value: 'price_desc', label: 'Giá giảm dần' },
  { value: 'rating', label: 'Đánh giá cao nhất' },
];

const RATING_OPTIONS = [
  { value: 0, label: 'Tất cả đánh giá' },
  { value: 3, label: 'Từ 3 sao' },
  { value: 4, label: 'Từ 4 sao' },
];

// Chỉ đối soát đơn PENDING một lần mỗi lần load app — flag module-level
// sống qua các lần navigate nội bộ, reset khi user refresh trang.
let didReconcileOrders = false;

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|#|$)/i.test(url);
}

function CourseCover({
  course,
  className,
}: {
  course: UiCourse;
  className: string;
}) {
  const [failed, setFailed] = useState(false);
  const imageUrl = course.image?.trim();
  const canUseImage = Boolean(imageUrl) && !isVideoUrl(imageUrl) && !failed;

  if (canUseImage) {
    return (
      <img
        src={imageUrl}
        alt={course.title}
        onError={() => setFailed(true)}
        className={className}
      />
    );
  }

  return (
    <div className={`${className} bg-surface-container-high flex flex-col items-center justify-center text-center px-5`}>
      <BookOpen className="w-10 h-10 text-primary mb-3" />
      <p className="text-sm font-extrabold text-on-surface line-clamp-2">{course.title}</p>
      <p className="text-xs font-semibold text-on-surface-variant mt-1">{course.subject} · {course.grade}</p>
    </div>
  );
}

function parseSubjectParam(value: string | null): string | null {
  const subject = value?.trim();
  return subject ? subject : null;
}

function parseGradeParam(value: string | null): number | null {
  if (!value) return null;
  const grade = Number(value);
  return Number.isInteger(grade) && grade >= 6 && grade <= 9 ? grade : null;
}

function parsePageParam(value: string | null): number {
  if (!value) return 0;
  const page = Number(value);
  return Number.isInteger(page) && page > 1 ? page - 1 : 0;
}

function parsePriceRange(value: string | null): PriceRange {
  return PRICE_RANGE_OPTIONS.some((option) => option.value === value)
    ? (value as PriceRange)
    : 'all';
}

function parseRatingParam(value: string | null): number {
  const rating = Number(value);
  return RATING_OPTIONS.some((option) => option.value === rating) ? rating : 0;
}

function parseSortParam(value: string | null): SortOption {
  return SORT_OPTIONS.some((option) => option.value === value)
    ? (value as SortOption)
    : 'relevance';
}

function buildVisiblePages(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 0) return [];

  const current = currentPage + 1;
  const start = Math.max(1, current - 2);
  const end = Math.min(totalPages, start + 4);
  const adjustedStart = Math.max(1, end - 4);

  return Array.from(
    { length: end - adjustedStart + 1 },
    (_, idx) => adjustedStart + idx,
  );
}

function formatOwnedCourseDate(value: string | null | undefined, emptyLabel: string): string {
  if (!value) return emptyLabel;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(value));
}

const OWNED_COURSE_FILTERS: Array<{ value: OwnedCourseFilter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'in_progress', label: 'Đang học' },
  { value: 'completed', label: 'Đã hoàn thành' },
  { value: 'not_started', label: 'Chưa bắt đầu' },
];

export default function CoursesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const localSearchEditRef = useRef(false);

  const [selectedSubjectSlug, setSelectedSubjectSlug] = useState<string | null>(
    () => parseSubjectParam(searchParams.get('subject')),
  );
  const [selectedGrade, setSelectedGrade] = useState<number | null>(
    () => parseGradeParam(searchParams.get('grade')),
  );
  const [currentPage, setCurrentPage] = useState<number>(
    () => parsePageParam(searchParams.get('page')),
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    () => searchParams.get('q') ?? '',
  );
  const [debouncedQuery, setDebouncedQuery] = useState<string>(searchQuery);
  const [priceRange, setPriceRange] = useState<PriceRange>(
    () => parsePriceRange(searchParams.get('price')),
  );
  const [minRating, setMinRating] = useState<number>(
    () => parseRatingParam(searchParams.get('minRating')),
  );
  const [sortOption, setSortOption] = useState<SortOption>(
    () => parseSortParam(searchParams.get('sort')),
  );

  const [categories, setCategories] = useState<Category[]>([]);
  const [courses, setCourses] = useState<UiCourse[]>([]);
  const [enrolledCourseSummaries, setEnrolledCourseSummaries] = useState<CourseSummary[]>([]);
  const [ownedCourseFilter, setOwnedCourseFilter] = useState<OwnedCourseFilter>('all');
  const [enrolledLoading, setEnrolledLoading] = useState(true);
  const [enrolledError, setEnrolledError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [suggestedCourses, setSuggestedCourses] = useState<UiCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const favoritedIds = useCourseStore((state) => state.favoritedIds);
  const toggleFavorite = useCourseStore((state) => state.toggleFavorite);
  const completedLessons = useCourseStore((state) => state.completedLessons);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const isStudent = useAuthStore((state) => state.user?.role === 'student');

  const enrolledCourses = useMemo(
    () => enrolledCourseSummaries.map((summary) => {
      const course = adaptCourseSummary(summary, true);
      const completedList = completedLessons[course.id] ?? [];
      const totalLessons = Math.max(summary.totalLessons ?? 0, 0);
      const normalizedCompleted = totalLessons > 0
        ? Math.min(completedList.length, totalLessons)
        : 0;
      const localProgress = totalLessons > 0
        ? Math.round((normalizedCompleted / totalLessons) * 100)
        : 0;
      const progress = summary.progressPct ?? localProgress;
      return { ...course, progress };
    }),
    [completedLessons, enrolledCourseSummaries],
  );

  const filteredEnrolledCourses = useMemo(
    () => ownedCourseFilter === 'all'
      ? enrolledCourses
      : enrolledCourses.filter((course) => course.learningStatus === ownedCourseFilter),
    [enrolledCourses, ownedCourseFilter],
  );

  const ownedCourseCounts = useMemo(() => ({
    all: enrolledCourses.length,
    in_progress: enrolledCourses.filter((course) => course.learningStatus === 'in_progress').length,
    completed: enrolledCourses.filter((course) => course.learningStatus === 'completed').length,
    not_started: enrolledCourses.filter((course) => course.learningStatus === 'not_started').length,
  }), [enrolledCourses]);

  useEffect(() => {
    if (!isLoggedIn || !isStudent) {
      setEnrolledLoading(false);
      setEnrolledCourseSummaries([]);
      return;
    }

    let cancelled = false;
    const loadEnrolled = () => {
      setEnrolledLoading(true);
      setEnrolledError(null);
      getEnrolledCourses()
        .then((courses) => {
          if (!cancelled) setEnrolledCourseSummaries(courses);
        })
        .catch(() => {
          if (!cancelled) setEnrolledError('Không thể tải danh sách khóa học đã mua. Vui lòng thử lại.');
        })
        .finally(() => {
          if (!cancelled) setEnrolledLoading(false);
        });
    };

    // Hiển thị danh sách ngay, không chờ đối soát PayOS (network ngoài, có thể
    // chậm nhiều giây). Nếu đối soát phát hiện đơn vừa PAID mới tải lại lần nữa
    // để khóa học mới mua xuất hiện.
    loadEnrolled();

    // BUG FIX: user thanh toán xong nhưng đóng tab/reload app trước khi về
    // trang payment-result → webhook không đến (local dev) và verifyPayment
    // không chạy → đơn kẹt PENDING, khóa học không mở. Đối soát với PayOS
    // một lần khi vào trang để tự hoàn tất các đơn như vậy.
    if (!didReconcileOrders) {
      didReconcileOrders = true;
      reconcileOrders()
        .then(updatedOrders => {
          const paidOrders = updatedOrders.filter(order => order.status === 'PAID');
          if (paidOrders.length > 0) {
            notify.success('Đã xác nhận thanh toán — khóa học của bạn đã được mở');
            loadEnrolled();
          }
        })
        .catch(() => {
          // Đối soát thất bại không được chặn trang; lần load sau sẽ thử lại.
          didReconcileOrders = false;
        });
    }
    return () => { cancelled = true; };
  }, [isLoggedIn, isStudent]);

  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch((err) => {
        console.error('Không tải được danh mục:', err);
      });
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
    const urlQuery = searchParams.get('q') ?? '';
    const urlSubject = parseSubjectParam(searchParams.get('subject'));
    const urlGrade = parseGradeParam(searchParams.get('grade'));
    const urlPage = parsePageParam(searchParams.get('page'));
    const urlPrice = parsePriceRange(searchParams.get('price'));
    const urlMinRating = parseRatingParam(searchParams.get('minRating'));
    const urlSort = parseSortParam(searchParams.get('sort'));

    setSearchQuery((current) => (current === urlQuery ? current : urlQuery));
    setDebouncedQuery((current) => (current === urlQuery ? current : urlQuery));
    setSelectedSubjectSlug((current) => (current === urlSubject ? current : urlSubject));
    setSelectedGrade((current) => (current === urlGrade ? current : urlGrade));
    setCurrentPage((current) => (current === urlPage ? current : urlPage));
    setPriceRange((current) => (current === urlPrice ? current : urlPrice));
    setMinRating((current) => (current === urlMinRating ? current : urlMinRating));
    setSortOption((current) => (current === urlSort ? current : urlSort));
    localSearchEditRef.current = false;
  }, [searchParams]);

  useEffect(() => {
    const currentQuery = searchParams.get('q') ?? '';
    const currentSubject = parseSubjectParam(searchParams.get('subject'));
    const currentGrade = parseGradeParam(searchParams.get('grade'));
    const currentUrlPage = parsePageParam(searchParams.get('page'));
    const currentPrice = parsePriceRange(searchParams.get('price'));
    const currentMinRating = parseRatingParam(searchParams.get('minRating'));
    const currentSort = parseSortParam(searchParams.get('sort'));
    const inputQuery = searchQuery.trim();

    if (inputQuery !== debouncedQuery.trim()) {
      return;
    }

    // Header/back navigation updates the URL before local state catches up.
    // Direct edits inside this page opt into writing the new query back.
    if (currentQuery !== inputQuery && !localSearchEditRef.current) {
      return;
    }

    const nextQuery = debouncedQuery.trim();
    const shouldResetPage =
      currentQuery !== nextQuery ||
      currentSubject !== selectedSubjectSlug ||
      currentGrade !== selectedGrade ||
      currentPrice !== priceRange ||
      currentMinRating !== minRating;
    const nextPage = shouldResetPage ? 0 : currentPage;

    if (shouldResetPage && currentPage !== 0) {
      setCurrentPage(0);
    }

    if (
      currentQuery === nextQuery &&
      currentSubject === selectedSubjectSlug &&
      currentGrade === selectedGrade &&
      currentPrice === priceRange &&
      currentMinRating === minRating &&
      currentSort === sortOption &&
      currentUrlPage === nextPage
    ) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);

    if (nextQuery) nextParams.set('q', nextQuery);
    else nextParams.delete('q');

    if (selectedSubjectSlug) nextParams.set('subject', selectedSubjectSlug);
    else nextParams.delete('subject');

    if (selectedGrade != null) nextParams.set('grade', String(selectedGrade));
    else nextParams.delete('grade');

    if (priceRange !== 'all') nextParams.set('price', priceRange);
    else nextParams.delete('price');

    if (minRating > 0) nextParams.set('minRating', String(minRating));
    else nextParams.delete('minRating');

    if (sortOption !== 'relevance') nextParams.set('sort', sortOption);
    else nextParams.delete('sort');

    if (nextPage > 0) nextParams.set('page', String(nextPage + 1));
    else nextParams.delete('page');

    setSearchParams(nextParams, { replace: true });
    localSearchEditRef.current = false;
  }, [currentPage, debouncedQuery, minRating, priceRange, searchParams, searchQuery, selectedGrade, selectedSubjectSlug, setSearchParams, sortOption]);

  const inferredQueryGrade = selectedGrade == null
    ? inferGradeFromSearchQuery(debouncedQuery)
    : undefined;
  const effectiveGrade = selectedGrade ?? inferredQueryGrade ?? null;
  const selectedPriceRange = PRICE_RANGE_OPTIONS.find((option) => option.value === priceRange)
    ?? PRICE_RANGE_OPTIONS[0];

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const page = await searchCourses({
        subject: selectedSubjectSlug ?? undefined,
        grade: effectiveGrade ?? undefined,
        q: debouncedQuery.trim() || undefined,
        minPrice: selectedPriceRange.minPrice,
        maxPrice: selectedPriceRange.maxPrice,
        minRating: minRating > 0 ? minRating : undefined,
        page: currentPage,
        size: PAGE_SIZE,
        sort: sortOption,
      });

      if (page.totalPages > 0 && currentPage >= page.totalPages) {
        setCurrentPage(page.totalPages - 1);
        return;
      }

      setCourses(page.items.map((item) => adaptCourseSummary(item)));
      setTotalItems(page.totalItems);
      setTotalPages(page.totalPages);
    } catch (err) {
      const message = isApiError(err)
        ? err.message
        : 'Không thể tải khóa học. Vui lòng thử lại.';
      setError(message);
      setCourses([]);
      setTotalItems(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedQuery, effectiveGrade, minRating, selectedPriceRange.maxPrice, selectedPriceRange.minPrice, selectedSubjectSlug, sortOption]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const gradeMatchedCourses = useMemo(() => {
    // Backend đã lọc theo grades[]; không lọc lại bằng nhãn lớp đầu tiên,
    // vì một khóa có thể áp dụng cho nhiều lớp.
    return courses;
  }, [courses, effectiveGrade]);

  const availableCourses = useMemo(() => {
    const enrolledIds = new Set(enrolledCourses.map((course) => course.id));
    return gradeMatchedCourses.filter((course) => !enrolledIds.has(course.id));
  }, [gradeMatchedCourses, enrolledCourses]);

  const selectedSubjectLabel = selectedSubjectSlug == null
    ? 'Tất cả'
    : categories.find((category) => category.slug === selectedSubjectSlug)?.name ?? selectedSubjectSlug;
  const selectedGradeLabel = effectiveGrade == null ? 'Tất cả' : `Lớp ${effectiveGrade}`;
  const visiblePages = useMemo(
    () => buildVisiblePages(currentPage, totalPages),
    [currentPage, totalPages],
  );
  const hiddenMatchedCount = gradeMatchedCourses.length - availableCourses.length;
  const hasActiveFilters = Boolean(
    debouncedQuery.trim() || selectedSubjectSlug || effectiveGrade != null || priceRange !== 'all' || minRating > 0,
  );
  const visibleTotalItems = totalItems;
  const resultSummary = visibleTotalItems === 0
    ? 'Chưa có khóa học phù hợp'
    : `Tìm thấy ${visibleTotalItems.toLocaleString('vi-VN')} khóa học phù hợp`;

  useEffect(() => {
    if (loading || error || courses.length > 0) {
      setSuggestedCourses([]);
      return;
    }

    let cancelled = false;
    const loadSuggestions = async () => {
      try {
        const related = await searchCourses({
          subject: selectedSubjectSlug ?? undefined,
          grade: effectiveGrade ?? undefined,
          page: 0,
          size: 4,
          sort: 'newest',
        });
        let items = related.items;
        if (items.length === 0 && (selectedSubjectSlug || effectiveGrade != null)) {
          const fallback = await searchCourses({ page: 0, size: 4, sort: 'newest' });
          items = fallback.items;
        }
        if (!cancelled) setSuggestedCourses(items.map((item) => adaptCourseSummary(item)));
      } catch {
        if (!cancelled) setSuggestedCourses([]);
      }
    };

    loadSuggestions();
    return () => { cancelled = true; };
  }, [courses.length, effectiveGrade, error, loading, selectedSubjectSlug]);

  const handleSearchInput = (value: string) => {
    localSearchEditRef.current = true;
    setSearchQuery(value);
    setCurrentPage(0);
  };

  const handleSelectSubject = (subject: string | null) => {
    localSearchEditRef.current = true;
    setSelectedSubjectSlug(subject);
    setCurrentPage(0);
  };

  const handleSelectGrade = (grade: number | null) => {
    localSearchEditRef.current = true;
    if (inferGradeFromSearchQuery(searchQuery) != null) {
      setSearchQuery('');
      setDebouncedQuery('');
    }
    setSelectedGrade(grade);
    setCurrentPage(0);
  };

  const handleSelectPrice = (value: PriceRange) => {
    localSearchEditRef.current = true;
    setPriceRange(value);
    setCurrentPage(0);
  };

  const handleSelectRating = (value: number) => {
    localSearchEditRef.current = true;
    setMinRating(value);
    setCurrentPage(0);
  };

  const handleSelectSort = (value: SortOption) => {
    localSearchEditRef.current = true;
    setSortOption(value);
    setCurrentPage(0);
  };

  const handleClearFilters = () => {
    localSearchEditRef.current = true;
    setSelectedSubjectSlug(null);
    setSelectedGrade(null);
    setPriceRange('all');
    setMinRating(0);
    setSortOption('relevance');
    setCurrentPage(0);
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <DashboardHeader />
      <PageBanner title="Khóa học của tôi" subtitle="Tiếp tục hành trình học tập của bạn" />

      <div className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-10 py-8">
        <main>
          {isStudent && (
            <section className="mb-16">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-primary-fixed text-primary rounded-xl flex items-center justify-center">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-extrabold text-on-surface">Khóa Học Của Tôi</h2>
              </div>

              {!enrolledLoading && !enrolledError && enrolledCourses.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-5" aria-label="Lọc khóa học đã mua">
                  {OWNED_COURSE_FILTERS.map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setOwnedCourseFilter(filter.value)}
                      className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                        ownedCourseFilter === filter.value
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      {filter.label} ({ownedCourseCounts[filter.value]})
                    </button>
                  ))}
                </div>
              )}

              {enrolledLoading ? (
                <div className="py-12 flex items-center justify-center gap-3 text-on-surface-variant">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" /> Đang tải khóa học đã mua...
                </div>
              ) : enrolledError ? (
                <div className="py-12 text-center rounded-3xl border border-red-200 bg-red-50 text-red-700">
                  {enrolledError}
                </div>
              ) : filteredEnrolledCourses.length === 0 ? (
                <div className="py-12 px-6 text-center rounded-3xl border border-outline-variant/40 bg-surface-container-lowest">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 text-primary" />
                  <h3 className="text-lg font-extrabold text-on-surface">
                    {enrolledCourses.length === 0 ? 'Bạn chưa sở hữu khóa học nào' : 'Không có khóa học phù hợp'}
                  </h3>
                  <p className="mt-2 text-sm text-on-surface-variant">
                    {enrolledCourses.length === 0
                      ? 'Khám phá các khóa học phù hợp để bắt đầu hành trình học tập.'
                      : 'Hãy chọn bộ lọc khác để xem các khóa học đã mua.'}
                  </p>
                  {enrolledCourses.length === 0 && (
                    <a href="#discover-courses" className="inline-flex mt-5 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold hover:opacity-90">
                      Khám phá ngay
                    </a>
                  )}
                </div>
              ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredEnrolledCourses.map((course, idx) => (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx, 3) * 0.1 }}
                    className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-outline-variant/50 hover:shadow-lg hover:border-primary/30 transition-all group flex flex-col h-full"
                  >
                      <div className="relative h-40 overflow-hidden">
                        <Link to={`/courses/${course.id}?learn=1`}>
                          <CourseCover
                            course={course}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </Link>
                      <div className="absolute top-3 left-3 bg-surface/90 backdrop-blur text-xs font-bold px-3 py-1 rounded-full text-on-surface pointer-events-none">
                        {course.grade}
                      </div>
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors pointer-events-none" />
                      <Link to={`/courses/${course.id}?learn=1`} className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center text-primary shadow-lg hover:scale-110 transition-transform">
                          <PlayCircle className="w-8 h-8" />
                        </div>
                      </Link>
                    </div>
                    <div className="p-5 flex flex-col flex-grow">
                      <Link to={`/courses/${course.id}?learn=1`}>
                        <h3 className="text-lg font-bold mb-1.5 line-clamp-2 text-on-surface hover:text-primary transition-colors">{course.title}</h3>
                      </Link>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleFavorite(course.id);
                        }}
                        className="flex items-center gap-1 mb-2 group/fav"
                      >
                        <Heart className={`w-3.5 h-3.5 transition-all ${favoritedIds.includes(course.id) ? 'fill-red-500 text-red-500' : 'text-on-surface-variant/40 group-hover/fav:text-red-400'}`} />
                        <span className={`text-xs font-medium transition-colors ${favoritedIds.includes(course.id) ? 'text-red-500' : 'text-on-surface-variant/40 group-hover/fav:text-red-400'}`}>
                          {favoritedIds.includes(course.id) ? 'Đã yêu thích' : 'Yêu thích'}
                        </span>
                      </button>
                      <p className="text-sm text-on-surface-variant mb-2">{course.instructor}</p>
                      <div className="flex flex-wrap gap-2 mb-4 text-[11px] font-semibold">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${
                          course.learningStatus === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : course.learningStatus === 'not_started'
                            ? 'bg-surface-container text-on-surface-variant'
                            : 'bg-primary/10 text-primary'
                        }`}>
                          {course.learningStatus === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                          {course.learningStatus === 'completed' ? 'Đã hoàn thành' : course.learningStatus === 'not_started' ? 'Chưa bắt đầu' : 'Đang học'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-1 mb-4 text-xs text-on-surface-variant">
                        <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> Mua: {formatOwnedCourseDate(course.purchasedAt, '—')}</span>
                        <span className="inline-flex items-center gap-1"><Clock3 className="w-3.5 h-3.5" /> Học gần nhất: {formatOwnedCourseDate(course.lastAccessedAt, 'Chưa học')}</span>
                      </div>
                      <div className="mt-auto">
                        <div className="flex justify-between text-xs font-semibold mb-1.5">
                          <span className="text-primary">Tiến độ</span>
                          <span className="text-on-surface">{course.progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${course.progress}%` }}
                            transition={{ duration: 1, delay: 0.2 }}
                            className="h-full bg-primary rounded-full"
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              )}
            </section>
          )}

          {isStudent && enrolledCourses.length > 0 && <hr className="border-outline-variant/30 mb-12" />}

          <section id="discover-courses">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-secondary-container text-on-secondary-container rounded-xl flex items-center justify-center">
                  <Filter className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-on-surface">Khám Phá Khóa Học</h2>
                  <p className="text-sm text-on-surface-variant mt-1">
                    {loading ? 'Đang cập nhật kết quả...' : resultSummary}
                    {debouncedQuery ? ` cho "${debouncedQuery.trim()}"` : ''}
                  </p>
                </div>
              </div>

              <div className="w-full lg:w-72 relative md:hidden">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
                <input
                  type="text"
                  placeholder="Tìm khóa học..."
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-surface-container border border-outline-variant/50 focus:border-primary outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
              <div className="w-full lg:w-64 flex-shrink-0 space-y-8 bg-surface-container-lowest p-6 rounded-[2rem] border border-outline-variant/40 shadow-sm sticky top-24">
                <div>
                  <h3 className="font-bold text-lg mb-4 text-on-surface">Môn Học</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleSelectSubject(null)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                        selectedSubjectSlug === null
                          ? 'bg-primary text-on-primary shadow-md shadow-primary/20'
                          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      Tất cả
                    </button>
                    {categories.map((category) => (
                      <button
                        key={category.slug}
                        onClick={() => handleSelectSubject(category.slug)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                          selectedSubjectSlug === category.slug
                            ? 'bg-primary text-on-primary shadow-md shadow-primary/20'
                            : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-lg mb-4 text-on-surface">Lớp Học</h3>
                  <div className="flex flex-col gap-2">
                    {GRADE_OPTIONS.map((option) => (
                      <label
                        key={option.label}
                        className="flex items-center gap-3 cursor-pointer group"
                      >
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                            selectedGrade === option.value
                              ? 'bg-primary border-primary'
                              : 'border-outline-variant group-hover:border-primary'
                          }`}
                        >
                          {selectedGrade === option.value && (
                            <div className="w-2.5 h-2.5 bg-on-primary rounded-sm" />
                          )}
                        </div>
                        <span
                          className={`font-medium ${
                            selectedGrade === option.value
                              ? 'text-primary'
                              : 'text-on-surface-variant group-hover:text-on-surface'
                          }`}
                        >
                          {option.label}
                        </span>
                        <input
                          type="radio"
                          name="grade"
                          className="hidden"
                          checked={selectedGrade === option.value}
                          onChange={() => handleSelectGrade(option.value as number | null)}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="course-price-filter" className="font-bold text-lg mb-3 block text-on-surface">
                    Giá khóa học
                  </label>
                  <select
                    id="course-price-filter"
                    value={priceRange}
                    onChange={(e) => handleSelectPrice(e.target.value as PriceRange)}
                    className="w-full px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant/50 text-sm font-medium outline-none focus:border-primary"
                  >
                    {PRICE_RANGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="course-rating-filter" className="font-bold text-lg mb-3 block text-on-surface">
                    Đánh giá
                  </label>
                  <select
                    id="course-rating-filter"
                    value={minRating}
                    onChange={(e) => handleSelectRating(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant/50 text-sm font-medium outline-none focus:border-primary"
                  >
                    {RATING_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                {hasActiveFilters && (
                  <button
                    onClick={handleClearFilters}
                    className="w-full px-4 py-3 rounded-xl bg-surface-container text-on-surface font-semibold hover:bg-surface-container-high transition-colors border border-outline-variant/50"
                  >
                    Xóa bộ lọc
                  </button>
                )}
              </div>

              <div className="flex-1 w-full min-h-[400px]">
                {!loading && !error && (
                  <div className="mb-6 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="font-semibold text-on-surface">{resultSummary}</p>
                      <p className="text-sm text-on-surface-variant">
                        Môn: <span className="text-on-surface">{selectedSubjectLabel}</span> · Lớp: <span className="text-on-surface">{selectedGradeLabel}</span>
                        {debouncedQuery ? ` · Từ khóa: "${debouncedQuery.trim()}"` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label htmlFor="course-sort" className="text-sm font-semibold text-on-surface-variant whitespace-nowrap">
                        Sắp xếp
                      </label>
                      <select
                        id="course-sort"
                        value={sortOption}
                        onChange={(e) => handleSelectSort(e.target.value as SortOption)}
                        className="px-3 py-2 rounded-xl bg-surface-container border border-outline-variant/50 text-sm font-semibold text-on-surface outline-none focus:border-primary"
                      >
                        {SORT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <p className="text-sm text-on-surface-variant">
                      Trang <span className="font-semibold text-on-surface">{Math.min(currentPage + 1, Math.max(totalPages, 1))}</span> / <span className="font-semibold text-on-surface">{Math.max(totalPages, 1)}</span>
                      {hiddenMatchedCount > 0 ? ` · ${hiddenMatchedCount} khóa học đã có trong mục của bạn` : ''}
                    </p>
                  </div>
                )}

                {loading ? (
                  <div className="w-full py-20 flex flex-col items-center justify-center bg-surface-container-lowest rounded-[2rem] border border-outline-variant/30 border-dashed">
                    <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                    <p className="text-on-surface-variant">Đang tải khóa học...</p>
                  </div>
                ) : error ? (
                  <div className="w-full py-20 flex flex-col items-center justify-center bg-surface-container-lowest rounded-[2rem] border border-red-300 border-dashed">
                    <p className="text-red-600 font-semibold mb-4">{error}</p>
                    <button
                      onClick={fetchCourses}
                      className="px-6 py-2.5 bg-primary text-on-primary font-semibold rounded-full hover:opacity-90"
                    >
                      Thử lại
                    </button>
                  </div>
                ) : courses.length > 0 ? (
                  <>
                    {availableCourses.length > 0 ? (
                      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                        <AnimatePresence>
                          {availableCourses.map((course) => (
                            <motion.div
                              key={course.id}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              transition={{ duration: 0.3 }}
                              className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-outline-variant/40 hover:shadow-xl hover:border-primary/50 transition-all group flex flex-col h-full"
                            >
                              <div className="relative h-48 overflow-hidden">
                                <Link to={`/courses/${course.id}`}>
                                  <CourseCover
                                    course={course}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                  />
                                </Link>
                                <div className="absolute top-4 left-4 flex gap-2 pointer-events-none">
                                  <span className="bg-surface/90 backdrop-blur text-xs font-bold px-3 py-1.5 rounded-full text-on-surface shadow-sm">
                                    {course.grade}
                                  </span>
                                  <span className="bg-primary/90 backdrop-blur text-xs font-bold px-3 py-1.5 rounded-full text-on-primary shadow-sm">
                                    {course.subject}
                                  </span>
                                  {course.hasFreePreview && (
                                    <span className="bg-amber-500/90 backdrop-blur text-xs font-bold px-3 py-1.5 rounded-full text-white shadow-sm">
                                      Học thử miễn phí
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="p-6 flex flex-col flex-grow">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-1 text-sm font-semibold text-amber-500">
                                    <Star className="w-4 h-4 fill-amber-500" /> {course.rating}
                                  </div>
                                  <div className="flex items-center gap-1 text-sm font-medium text-on-surface-variant">
                                    <Users className="w-4 h-4" /> {course.students.toLocaleString('vi-VN')}
                                  </div>
                                </div>
                                <Link to={`/courses/${course.id}`}>
                                  <h3 className="text-xl font-bold mb-1.5 line-clamp-2 text-on-surface leading-tight hover:text-primary transition-colors">
                                    {course.title}
                                  </h3>
                                </Link>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleFavorite(course.id);
                                  }}
                                  className="flex items-center gap-1 mb-3 group/fav"
                                >
                                  <Heart className={`w-3.5 h-3.5 transition-all ${favoritedIds.includes(course.id) ? 'fill-red-500 text-red-500' : 'text-on-surface-variant/40 group-hover/fav:text-red-400'}`} />
                                  <span className={`text-xs font-medium transition-colors ${favoritedIds.includes(course.id) ? 'text-red-500' : 'text-on-surface-variant/40 group-hover/fav:text-red-400'}`}>
                                    {favoritedIds.includes(course.id) ? 'Đã yêu thích' : 'Yêu thích'}
                                  </span>
                                </button>
                                <p className="text-on-surface-variant text-sm mb-6 line-clamp-2 leading-relaxed">
                                  {course.description}
                                </p>
                                <div className="mt-auto flex items-center justify-between pt-4 border-t border-outline-variant/30">
                                  <div>
                                    <p className="text-sm font-semibold text-on-surface-variant">{course.instructor}</p>
                                    <p className="text-base font-extrabold text-primary mt-1">{course.price}</p>
                                  </div>
                                  <Link
                                    to={`/courses/${course.id}`}
                                    className="px-5 py-2 rounded-xl font-bold text-sm text-primary bg-primary/10 hover:bg-primary hover:text-on-primary transition-colors"
                                  >
                                    {course.hasFreePreview ? 'Xem thử miễn phí' : 'Mua ngay'}
                                  </Link>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <div className="w-full py-20 flex flex-col items-center justify-center bg-surface-container-lowest rounded-[2rem] border border-outline-variant/30 border-dashed">
                        <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mb-4 text-on-surface-variant">
                          <BookOpen className="w-10 h-10 opacity-50" />
                        </div>
                        <h3 className="text-xl font-bold text-on-surface mb-2">Trang này chỉ có khóa học bạn đã tham gia</h3>
                         <p className="text-on-surface-variant text-center max-w-md">
                          Hãy chuyển trang hoặc đổi bộ lọc để xem thêm các khóa học mới phù hợp với bạn.
                        </p>
                      </div>
                    )}

                    {totalPages > 1 && (
                      <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <button
                          onClick={() => setCurrentPage((page) => Math.max(0, page - 1))}
                          disabled={currentPage === 0}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant/50 bg-surface-container-lowest text-on-surface font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-container transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Trang trước
                        </button>

                        <div className="flex items-center gap-2 flex-wrap justify-center">
                          {visiblePages.map((pageNumber) => (
                            <button
                              key={pageNumber}
                              onClick={() => setCurrentPage(pageNumber - 1)}
                              className={`min-w-11 h-11 px-3 rounded-xl text-sm font-bold transition-colors ${
                                currentPage === pageNumber - 1
                                  ? 'bg-primary text-on-primary shadow-md shadow-primary/20'
                                  : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container border border-outline-variant/40'
                              }`}
                            >
                              {pageNumber}
                            </button>
                          ))}
                        </div>

                        <button
                          onClick={() => setCurrentPage((page) => Math.min(totalPages - 1, page + 1))}
                          disabled={currentPage >= totalPages - 1}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant/50 bg-surface-container-lowest text-on-surface font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-container transition-colors"
                        >
                          Trang sau
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full py-20 flex flex-col items-center justify-center bg-surface-container-lowest rounded-[2rem] border border-outline-variant/30 border-dashed">
                    <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mb-4 text-on-surface-variant">
                      <Search className="w-10 h-10 opacity-50" />
                    </div>
                    <h3 className="text-xl font-bold text-on-surface mb-2">
                      {hiddenMatchedCount > 0 ? 'Bạn đã tham gia các khóa học phù hợp' : 'Không tìm thấy khóa học nào'}
                    </h3>
                    <p className="text-on-surface-variant text-center max-w-md">
                      {hiddenMatchedCount > 0
                        ? 'Các kết quả phù hợp đã xuất hiện trong mục "Khóa Học Của Tôi". Hãy thử môn học, lớp hoặc từ khóa khác để khám phá thêm khóa học mới.'
                        : (
                          <>
                            Không có khóa học phù hợp với{' '}
                            <strong className="text-primary">{selectedSubjectLabel}</strong> /{' '}
                            <strong className="text-primary">{selectedGradeLabel}</strong>
                            {debouncedQuery ? ` và từ khóa "${debouncedQuery.trim()}"` : ''}.
                          </>
                         )}
                       </p>
                       {suggestedCourses.length > 0 && (
                         <div className="mt-8 w-full max-w-3xl">
                           <h4 className="font-extrabold text-on-surface mb-3">Gợi ý khóa học liên quan</h4>
                           <div className="grid sm:grid-cols-2 gap-3">
                             {suggestedCourses.map((course) => (
                               <Link
                                 key={course.id}
                                 to={`/courses/${course.id}`}
                                 className="flex items-center gap-3 p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 hover:border-primary/50 transition-colors text-left"
                               >
                                 <CourseCover course={course} className="w-16 h-12 rounded-xl object-cover flex-shrink-0" />
                                 <span className="min-w-0">
                                   <span className="block font-bold text-sm text-on-surface line-clamp-2">{course.title}</span>
                                   <span className="block text-xs font-extrabold text-primary mt-1">{course.price}</span>
                                 </span>
                               </Link>
                             ))}
                           </div>
                         </div>
                       )}
                    <button
                      onClick={handleClearFilters}
                      className="mt-6 px-6 py-2.5 bg-surface-container text-on-surface font-semibold rounded-full hover:bg-surface-container-high transition-colors border border-outline-variant/50"
                    >
                      Xóa bộ lọc
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

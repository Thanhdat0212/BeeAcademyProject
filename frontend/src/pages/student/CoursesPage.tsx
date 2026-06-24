import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
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
import type { Course as UiCourse } from '../../data/mockCourses';
import { useCourseStore } from '../../store/useCourseStore';
import {
  getEnrolledCourses,
  inferGradeFromSearchQuery,
  listCategories,
  searchCourses,
} from '../../api/courseService';
import { adaptCourseSummary } from '../../api/adapter';
import { isApiError } from '../../api/client';
import type { Category } from '../../types/api';

const GRADE_OPTIONS = [
  { value: null, label: 'Tất cả' },
  { value: 6, label: 'Lớp 6' },
  { value: 7, label: 'Lớp 7' },
  { value: 8, label: 'Lớp 8' },
  { value: 9, label: 'Lớp 9' },
] as const;

const PAGE_SIZE = 12;

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

  const [categories, setCategories] = useState<Category[]>([]);
  const [courses, setCourses] = useState<UiCourse[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const favoritedIds = useCourseStore((state) => state.favoritedIds);
  const toggleFavorite = useCourseStore((state) => state.toggleFavorite);
  const completedLessons = useCourseStore((state) => state.completedLessons);

  const [enrolledCourses, setEnrolledCourses] = useState<UiCourse[]>([]);

  useEffect(() => {
    getEnrolledCourses()
      .then((items) => setEnrolledCourses(
        items.map((summary) => {
          const course = adaptCourseSummary(summary, true);
          const completedList = completedLessons[course.id] ?? [];
          const totalLessons = course.lessons?.length ?? 0;
          const progress = totalLessons > 0
            ? Math.round((completedList.length / totalLessons) * 100)
            : 0;
          return { ...course, progress };
        }),
      ))
      .catch(() => {
        // Không cần chặn UX nếu user chưa có khóa học đã mua.
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    setSearchQuery((current) => (current === urlQuery ? current : urlQuery));
    setDebouncedQuery((current) => (current === urlQuery ? current : urlQuery));
    setSelectedSubjectSlug((current) => (current === urlSubject ? current : urlSubject));
    setSelectedGrade((current) => (current === urlGrade ? current : urlGrade));
    setCurrentPage((current) => (current === urlPage ? current : urlPage));
    localSearchEditRef.current = false;
  }, [searchParams]);

  useEffect(() => {
    const currentQuery = searchParams.get('q') ?? '';
    const currentSubject = parseSubjectParam(searchParams.get('subject'));
    const currentGrade = parseGradeParam(searchParams.get('grade'));
    const currentUrlPage = parsePageParam(searchParams.get('page'));
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
      currentGrade !== selectedGrade;
    const nextPage = shouldResetPage ? 0 : currentPage;

    if (shouldResetPage && currentPage !== 0) {
      setCurrentPage(0);
    }

    if (
      currentQuery === nextQuery &&
      currentSubject === selectedSubjectSlug &&
      currentGrade === selectedGrade &&
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

    if (nextPage > 0) nextParams.set('page', String(nextPage + 1));
    else nextParams.delete('page');

    setSearchParams(nextParams, { replace: true });
    localSearchEditRef.current = false;
  }, [currentPage, debouncedQuery, searchParams, searchQuery, selectedGrade, selectedSubjectSlug, setSearchParams]);

  const inferredQueryGrade = selectedGrade == null
    ? inferGradeFromSearchQuery(debouncedQuery)
    : undefined;
  const effectiveGrade = selectedGrade ?? inferredQueryGrade ?? null;

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const page = await searchCourses({
        subject: selectedSubjectSlug ?? undefined,
        grade: effectiveGrade ?? undefined,
        q: debouncedQuery.trim() || undefined,
        page: currentPage,
        size: PAGE_SIZE,
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
  }, [currentPage, debouncedQuery, effectiveGrade, selectedSubjectSlug]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const gradeMatchedCourses = useMemo(() => {
    if (effectiveGrade == null) return courses;
    const gradeLabel = `Lớp ${effectiveGrade}`;
    return courses.filter((course) => course.grade === gradeLabel);
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
    debouncedQuery.trim() || selectedSubjectSlug || effectiveGrade != null,
  );
  const visibleTotalItems = effectiveGrade == null ? totalItems : gradeMatchedCourses.length;
  const resultSummary = visibleTotalItems === 0
    ? 'Chưa có khóa học phù hợp'
    : `Tìm thấy ${visibleTotalItems.toLocaleString('vi-VN')} khóa học phù hợp`;

  const handleSearchInput = (value: string) => {
    localSearchEditRef.current = true;
    setSearchQuery(value);
    setCurrentPage(0);
  };

  const handleSelectSubject = (subject: string | null) => {
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

  const handleClearFilters = () => {
    localSearchEditRef.current = true;
    setSelectedSubjectSlug(null);
    setSelectedGrade(null);
    setCurrentPage(0);
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <DashboardHeader />
      <PageBanner title="Khóa học của tôi" subtitle="Tiếp tục hành trình học tập của bạn" />

      <div className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-10 py-8">
        <main>
          {enrolledCourses.length > 0 && (
            <section className="mb-16">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-primary-fixed text-primary rounded-xl flex items-center justify-center">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-extrabold text-on-surface">Khóa Học Của Tôi</h2>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {enrolledCourses.map((course, idx) => (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-outline-variant/50 hover:shadow-lg hover:border-primary/30 transition-all group flex flex-col h-full"
                  >
                    <div className="relative h-40 overflow-hidden">
                      <Link to={`/courses/${course.id}`}>
                        <img src={course.image} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      </Link>
                      <div className="absolute top-3 left-3 bg-surface/90 backdrop-blur text-xs font-bold px-3 py-1 rounded-full text-on-surface pointer-events-none">
                        {course.grade}
                      </div>
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors pointer-events-none" />
                      <Link to={`/courses/${course.id}`} className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center text-primary shadow-lg hover:scale-110 transition-transform">
                          <PlayCircle className="w-8 h-8" />
                        </div>
                      </Link>
                    </div>
                    <div className="p-5 flex flex-col flex-grow">
                      <Link to={`/courses/${course.id}`}>
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
                      <p className="text-sm text-on-surface-variant mb-4">{course.instructor}</p>
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
            </section>
          )}

          {enrolledCourses.length > 0 && <hr className="border-outline-variant/30 mb-12" />}

          <section>
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
                      <motion.div layout className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                        <AnimatePresence>
                          {availableCourses.map((course) => (
                            <motion.div
                              layout
                              key={course.id}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              transition={{ duration: 0.3 }}
                              className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-outline-variant/40 hover:shadow-xl hover:border-primary/50 transition-all group flex flex-col h-full"
                            >
                              <div className="relative h-48 overflow-hidden">
                                <Link to={`/courses/${course.id}`}>
                                  <img
                                    src={course.image}
                                    alt={course.title}
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
                                  {course.reviewCount && course.reviewCount > 0 ? (
                                    <div className="flex items-center gap-1 text-sm font-semibold text-amber-500">
                                      <Star className="w-4 h-4 fill-amber-500" /> {course.rating}
                                    </div>
                                  ) : (
                                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">Mới</span>
                                  )}
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
                                  <span className="text-sm font-semibold text-on-surface-variant">
                                    {course.instructor}
                                  </span>
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
                      </motion.div>
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

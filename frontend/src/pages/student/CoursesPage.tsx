// ═══════════════════════════════════════════════════════════════════════════════
// TRANG DANH SÁCH KHÓA HỌC — CoursesPage.tsx
//
// VỊ TRÍ TRONG HỆ THỐNG:
//   URL: /courses
//   Người dùng đến từ: Landing page, Header search (→ /courses?q=...), CheckoutPage
//   Người dùng đi đến: CourseDetailPage (/courses/:id), CheckoutPage (/checkout)
//
// LUỒNG GIAI ĐOẠN 1C (đã tích hợp Backend):
//   1. useEffect → listCategories() đổ dropdown bộ lọc môn học (8 categories thật).
//   2. State filter (subject slug, grade, q) thay đổi → debounce 300ms → gọi
//      searchCourses() lấy danh sách + phân trang.
//   3. Enrolled section fetch từ GET /api/me/courses (enrollments thật).
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, Users, PlayCircle, BookOpen, Filter, Search, Heart, Loader2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import DashboardHeader from '../../components/DashboardHeader';
import PageBanner from '../../components/PageBanner';
import type { Course as UiCourse } from '../../data/mockCourses';
import { useCourseStore } from '../../store/useCourseStore';
import { listCategories, searchCourses, getEnrolledCourses } from '../../api/courseService';
import { adaptCourseSummary } from '../../api/adapter';
import { isApiError } from '../../api/client';
import type { Category } from '../../types/api';

// Danh sách lớp 6-9 + "Tất cả" - cố định, không cần fetch
const GRADE_OPTIONS = [
  { value: null, label: 'Tất cả' },
  { value: 6, label: 'Lớp 6' },
  { value: 7, label: 'Lớp 7' },
  { value: 8, label: 'Lớp 8' },
  { value: 9, label: 'Lớp 9' },
] as const;

// Sentinel value cho "Tất cả môn học" (BE filter bằng slug, null = không filter)
const ALL_SUBJECTS_SLUG = '__all__';

export default function CoursesPage() {
  // ── URL Params ──────────────────────────────────────────────────────────────
  const [searchParams] = useSearchParams();

  // ── State bộ lọc ─────────────────────────────────────────────────────────
  // selectedSubjectSlug: null = "Tất cả", còn lại là category.slug (vd "toan-hoc")
  const [selectedSubjectSlug, setSelectedSubjectSlug] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>(() => searchParams.get('q') ?? '');

  // Debounced search query - chỉ thay đổi sau 300ms ngưng gõ → tránh spam BE
  const [debouncedQuery, setDebouncedQuery] = useState<string>(searchQuery);

  // ── Data từ Backend ──────────────────────────────────────────────────────
  const [categories, setCategories] = useState<Category[]>([]);
  const [courses, setCourses] = useState<UiCourse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ── Zustand Store ──────────────────────────────────────────────────────────
  const favoritedIds = useCourseStore((state) => state.favoritedIds);
  const toggleFavorite = useCourseStore((state) => state.toggleFavorite);
  const completedLessons = useCourseStore((state) => state.completedLessons);

  // ── Khóa học đã enroll — fetch từ API thật ────────────────────────────────
  const [enrolledCourses, setEnrolledCourses] = useState<UiCourse[]>([]);

  useEffect(() => {
    getEnrolledCourses()
      .then(items => setEnrolledCourses(
        items.map(s => {
          const course = adaptCourseSummary(s, true);
          const completedList = completedLessons[course.id] ?? [];
          const totalLessons = course.lessons?.length ?? 0;
          const progress = totalLessons > 0
            ? Math.round((completedList.length / totalLessons) * 100)
            : 0;
          return { ...course, progress };
        })
      ))
      .catch(() => {
        // Không hiện toast — nếu chưa mua khoá nào thì list rỗng là đúng
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Effect: fetch categories 1 lần khi mount ─────────────────────────────
  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch((err) => {
        console.error('Không tải được danh mục:', err);
        // Không hiện toast - dropdown rỗng không phá UX, search vẫn dùng được
      });
  }, []);

  // ── Effect: debounce searchQuery 300ms ───────────────────────────────────
  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // ── Fetch courses mỗi khi filter thay đổi (debounced) ────────────────────
  // useCallback để không tạo lại function reference mỗi render (chỉ thay đổi khi filter đổi)
  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await searchCourses({
        // Truyền undefined nếu null để axios bỏ qua param (không gửi ?subject=null)
        subject: selectedSubjectSlug ?? undefined,
        grade: selectedGrade ?? undefined,
        q: debouncedQuery.trim() || undefined,
        size: 24,
      });
      // Map BE shape → UI shape một lần duy nhất ở đây
      setCourses(page.items.map(s => adaptCourseSummary(s)));
    } catch (err) {
      const message = isApiError(err)
        ? err.message
        : 'Không thể tải khóa học. Vui lòng thử lại.';
      setError(message);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSubjectSlug, selectedGrade, debouncedQuery]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // Lọc bỏ khóa học đã enrolled khỏi danh sách khám phá
  const availableCourses = useMemo(() => {
    const enrolledIds = new Set(enrolledCourses.map((c) => c.id));
    return courses.filter((c) => !enrolledIds.has(c.id));
  }, [courses, enrolledCourses]);

  const handleClearFilters = () => {
    setSelectedSubjectSlug(null);
    setSelectedGrade(null);
    setSearchQuery('');
  };

  // Tên môn học hiện tại (để hiển thị trong empty state)
  const selectedSubjectLabel =
    selectedSubjectSlug == null
      ? 'Tất cả'
      : categories.find((c) => c.slug === selectedSubjectSlug)?.name ?? selectedSubjectSlug;
  const selectedGradeLabel = selectedGrade == null ? 'Tất cả' : `Lớp ${selectedGrade}`;

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <DashboardHeader />
      <PageBanner title="Khóa học của tôi" subtitle="Tiếp tục hành trình học tập của bạn" />

      <div className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-10 py-8">
        <main>
          {/* ══════════════════════════════════════════════════════════════════════
              SECTION 1: KHÓA HỌC ĐÃ THAM GIA (giữ MOCK đến Module 3)
          ════════════════════════════════════════════════════════════════════════ */}
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
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(course.id); }}
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
                          <motion.div initial={{ width: 0 }} animate={{ width: `${course.progress}%` }} transition={{ duration: 1, delay: 0.2 }} className="h-full bg-primary rounded-full" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {enrolledCourses.length > 0 && <hr className="border-outline-variant/30 mb-12" />}

          {/* ══════════════════════════════════════════════════════════════════════
              SECTION 2: KHÁM PHÁ KHÓA HỌC - lấy từ API thật
          ════════════════════════════════════════════════════════════════════════ */}
          <section>
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-secondary-container text-on-secondary-container rounded-xl flex items-center justify-center">
                  <Filter className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-extrabold text-on-surface">Khám Phá Khóa Học</h2>
              </div>

              {/* Search mobile - desktop dùng search trong Header */}
              <div className="w-full lg:w-72 relative md:hidden">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
                <input
                  type="text"
                  placeholder="Tìm khóa học..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-surface-container border border-outline-variant/50 focus:border-primary outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
              {/* ── SIDEBAR BỘ LỌC ───────────────────────────────────── */}
              <div className="w-full lg:w-64 flex-shrink-0 space-y-8 bg-surface-container-lowest p-6 rounded-[2rem] border border-outline-variant/40 shadow-sm sticky top-24">
                {/* Môn học - đổ động từ /api/categories */}
                <div>
                  <h3 className="font-bold text-lg mb-4 text-on-surface">Môn Học</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedSubjectSlug(null)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                        selectedSubjectSlug === null
                          ? 'bg-primary text-on-primary shadow-md shadow-primary/20'
                          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      Tất cả
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.slug}
                        onClick={() => setSelectedSubjectSlug(cat.slug)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                          selectedSubjectSlug === cat.slug
                            ? 'bg-primary text-on-primary shadow-md shadow-primary/20'
                            : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lớp học - cố định 6-9 */}
                <div>
                  <h3 className="font-bold text-lg mb-4 text-on-surface">Lớp Học</h3>
                  <div className="flex flex-col gap-2">
                    {GRADE_OPTIONS.map((g) => (
                      <label
                        key={g.label}
                        className="flex items-center gap-3 cursor-pointer group"
                      >
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                            selectedGrade === g.value
                              ? 'bg-primary border-primary'
                              : 'border-outline-variant group-hover:border-primary'
                          }`}
                        >
                          {selectedGrade === g.value && (
                            <div className="w-2.5 h-2.5 bg-on-primary rounded-sm" />
                          )}
                        </div>
                        <span
                          className={`font-medium ${
                            selectedGrade === g.value
                              ? 'text-primary'
                              : 'text-on-surface-variant group-hover:text-on-surface'
                          }`}
                        >
                          {g.label}
                        </span>
                        <input
                          type="radio"
                          name="grade"
                          className="hidden"
                          checked={selectedGrade === g.value}
                          onChange={() => setSelectedGrade(g.value as number | null)}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── GRID KHÓA HỌC ─────────────────────────────────── */}
              <div className="flex-1 w-full min-h-[400px]">
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
                ) : availableCourses.length > 0 ? (
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
                              <span className="text-sm font-semibold text-on-surface-variant">
                                {course.instructor}
                              </span>
                              <Link
                                to={`/courses/${course.id}`}
                                className="px-5 py-2 rounded-xl font-bold text-sm text-primary bg-primary/10 hover:bg-primary hover:text-on-primary transition-colors"
                              >
                                Mua Ngay
                              </Link>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </motion.div>
                ) : (
                  // Empty state
                  <div className="w-full py-20 flex flex-col items-center justify-center bg-surface-container-lowest rounded-[2rem] border border-outline-variant/30 border-dashed">
                    <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mb-4 text-on-surface-variant">
                      <Search className="w-10 h-10 opacity-50" />
                    </div>
                    <h3 className="text-xl font-bold text-on-surface mb-2">Không tìm thấy khóa học nào</h3>
                    <p className="text-on-surface-variant text-center max-w-md">
                      Không có khóa học phù hợp với{' '}
                      <strong className="text-primary">{selectedSubjectLabel}</strong> /{' '}
                      <strong className="text-primary">{selectedGradeLabel}</strong>
                      {debouncedQuery ? ` và từ khóa "${debouncedQuery}"` : ''}.
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

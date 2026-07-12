import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  BarChart2,
  BookOpen,
  ClipboardList,
  Database,
  FileText,
  GraduationCap,
  HelpCircle,
  Landmark,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  PenSquare,
  RefreshCw,
  Search,
  Star,
  UserCircle,
  X,
} from 'lucide-react';
import TeacherNotificationBell from '../../components/TeacherNotificationBell';
import { notify } from '../../lib/toast';
import { useAuthStore } from '../../store/useAuthStore';
import {
  getTeacherCourseReviews,
  listMyCourses,
  TeacherCourseResponse,
} from '../../api/teacherCourseService';
import type { CourseReview, CourseReviewSummary } from '../../types/api';

const COURSE_FETCH_LIMIT = 50;

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Tổng quan', path: '/teacher' },
  { icon: BookOpen, label: 'Khóa học của tôi', path: '/teacher/courses' },
  { icon: Star, label: 'Đánh giá khóa học', path: '/teacher/reviews' },
  { icon: FileText, label: 'Bài giảng', path: '/teacher/content' },
  { icon: PenSquare, label: 'Quiz chương', path: '/teacher/quiz' },
  { icon: Database, label: 'Ngân hàng câu hỏi', path: '/teacher/questions' },
  { icon: GraduationCap, label: 'Bài kiểm tra', path: '/teacher/exam' },
  { icon: ClipboardList, label: 'Chấm điểm', path: '/teacher/grades' },
  { icon: HelpCircle, label: 'Hỏi & Đáp', path: '/teacher/qa' },
  { icon: Megaphone, label: 'Khiếu nại', path: '/teacher/complaints' },
  { icon: BarChart2, label: 'Doanh thu', path: '/teacher/revenue' },
  { icon: Landmark, label: 'TK ngân hàng', path: '/teacher/bank' },
  { icon: UserCircle, label: 'Hồ sơ', path: '/teacher/profile' },
  { icon: Lock, label: 'Tài khoản', path: '/teacher/account' },
];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function avatarFor(name: string | null, url: string | null | undefined): string {
  return url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Học viên')}&background=e5e7eb&color=111827&bold=true`;
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating}/5 sao`}>
      {[1, 2, 3, 4, 5].map(value => (
        <Star
          key={value}
          className={`h-4 w-4 ${value <= rating ? 'fill-amber-400 text-amber-400' : 'text-outline-variant'}`}
        />
      ))}
    </div>
  );
}

export default function TeacherReviewsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseId: routeCourseId } = useParams<{ courseId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [courses, setCourses] = useState<TeacherCourseResponse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState(routeCourseId ?? searchParams.get('courseId') ?? '');
  const [summary, setSummary] = useState<CourseReviewSummary | null>(null);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [ratingFilter, setRatingFilter] = useState<'all' | '5' | '4' | '3' | '2' | '1'>('all');

  const selectedCourse = courses.find(course => course.id === selectedCourseId) ?? null;

  const derivedReviewCount = summary?.reviewCount && summary.reviewCount > 0
    ? summary.reviewCount
    : summary?.reviews.length ?? 0;
  const derivedAverageRating = summary?.reviewCount && summary.reviewCount > 0
    ? summary.averageRating
    : (summary?.reviews.length
        ? Math.round((summary.reviews.reduce((sum, review) => sum + review.rating, 0) / summary.reviews.length) * 10) / 10
        : 0);

  const filteredReviews = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return (summary?.reviews ?? []).filter(review => {
      if (ratingFilter !== 'all' && review.rating !== Number(ratingFilter)) return false;
      if (!q) return true;
      return (
        (review.studentName ?? '').toLowerCase().includes(q) ||
        (review.comment ?? '').toLowerCase().includes(q)
      );
    });
  }, [ratingFilter, searchTerm, summary]);

  async function loadCourses() {
    try {
      setLoadingCourses(true);
      const page = await listMyCourses(0, COURSE_FETCH_LIMIT);
      setCourses(page.items);
      setSelectedCourseId(current => {
        if (current && page.items.some(course => course.id === current)) return current;
        return page.items[0]?.id ?? '';
      });
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không tải được danh sách khóa học');
    } finally {
      setLoadingCourses(false);
    }
  }

  async function loadReviews(courseId = selectedCourseId) {
    if (!courseId) {
      setSummary(null);
      return;
    }
    try {
      setLoadingReviews(true);
      const data = await getTeacherCourseReviews(courseId);
      setSummary(data);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không tải được đánh giá khóa học');
      setSummary(null);
    } finally {
      setLoadingReviews(false);
    }
  }

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    const requestedCourseId = routeCourseId ?? searchParams.get('courseId') ?? '';
    if (requestedCourseId) setSelectedCourseId(requestedCourseId);
  }, [routeCourseId, searchParams]);

  useEffect(() => {
    if (!selectedCourseId) {
      setSummary(null);
      return;
    }

    loadReviews(selectedCourseId);
    if (!routeCourseId) {
      setSearchParams({ courseId: selectedCourseId }, { replace: true });
    }
  }, [selectedCourseId]);

  function handleCourseChange(courseId: string) {
    setSelectedCourseId(courseId);
    if (routeCourseId) {
      navigate(`/teacher/courses/${courseId}/reviews`, { replace: true });
    }
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function renderReview(review: CourseReview) {
    return (
      <article
        key={review.id}
        className="rounded-2xl border border-outline-variant/35 bg-surface-container-lowest p-4 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <img
            src={avatarFor(review.studentName, review.studentAvatarUrl)}
            alt={review.studentName ?? 'Học viên'}
            className="h-11 w-11 rounded-full object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-on-surface">{review.studentName ?? 'Học viên Bee Academy'}</p>
                <p className="text-xs text-on-surface-variant">{formatDateTime(review.updatedAt)}</p>
              </div>
              <Stars rating={review.rating} />
            </div>
            {review.comment ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-on-surface">{review.comment}</p>
            ) : (
              <p className="mt-3 text-sm italic text-on-surface-variant">Học viên chỉ chấm điểm, chưa viết nhận xét.</p>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex font-sans text-on-surface">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64
        bg-surface-container-lowest border-r border-outline-variant/30
        flex flex-col transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:flex
      `}>
        <div className="p-6 flex items-center justify-between border-b border-outline-variant/20">
          <Link to="/teacher" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary text-on-primary rounded-xl flex items-center justify-center font-extrabold text-lg shadow-md shadow-primary/20">
              B
            </div>
            <div>
              <p className="font-extrabold text-on-surface text-sm">Bee Academy</p>
              <p className="text-xs text-on-surface-variant font-medium">Cổng Giáo Viên</p>
            </div>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-on-surface-variant">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.path
              || (item.path === '/teacher/reviews'
                && location.pathname.startsWith('/teacher/courses/')
                && location.pathname.endsWith('/reviews'));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
                {isActive && <div className="ml-auto w-2 h-2 bg-primary rounded-full" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-outline-variant/20">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors text-left"
          >
            <LogOut className="w-5 h-5" />
            Đăng xuất
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-16 bg-surface/90 backdrop-blur-md border-b border-outline-variant/30 flex items-center justify-between px-4 md:px-6 shadow-sm">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors"
            aria-label="Mở menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <h1 className="font-extrabold text-on-surface text-lg hidden lg:block">Đánh giá khóa học</h1>

          <div className="flex items-center gap-4 ml-auto">
            <TeacherNotificationBell />
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-on-surface leading-none">{user?.name ?? 'Giáo viên'}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">Giáo viên</p>
              </div>
              <img
                src={user?.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? 'GV')}&background=7c3aed&color=fff&bold=true&size=64`}
                alt="Avatar"
                className="w-9 h-9 rounded-full object-cover border-2 border-primary/30"
              />
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-primary">Cổng giáo viên</p>
                <h2 className="mt-1 text-2xl font-extrabold text-on-surface">Đánh giá khóa học</h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Theo dõi điểm sao và phản hồi của học sinh trên các khóa học của bạn.
                </p>
              </div>
              <button
                type="button"
                onClick={() => selectedCourseId ? loadReviews(selectedCourseId) : loadCourses()}
                disabled={loadingCourses || loadingReviews}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary shadow-md shadow-primary/20 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${loadingReviews ? 'animate-spin' : ''}`} />
                Làm mới
              </button>
            </div>

            <section className="mb-5 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(220px,0.7fr)_minmax(180px,0.5fr)]">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Khóa học</span>
                  <select
                    value={selectedCourseId}
                    onChange={event => handleCourseChange(event.target.value)}
                    disabled={loadingCourses || courses.length === 0}
                    className="w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface outline-none focus:border-primary disabled:opacity-60"
                  >
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>{course.title}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Tìm kiếm</span>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
                    <input
                      value={searchTerm}
                      onChange={event => setSearchTerm(event.target.value)}
                      placeholder="Học sinh, nội dung..."
                      className="w-full rounded-lg border border-outline-variant bg-surface-container py-2 pl-9 pr-9 text-sm text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-on-surface-variant hover:bg-surface"
                        aria-label="Xóa tìm kiếm"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Số sao</span>
                  <select
                    value={ratingFilter}
                    onChange={event => setRatingFilter(event.target.value as typeof ratingFilter)}
                    className="w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                  >
                    <option value="all">Tất cả</option>
                    <option value="5">5 sao</option>
                    <option value="4">4 sao</option>
                    <option value="3">3 sao</option>
                    <option value="2">2 sao</option>
                    <option value="1">1 sao</option>
                  </select>
                </label>
              </div>
            </section>

            {loadingCourses ? (
              <div className="flex justify-center py-24 text-on-surface-variant">
                <Loader2 className="h-9 w-9 animate-spin" />
              </div>
            ) : courses.length === 0 ? (
              <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest py-16 text-center shadow-sm">
                <BookOpen className="mx-auto mb-4 h-12 w-12 text-on-surface-variant/35" />
                <p className="font-semibold text-on-surface">Bạn chưa có khóa học nào.</p>
                <Link to="/teacher/courses" className="mt-3 inline-flex font-bold text-primary hover:underline">
                  Tạo hoặc kiểm tra khóa học
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-5 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Điểm trung bình</p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-3xl font-extrabold text-on-surface">{derivedAverageRating.toFixed(1)}</span>
                      <Stars rating={Math.round(derivedAverageRating)} />
                    </div>
                    <p className="mt-1 text-xs text-on-surface-variant">{selectedCourse?.title ?? 'Chưa chọn khóa học'}</p>
                  </div>
                  <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Tổng đánh giá</p>
                    <p className="mt-2 text-3xl font-extrabold text-on-surface">{derivedReviewCount}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">Tính theo tất cả học sinh đã review</p>
                  </div>
                  <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Đang hiển thị</p>
                    <p className="mt-2 text-3xl font-extrabold text-on-surface">{filteredReviews.length}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">Sau bộ lọc tìm kiếm và số sao</p>
                  </div>
                </div>

                <section className="rounded-2xl border border-outline-variant/40 bg-surface-container/20 p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 font-extrabold text-on-surface">
                      <MessageSquare className="h-5 w-5 text-primary" />
                      Phản hồi của học sinh
                    </h3>
                    {loadingReviews && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                  </div>

                  {!loadingReviews && filteredReviews.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-lowest py-12 text-center">
                      <Star className="mx-auto mb-3 h-10 w-10 text-on-surface-variant/35" />
                      <p className="font-semibold text-on-surface">Chưa có đánh giá nào phù hợp.</p>
                      <p className="mt-1 text-sm text-on-surface-variant">Thử đổi khóa học hoặc bộ lọc khác.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredReviews.map(renderReview)}
                    </div>
                  )}
                </section>
              </>
            )}
          </main>
        </div>
    </div>
  );
}

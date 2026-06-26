import { useState, useRef, useEffect } from 'react';
import {
  Bell, Search, ShoppingCart, X, BookOpen, TrendingUp, ChevronDown, LogOut, Loader2
} from 'lucide-react';
import DashboardSidebar from './DashboardSidebar';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import type { Course } from '../data/mockCourses';
import { inferGradeFromSearchQuery, searchCourses } from '../api/courseService';
import { adaptCourseSummary } from '../api/adapter';
import { getStudentLinkedParents, getStudentParentLinkInvitations } from '../api/studentParentLinkService';
import { listUserNotifications, markUserNotificationRead } from '../api/notificationService';
import type { StudentParentLinkInvitationResponse, UserNotification } from '../types/api';
// ─── Highlight từ khớp trong text ────────────────────────────────────────────

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-primary font-bold">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

// ─── Dropdown kết quả tìm kiếm ────────────────────────────────────────────────

interface SearchDropdownProps {
  query: string;
  results: Course[];
  loading: boolean;
  highlightedIdx: number;
  onSelect: (course: Course) => void;
  onViewAll: () => void;
}

function SearchDropdown({ query, results, loading, highlightedIdx, onSelect, onViewAll }: SearchDropdownProps) {
  const isEmpty = !loading && results.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className="absolute top-full left-0 right-0 mt-2 bg-surface border border-outline-variant/40 rounded-2xl shadow-2xl shadow-black/10 overflow-hidden z-50"
    >
      {loading ? (
        <div className="p-6 text-center">
          <Loader2 className="w-8 h-8 text-primary mx-auto mb-2 animate-spin" />
          <p className="text-on-surface-variant font-medium text-sm">Đang tìm khóa học...</p>
        </div>
      ) : isEmpty ? (
        <div className="p-6 text-center">
          <Search className="w-8 h-8 text-on-surface-variant/30 mx-auto mb-2" />
          <p className="text-on-surface-variant font-medium text-sm">
            Không tìm thấy kết quả cho <span className="text-on-surface font-bold">"{query}"</span>
          </p>
        </div>
      ) : (
        <>
          <div className="px-4 py-2.5 border-b border-outline-variant/20 flex items-center justify-between">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
              {results.length} kết quả
            </span>
            <TrendingUp className="w-3.5 h-3.5 text-on-surface-variant/50" />
          </div>

          <ul>
            {results.map((course, idx) => (
              <li key={course.id}>
                <button
                  onMouseDown={(e) => { e.preventDefault(); onSelect(course); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    idx === highlightedIdx
                      ? 'bg-primary/8 text-on-surface'
                      : 'hover:bg-surface-container text-on-surface'
                  }`}
                >
                  <img
                    src={course.image}
                    alt={course.title}
                    className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-tight line-clamp-1">
                      <HighlightedText text={course.title} query={query} />
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-medium">
                        {course.grade}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        {course.subject}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {course.isEnrolled ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 bg-green-500/10 px-2.5 py-1 rounded-full">
                        <BookOpen className="w-3 h-3" /> Đang học
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-primary">{course.price}</span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>

          <button
            onMouseDown={(e) => { e.preventDefault(); onViewAll(); }}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition-colors border-t border-outline-variant/20 ${
              highlightedIdx === results.length
                ? 'bg-primary text-on-primary'
                : 'text-primary hover:bg-primary/5'
            }`}
          >
            <Search className="w-4 h-4" />
            Xem tất cả kết quả cho &ldquo;{query}&rdquo;
          </button>
        </>
      )}
    </motion.div>
  );
}

// ─── Header chính ─────────────────────────────────────────────────────────────

function formatNotificationTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

function notificationTypeLabel(type: string) {
  switch (type) {
    case 'parent_teacher_reply':
      return 'Tin nhắn giáo viên';
    case 'parent_teacher_message':
      return 'Tin nhắn phụ huynh';
    case 'course_purchased':
      return 'Mua khóa học';
    case 'course_approved':
      return 'Duyệt khóa học';
    case 'course_rejected':
      return 'Từ chối khóa học';
    case 'course_revision_requested':
      return 'Yêu cầu chỉnh sửa';
    case 'system':
      return 'Hệ thống';
    default:
      return 'Thông báo';
  }
}

export default function DashboardHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const cartItems = useCartStore(state => state.items);
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);

  // ── State: Search ────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const [results, setResults] = useState<Course[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [pendingNotificationCount, setPendingNotificationCount] = useState(0);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [userNotifications, setUserNotifications] = useState<UserNotification[]>([]);
  const [studentInvitationNotifications, setStudentInvitationNotifications] = useState<StudentParentLinkInvitationResponse[]>([]);
  const [studentUnlinkNotifications, setStudentUnlinkNotifications] = useState<StudentParentLinkInvitationResponse[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  // ── State: Avatar dropdown menu ──────────────────────────────────────────
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Lọc kết quả tìm kiếm từ MOCK_COURSES
  // Click outside: đóng search dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setHighlightedIdx(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Click outside: đóng avatar dropdown (handler riêng biệt để không giao thoa với search)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setIsNotificationOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadHeaderNotifications(markGenericRead = false) {
    if (!user?.role) {
      setPendingNotificationCount(0);
      setUserNotifications([]);
      setStudentInvitationNotifications([]);
      setStudentUnlinkNotifications([]);
      return;
    }

    setNotificationLoading(true);
    try {
      const genericSummary = await listUserNotifications(false).catch(error => {
        console.error('Khong the tai thong bao nguoi dung:', error);
        return { unreadCount: 0, notifications: [] as UserNotification[] };
      });

      let nextNotifications = genericSummary.notifications;
      let genericUnreadCount = genericSummary.unreadCount;
      let studentActionCount = 0;

      if (user.role === 'student') {
        try {
          const [invitations, linkedParents] = await Promise.all([
            getStudentParentLinkInvitations(),
            getStudentLinkedParents(),
          ]);
          const unlinkRequests = linkedParents.filter(parent => parent.unlinkRequestedByRole === 'parent');
          setStudentInvitationNotifications(invitations);
          setStudentUnlinkNotifications(unlinkRequests);
          studentActionCount = invitations.length + unlinkRequests.length;
        } catch (error) {
          console.error('Khong the tai thong bao lien ket phu huynh:', error);
          setStudentInvitationNotifications([]);
          setStudentUnlinkNotifications([]);
        }
      } else {
        setStudentInvitationNotifications([]);
        setStudentUnlinkNotifications([]);
      }

      if (markGenericRead) {
        const unreadNotifications = nextNotifications.filter(notification => !notification.read);
        if (unreadNotifications.length > 0) {
          await Promise.allSettled(
            unreadNotifications.map(notification => markUserNotificationRead(notification.id))
          );
          nextNotifications = nextNotifications.map(notification => ({ ...notification, read: true }));
          genericUnreadCount = 0;
          window.dispatchEvent(new Event('bee:user-notifications-updated'));
        }
      }

      setUserNotifications(nextNotifications);
      setPendingNotificationCount(genericUnreadCount + studentActionCount);
    } finally {
      setNotificationLoading(false);
    }
  }

  useEffect(() => {
    loadHeaderNotifications();

    const reloadNotifications = () => loadHeaderNotifications();
    window.addEventListener('bee:user-notifications-updated', reloadNotifications);
    window.addEventListener('bee:student-parent-link-invitations-updated', reloadNotifications);
    window.addEventListener('focus', reloadNotifications);
    const intervalId = window.setInterval(reloadNotifications, 15000);

    return () => {
      window.removeEventListener('bee:user-notifications-updated', reloadNotifications);
      window.removeEventListener('bee:student-parent-link-invitations-updated', reloadNotifications);
      window.removeEventListener('focus', reloadNotifications);
      window.clearInterval(intervalId);
    };
  }, [user?.role, location.pathname]);

  useEffect(() => {
    setHighlightedIdx(-1);
  }, [searchQuery]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 1) {
      setResults([]);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);

    const timeoutId = window.setTimeout(() => {
      const inferredGrade = inferGradeFromSearchQuery(q);
      searchCourses({ q, grade: inferredGrade, size: inferredGrade == null ? 6 : 24 })
        .then(page => {
          if (!cancelled) {
            const courses = page.items.map(item => adaptCourseSummary(item));
            const gradeLabel = inferredGrade == null ? null : `Lớp ${inferredGrade}`;
            const filteredCourses = gradeLabel == null
              ? courses
              : courses.filter(course => course.grade === gradeLabel);
            setResults(filteredCourses.slice(0, 6));
          }
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const total = results.length + 1; // +1 cho "Xem tất cả"
    if (searchLoading && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
      e.preventDefault();
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIdx(i => (i + 1) % total);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIdx(i => (i - 1 + total) % total);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIdx >= 0 && highlightedIdx < results.length) {
          handleSelectCourse(results[highlightedIdx]);
        } else {
          handleViewAll();
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setHighlightedIdx(-1);
        inputRef.current?.blur();
        break;
    }
  }

  function handleSelectCourse(course: Course) {
    navigate(`/courses/${course.id}`);
    setSearchQuery('');
    setShowDropdown(false);
    setHighlightedIdx(-1);
  }

  function handleViewAll() {
    const q = searchQuery.trim();
    if (!q) return;

    const params = new URLSearchParams({ q });
    const inferredGrade = inferGradeFromSearchQuery(q);
    if (inferredGrade != null) {
      params.set('grade', String(inferredGrade));
    }

    navigate(`/courses?${params.toString()}`);
    setSearchQuery('');
    setShowDropdown(false);
    setHighlightedIdx(-1);
  }

  function handleLogout() {
    setIsMenuOpen(false);
    logout();
    navigate('/');
  }

  async function handleNotificationToggle() {
    const shouldOpen = !isNotificationOpen;
    setIsNotificationOpen(shouldOpen);
    if (shouldOpen) {
      await loadHeaderNotifications(true);
    }
  }

  async function handleNotificationSelect(notification: UserNotification) {
    if (!notification.read) {
      try {
        await markUserNotificationRead(notification.id);
      } catch (error) {
        console.error('Khong the danh dau thong bao da doc:', error);
      }
      setUserNotifications(items =>
        items.map(item => item.id === notification.id ? { ...item, read: true } : item)
      );
      setPendingNotificationCount(count => Math.max(0, count - 1));
      window.dispatchEvent(new Event('bee:user-notifications-updated'));
    }

    if (notification.targetUrl) {
      setIsNotificationOpen(false);
      navigate(notification.targetUrl);
    }
  }

  function handleStudentNotificationSelect() {
    setIsNotificationOpen(false);
    navigate('/notifications');
  }

  const isDropdownOpen = showDropdown && searchQuery.trim().length >= 1;
  const totalNotificationItems =
    userNotifications.length + studentInvitationNotifications.length + studentUnlinkNotifications.length;

  // Avatar URL: dùng user.avatar nếu có, fallback sang ui-avatars với tên user
  const avatarSrc = user?.avatar ??
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? 'User')}&background=ffdbd1&color=ad2c00&bold=true`;

  return (
    <header className="sticky top-0 z-50 bg-surface/90 backdrop-blur-md border-b border-outline-variant h-20 shadow-sm">
      <div className="flex justify-between items-center w-full px-4 md:px-10 max-w-[1600px] mx-auto h-full gap-6">

        {/* Logo */}
        <Link to="/courses" className="flex items-center gap-3 group flex-shrink-0">
          <div className="w-10 h-10 bg-primary text-on-primary rounded-xl flex items-center justify-center font-bold text-xl shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
            B
          </div>
          <span className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary hidden sm:block">
            Bee Academy
          </span>
        </Link>

        {/* Search bar với autocomplete */}
        <div ref={searchRef} className="hidden md:block flex-1 max-w-xl relative">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-on-surface-variant pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              onKeyDown={handleKeyDown}
              placeholder="Tìm kiếm khóa học, môn học, giảng viên..."
              className="w-full pl-11 pr-10 py-2.5 rounded-full bg-surface-container border border-outline-variant/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm placeholder:text-on-surface-variant/50"
            />
            <AnimatePresence>
              {searchQuery && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => { setSearchQuery(''); setShowDropdown(false); inputRef.current?.focus(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-container-high transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {isDropdownOpen && (
              <SearchDropdown
                query={searchQuery}
                results={results}
                loading={searchLoading}
                highlightedIdx={highlightedIdx}
                onSelect={handleSelectCourse}
                onViewAll={handleViewAll}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4 sm:gap-5 flex-shrink-0">

          {/* Notification Bell */}
          <div ref={notificationRef} className="relative">
            <button
              type="button"
              onClick={handleNotificationToggle}
              className="relative text-on-surface-variant hover:text-primary transition-colors"
              title="Thông báo"
              aria-label="Thông báo"
              aria-expanded={isNotificationOpen}
            >
              <Bell className="w-6 h-6" />
              <AnimatePresence>
                {pendingNotificationCount > 0 && (
                  <motion.span
                    key={pendingNotificationCount}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -top-2 -right-2 min-w-5 h-5 px-1 bg-red-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center border-2 border-surface"
                  >
                    {pendingNotificationCount > 9 ? '9+' : pendingNotificationCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>

            <AnimatePresence>
              {isNotificationOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-3 w-[min(92vw,390px)] max-h-[70vh] overflow-hidden bg-surface border border-outline-variant/40 rounded-2xl shadow-2xl shadow-black/15 z-50"
                >
                  <div className="px-4 py-3 border-b border-outline-variant/30 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-extrabold text-on-surface">Thông báo</p>
                      <p className="text-xs text-on-surface-variant">
                        {pendingNotificationCount > 0 ? `${pendingNotificationCount} thông báo mới` : 'Đã đọc tất cả'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => loadHeaderNotifications(true)}
                      className="text-xs font-bold text-primary hover:bg-primary/8 px-3 py-1.5 rounded-full transition-colors"
                    >
                      Làm mới
                    </button>
                  </div>

                  <div className="max-h-[56vh] overflow-y-auto py-2">
                  {notificationLoading && totalNotificationItems === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-on-surface-variant">
                      <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin text-primary" />
                      Đang tải thông báo...
                    </div>
                  ) : totalNotificationItems === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-on-surface-variant">
                      Chưa có thông báo
                    </div>
                  ) : (
                    <>
                      {studentInvitationNotifications.map(invitation => (
                        <button
                          key={`student-invitation-${invitation.parentId}`}
                          type="button"
                          onClick={handleStudentNotificationSelect}
                          className="w-full px-4 py-3 text-left hover:bg-surface-container transition-colors flex gap-3"
                        >
                          <span className="mt-1 w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-bold text-primary mb-1">Liên kết phụ huynh</span>
                            <span className="block text-sm font-bold text-on-surface line-clamp-1">
                              {invitation.parentName}
                            </span>
                            <span className="block text-sm text-on-surface-variant line-clamp-2">
                              Muốn liên kết tài khoản phụ huynh với bạn
                            </span>
                            <span className="block text-xs text-on-surface-variant/70 mt-1">
                              {formatNotificationTime(invitation.invitedAt)}
                            </span>
                          </span>
                        </button>
                      ))}

                      {studentUnlinkNotifications.map(invitation => (
                        <button
                          key={`student-unlink-${invitation.parentId}`}
                          type="button"
                          onClick={handleStudentNotificationSelect}
                          className="w-full px-4 py-3 text-left hover:bg-surface-container transition-colors flex gap-3"
                        >
                          <span className="mt-1 w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-bold text-primary mb-1">Hủy liên kết</span>
                            <span className="block text-sm font-bold text-on-surface line-clamp-1">
                              {invitation.parentName}
                            </span>
                            <span className="block text-sm text-on-surface-variant line-clamp-2">
                              Đã gửi yêu cầu hủy liên kết phụ huynh
                            </span>
                            <span className="block text-xs text-on-surface-variant/70 mt-1">
                              {formatNotificationTime(invitation.unlinkRequestedAt)}
                            </span>
                          </span>
                        </button>
                      ))}

                      {userNotifications.map(notification => (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() => handleNotificationSelect(notification)}
                          className="w-full px-4 py-3 text-left hover:bg-surface-container transition-colors flex gap-3"
                        >
                          <span
                            className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                              notification.read ? 'bg-outline-variant' : 'bg-red-500'
                            }`}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-bold text-primary mb-1">
                              {notificationTypeLabel(notification.type)}
                            </span>
                            <span className="block text-sm font-bold text-on-surface line-clamp-1">
                              {notification.title}
                            </span>
                            <span className="block text-sm text-on-surface-variant line-clamp-2">
                              {notification.body}
                            </span>
                            <span className="block text-xs text-on-surface-variant/70 mt-1">
                              {formatNotificationTime(notification.createdAt)}
                            </span>
                          </span>
                        </button>
                      ))}
                    </>
                  )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Shopping Cart với badge số lượng */}
          <Link to="/checkout" className="relative text-on-surface-variant hover:text-primary transition-colors">
            <ShoppingCart className="w-6 h-6" />
            <AnimatePresence>
              {cartItems.length > 0 && (
                <motion.span
                  key={cartItems.length}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-surface"
                >
                  {cartItems.length}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>

          {/* Nút Đăng xuất trực tiếp trên Header cho Phụ huynh */}
          {user?.role === 'parent' && (
            <button 
              onClick={handleLogout}
              className="text-on-surface-variant hover:text-red-500 transition-colors p-1.5 rounded-xl hover:bg-surface-container flex items-center justify-center"
              title="Đăng xuất"
            >
              <LogOut className="w-5.5 h-5.5" />
            </button>
          )}

          {/* ── Avatar + Dropdown Menu ─────────────────────────────────────
              menuRef bao toàn bộ vùng trigger + dropdown để click-outside hoạt động đúng
          ─────────────────────────────────────────────────────────────────── */}
          <div ref={menuRef} className="relative">

            {/* Trigger: avatar + tên + chevron */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-3 group"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-on-surface leading-tight">{user?.name}</p>
                <p className="text-xs text-on-surface-variant truncate max-w-[140px]">{user?.email}</p>
              </div>
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/30 group-hover:border-primary transition-colors flex-shrink-0">
                <img
                  alt={user?.name ?? 'User'}
                  src={avatarSrc}
                  className="w-full h-full object-cover"
                />
              </div>
              <ChevronDown className={`w-4 h-4 text-on-surface-variant transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* ── Panel DashboardSidebar dùng như dropdown ─────────────────
                floating=true   → không sticky, shadow đậm
                onClose         → đóng panel khi user chọn một mục
                onLogout        → hiện nút Đăng xuất ở cuối panel
            ─────────────────────────────────────────────────────────── */}
            <AnimatePresence>
              {isMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-3 z-50"
                >
                  <DashboardSidebar
                    floating
                    onClose={() => setIsMenuOpen(false)}
                    onLogout={handleLogout}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>
    </header>
  );
}

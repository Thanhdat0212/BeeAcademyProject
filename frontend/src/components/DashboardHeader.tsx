import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Bell, Search, ShoppingCart, X, BookOpen, TrendingUp, ChevronDown, LogOut
} from 'lucide-react';
import DashboardSidebar from './DashboardSidebar';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { MOCK_COURSES, Course } from '../data/mockCourses';
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
  highlightedIdx: number;
  onSelect: (course: Course) => void;
  onViewAll: () => void;
}

function SearchDropdown({ query, results, highlightedIdx, onSelect, onViewAll }: SearchDropdownProps) {
  const isEmpty = results.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className="absolute top-full left-0 right-0 mt-2 bg-surface border border-outline-variant/40 rounded-2xl shadow-2xl shadow-black/10 overflow-hidden z-50"
    >
      {isEmpty ? (
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

export default function DashboardHeader() {
  const navigate = useNavigate();
  const cartItems = useCartStore(state => state.items);
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);

  // ── State: Search ────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── State: Avatar dropdown menu ──────────────────────────────────────────
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Lọc kết quả tìm kiếm từ MOCK_COURSES
  const results = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 1) return [];
    return MOCK_COURSES.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.subject.toLowerCase().includes(q) ||
      c.instructor.toLowerCase().includes(q) ||
      c.grade.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [searchQuery]);

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
    setHighlightedIdx(-1);
  }, [searchQuery]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const total = results.length + 1; // +1 cho "Xem tất cả"
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
    if (!searchQuery.trim()) return;
    navigate(`/courses?q=${encodeURIComponent(searchQuery.trim())}`);
    setSearchQuery('');
    setShowDropdown(false);
    setHighlightedIdx(-1);
  }

  function handleLogout() {
    setIsMenuOpen(false);
    logout();
    navigate('/');
  }

  const isDropdownOpen = showDropdown && searchQuery.trim().length >= 1;

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
          <button className="relative text-on-surface-variant hover:text-primary transition-colors">
            <Bell className="w-6 h-6" />
            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-surface" />
          </button>

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

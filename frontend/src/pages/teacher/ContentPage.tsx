/**
 * TeacherContentPage — Trang "Bài giảng" cho Giáo viên (UC28)
 *
 * Cấu trúc 3 cấp:
 *   Khóa học → Chương → Bài giảng
 *
 * Luồng chính:
 *  1. GV chọn khóa học (dropdown ở trên)
 *  2. Bên trái: cây Chương → Bài giảng (accordion). Mỗi chương có nút "+ Thêm bài"
 *  3. Click "Sửa" trên bài giảng → form mở ở panel bên phải
 *  4. Click "+ Thêm bài" trên chương → form mở ở dạng tạo mới
 *  5. Trong form GV nhập: Tên, Mô tả ngắn, Thứ tự + đính kèm Video / PDF / Slide
 *  6. Nhấn "Lưu" → cập nhật vào state (mock); nhấn "Hủy" → đóng form
 *
 * Lưu ý: file upload hiện CHỈ lưu tên file vào state (mock).
 * Khi tích hợp backend sẽ POST multipart/form-data lên Cloudinary / API.
 */

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import {
  LayoutDashboard, BookOpen, FileText, HelpCircle,
  Bell, LogOut, Menu, X, Plus, Pencil, Trash2,
  PenSquare, Landmark, BarChart2, ClipboardList,
  GraduationCap, ChevronDown, ChevronRight, Save,
  Upload, Link2, Video, FileImage, Presentation,
  Youtube, Megaphone,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 1 — TYPES
// ═══════════════════════════════════════════════════════════════════

// Một bài giảng đầy đủ theo UC28
interface Lesson {
  id: string;
  title: string;
  description: string;     // Mô tả ngắn (1-2 câu)
  order: number;           // Thứ tự bài học trong chương

  // Video: có 2 dạng — upload file MP4 HOẶC link nhúng YouTube/Vimeo
  // videoSource cho biết đang dùng nguồn nào, tránh nhầm lẫn ở backend
  videoSource: 'upload' | 'embed' | 'none';
  videoFileName?: string;  // Khi videoSource = 'upload'
  videoEmbedUrl?: string;  // Khi videoSource = 'embed' (YouTube/Vimeo URL)

  // Tài liệu đính kèm — lưu tên file (mock).
  // Backend sẽ trả Cloudinary URL.
  pdfFileName?: string;
  slideFileName?: string;
}

interface Chapter {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

interface CourseWithContent {
  id: string;
  title: string;
  chapters: Chapter[];
}

// State của form: null = đóng, 'new' = đang tạo mới, string = đang sửa lesson có id đó
type EditingState =
  | { mode: 'closed' }
  | { mode: 'new'; chapterId: string }
  | { mode: 'edit'; chapterId: string; lessonId: string };

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 2 — MOCK DATA
// ═══════════════════════════════════════════════════════════════════
// 2 khóa học demo, mỗi khóa 2-3 chương, mỗi chương 1-3 bài giảng
const INITIAL_CONTENT: CourseWithContent[] = [
  {
    id: 'c1',
    title: 'Toán Đại Số - Lớp 8',
    chapters: [
      {
        id: 'ch1', title: 'Chương 1: Hằng đẳng thức đáng nhớ', order: 1,
        lessons: [
          { id: 'l1', title: 'Bình phương của một tổng', description: 'Khai triển (a+b)² và ứng dụng', order: 1, videoSource: 'upload', videoFileName: 'binh-phuong-tong.mp4', pdfFileName: 'tai-lieu-c1b1.pdf' },
          { id: 'l2', title: 'Hiệu hai bình phương',     description: 'Công thức a² - b² và bài tập áp dụng', order: 2, videoSource: 'embed',  videoEmbedUrl: 'https://www.youtube.com/watch?v=abc123', slideFileName: 'slide-c1b2.pptx' },
        ],
      },
      {
        id: 'ch2', title: 'Chương 2: Phân tích đa thức thành nhân tử', order: 2,
        lessons: [
          { id: 'l3', title: 'Phương pháp đặt nhân tử chung', description: 'Kỹ thuật cơ bản nhất', order: 1, videoSource: 'none' },
        ],
      },
    ],
  },
  {
    id: 'c2',
    title: 'Vật Lý - Lớp 9',
    chapters: [
      {
        id: 'ch3', title: 'Chương 1: Điện học', order: 1,
        lessons: [
          { id: 'l4', title: 'Định luật Ohm', description: 'Mối quan hệ U = I × R', order: 1, videoSource: 'upload', videoFileName: 'ohm.mp4' },
        ],
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 3 — NAVIGATION ITEMS (đồng bộ với DashboardTeacher)
// ═══════════════════════════════════════════════════════════════════
const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Tổng quan',         path: '/teacher',          },
  { icon: BookOpen,        label: 'Khóa học của tôi',  path: '/teacher/courses',  },
  { icon: FileText,        label: 'Bài giảng',          path: '/teacher/content',  },
  { icon: PenSquare,       label: 'Quiz chương',        path: '/teacher/quiz',     },
  { icon: GraduationCap,   label: 'Bài kiểm tra',       path: '/teacher/exam',     },
  { icon: ClipboardList,   label: 'Chấm điểm',          path: '/teacher/grades',   },
  { icon: HelpCircle,      label: 'Hỏi & Đáp',          path: '/teacher/qa',       },
  { icon: Megaphone,       label: 'Khiếu nại',          path: '/teacher/complaints',},
  { icon: BarChart2,       label: 'Doanh thu',          path: '/teacher/revenue',  },
  { icon: Landmark,        label: 'TK ngân hàng',       path: '/teacher/bank',     },
];

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 4 — SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════

/**
 * FileSlot — Upload zone tái sử dụng cho PDF / Slide
 * Props:
 *   - label: nhãn hiển thị (vd "Tài liệu PDF")
 *   - icon: icon Lucide
 *   - accept: MIME types cho file input (vd ".pdf")
 *   - fileName: tên file hiện tại (nếu đã có)
 *   - onSelect: callback khi user chọn file mới
 *   - onRemove: callback khi xóa file
 *
 * Tại sao tách component: PDF và Slide có UI giống nhau → tránh duplicate.
 * Video không dùng component này vì có thêm option "embed URL".
 */
interface FileSlotProps {
  label: string;
  icon: React.ReactNode;
  accept: string;
  fileName?: string;
  onSelect: (fileName: string) => void;
  onRemove: () => void;
}
function FileSlot({ label, icon, accept, fileName, onSelect, onRemove }: FileSlotProps) {
  // useRef để trigger click input file ẩn từ button styled
  // Cách này thông dụng vì <input type="file"> mặc định xấu và khó style
  const inputRef = useRef<HTMLInputElement>(null);

  // Handler khi user chọn file: chỉ lấy tên (mock).
  // Backend thật sẽ FormData.append('file', e.target.files[0]) rồi POST.
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onSelect(file.name);
      // Reset value để có thể chọn lại cùng 1 file lần nữa (browser cache)
      e.target.value = '';
    }
  }

  return (
    <div className="border-2 border-dashed border-outline-variant rounded-xl p-4 hover:border-primary/50 transition-colors">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-primary">{icon}</span>
        <span className="font-bold text-on-surface text-sm">{label}</span>
      </div>

      {fileName ? (
        // Đã có file → hiển thị tên + nút xóa
        <div className="flex items-center justify-between gap-2 bg-surface-container rounded-lg px-3 py-2">
          <span className="text-sm text-on-surface truncate flex-1">{fileName}</span>
          <button
            onClick={onRemove}
            title="Xóa file"
            className="p-1 text-red-500 hover:bg-red-500/10 rounded-md transition-colors flex-shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ) : (
        // Chưa có file → nút chọn file
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-on-surface-variant hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
        >
          <Upload className="w-4 h-4" />
          Chọn file...
        </button>
      )}

      {/* Input file ẩn — trigger qua ref */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}

/**
 * VideoSlot — Upload zone cho VIDEO với 2 tab:
 *   - Tab 1: Upload MP4 (giống FileSlot)
 *   - Tab 2: Nhúng URL YouTube/Vimeo
 *
 * Tách riêng khỏi FileSlot vì logic phức tạp hơn (có state tab, có URL input)
 */
interface VideoSlotProps {
  source: Lesson['videoSource'];
  fileName?: string;
  embedUrl?: string;
  onChange: (data: { source: Lesson['videoSource']; fileName?: string; embedUrl?: string }) => void;
}
function VideoSlot({ source, fileName, embedUrl, onChange }: VideoSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Tab hiện tại — derived từ source, nhưng cho phép user chuyển tab trước khi nhập
  // Khởi tạo: nếu source là 'embed' thì tab 'embed', còn lại thì 'upload'
  const [tab, setTab] = useState<'upload' | 'embed'>(source === 'embed' ? 'embed' : 'upload');

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      // Cập nhật state cha: chuyển sang source='upload', xóa embedUrl
      onChange({ source: 'upload', fileName: file.name, embedUrl: undefined });
      e.target.value = '';
    }
  }

  function handleEmbedChange(e: React.ChangeEvent<HTMLInputElement>) {
    const url = e.target.value;
    // Nếu rỗng → coi như chưa có video; nếu có URL → source='embed'
    onChange({
      source: url ? 'embed' : 'none',
      fileName: undefined,
      embedUrl: url || undefined,
    });
  }

  function handleRemoveUpload() {
    onChange({ source: 'none', fileName: undefined, embedUrl: undefined });
  }

  return (
    <div className="border-2 border-dashed border-outline-variant rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <Video className="w-5 h-5 text-primary" />
        <span className="font-bold text-on-surface text-sm">Video bài giảng</span>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-surface-container rounded-lg p-1 mb-3">
        <button
          onClick={() => setTab('upload')}
          className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 text-xs font-bold rounded-md transition-colors ${
            tab === 'upload' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
          }`}
        >
          <Upload className="w-3.5 h-3.5" /> Upload MP4
        </button>
        <button
          onClick={() => setTab('embed')}
          className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 text-xs font-bold rounded-md transition-colors ${
            tab === 'embed' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
          }`}
        >
          <Youtube className="w-3.5 h-3.5" /> YouTube / Vimeo
        </button>
      </div>

      {/* Nội dung tab */}
      {tab === 'upload' ? (
        <>
          {source === 'upload' && fileName ? (
            <div className="flex items-center justify-between gap-2 bg-surface-container rounded-lg px-3 py-2">
              <span className="text-sm text-on-surface truncate flex-1">{fileName}</span>
              <button
                onClick={handleRemoveUpload}
                title="Xóa video"
                className="p-1 text-red-500 hover:bg-red-500/10 rounded-md transition-colors flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-on-surface-variant hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4" />
              Chọn video MP4...
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4"
            onChange={handleFileChange}
            className="hidden"
          />
        </>
      ) : (
        // Tab embed: input URL
        <div className="relative">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input
            type="url"
            value={source === 'embed' ? (embedUrl ?? '') : ''}
            onChange={handleEmbedChange}
            placeholder="https://www.youtube.com/watch?v=... hoặc https://vimeo.com/..."
            className="w-full pl-10 pr-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant"
          />
          <p className="text-xs text-on-surface-variant mt-2">
            Dán link YouTube hoặc Vimeo công khai. Hệ thống sẽ nhúng video tự động.
          </p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 5 — MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function TeacherContentPage() {
  // ── State ───────────────────────────────────────────────────────
  const [content, setContent] = useState<CourseWithContent[]>(INITIAL_CONTENT);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(INITIAL_CONTENT[0].id);

  // Tập các chapterId đang được mở rộng (Set để toggle nhanh).
  // Mặc định mở chương đầu của khóa đầu để UX dễ hiểu ngay khi vào
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
    new Set([INITIAL_CONTENT[0].chapters[0]?.id].filter(Boolean) as string[])
  );

  // Editing state: đang đóng / tạo mới / sửa lesson cụ thể
  const [editing, setEditing] = useState<EditingState>({ mode: 'closed' });

  // Form data — local state riêng để user có thể "Hủy" mà không ảnh hưởng store
  // Khi mở form thì copy data từ lesson hiện tại vào đây; khi "Lưu" thì commit lại
  const [form, setForm] = useState<Lesson>(emptyLesson());

  // Sidebar mobile toggle
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);

  // ── Derived state ──────────────────────────────────────────────
  // Lấy khóa học hiện tại từ content theo selectedCourseId
  const currentCourse = content.find(c => c.id === selectedCourseId);

  // ── Helpers ─────────────────────────────────────────────────────

  // Tạo Lesson rỗng để khởi tạo form khi "Thêm mới"
  function emptyLesson(): Lesson {
    return {
      id: `tmp-${Date.now()}`, // ID tạm, backend sẽ gán ID thật khi save
      title: '',
      description: '',
      order: 1,
      videoSource: 'none',
    };
  }

  // Toggle chương: nếu đang mở thì đóng, đang đóng thì mở
  function toggleChapter(chapterId: string) {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  }

  // ── Handler: bắt đầu thêm bài giảng mới vào 1 chương ──────────
  function startAddLesson(chapterId: string) {
    // Tự tính order kế tiếp = số lessons hiện có + 1
    // để GV không phải tự nhập, nhưng vẫn cho phép sửa nếu muốn
    const chapter = currentCourse?.chapters.find(ch => ch.id === chapterId);
    const nextOrder = (chapter?.lessons.length ?? 0) + 1;

    setForm({ ...emptyLesson(), order: nextOrder });
    setEditing({ mode: 'new', chapterId });
  }

  // ── Handler: bắt đầu sửa bài giảng có sẵn ──────────────────────
  function startEditLesson(chapterId: string, lesson: Lesson) {
    // Copy toàn bộ data vào form. Spread để form độc lập với state gốc
    setForm({ ...lesson });
    setEditing({ mode: 'edit', chapterId, lessonId: lesson.id });
  }

  // ── Handler: hủy chỉnh sửa, đóng form ──────────────────────────
  function cancelEdit() {
    setEditing({ mode: 'closed' });
    // Không cần reset form vì lần mở sau sẽ overwrite
  }

  // ── Handler: lưu bài giảng (commit form về state) ──────────────
  function saveLesson() {
    // Validate cơ bản
    if (!form.title.trim()) {
      notify.error('Vui lòng nhập tên bài giảng');
      return;
    }
    if (form.order < 1) {
      notify.error('Thứ tự bài học phải >= 1');
      return;
    }
    if (editing.mode === 'closed') return; // Không thể xảy ra, nhưng để TS biết

    const chapterId = editing.chapterId;

    // Update content: tìm course → tìm chapter → thêm hoặc thay lesson
    // Dùng map để giữ immutability (không mutate state)
    setContent(prev => prev.map(course => {
      if (course.id !== selectedCourseId) return course;

      return {
        ...course,
        chapters: course.chapters.map(chapter => {
          if (chapter.id !== chapterId) return chapter;

          if (editing.mode === 'new') {
            // Thêm mới: gán id thật rồi push vào lessons
            const newLesson: Lesson = { ...form, id: `l-${Date.now()}` };
            return { ...chapter, lessons: [...chapter.lessons, newLesson] };
          } else {
            // Sửa: thay thế lesson có id khớp
            return {
              ...chapter,
              lessons: chapter.lessons.map(l => l.id === editing.lessonId ? form : l),
            };
          }
        }),
      };
    }));

    notify.success(editing.mode === 'new' ? 'Đã thêm bài giảng' : 'Đã cập nhật bài giảng');
    setEditing({ mode: 'closed' });
  }

  // ── Handler: xóa bài giảng ─────────────────────────────────────
  function deleteLesson(chapterId: string, lessonId: string, lessonTitle: string) {
    const ok = window.confirm(`Xóa bài giảng "${lessonTitle}"?`);
    if (!ok) return;

    setContent(prev => prev.map(course => {
      if (course.id !== selectedCourseId) return course;
      return {
        ...course,
        chapters: course.chapters.map(chapter => {
          if (chapter.id !== chapterId) return chapter;
          return { ...chapter, lessons: chapter.lessons.filter(l => l.id !== lessonId) };
        }),
      };
    }));

    // Nếu đang edit bài này mà bị xóa → đóng form
    if (editing.mode === 'edit' && editing.lessonId === lessonId) {
      setEditing({ mode: 'closed' });
    }
    notify.success('Đã xóa bài giảng');
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  // ═════════════════════════════════════════════════════════════════
  //  RENDER
  // ═════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-surface flex font-sans">

      {/* Overlay che màn hình khi sidebar mở trên mobile */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* ── SIDEBAR ─────────────────────────────────────────────── */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64
        bg-surface-container-lowest border-r border-outline-variant/30
        flex flex-col transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:flex
      `}>
        <div className="p-6 flex items-center justify-between border-b border-outline-variant/20">
          <Link to="/teacher" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary text-on-primary rounded-xl flex items-center justify-center font-extrabold text-lg shadow-md shadow-primary/20">B</div>
            <div>
              <p className="font-extrabold text-on-surface text-sm">Bee Academy</p>
              <p className="text-xs text-on-surface-variant font-medium">Cổng Giáo Viên</p>
            </div>
          </Link>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 text-on-surface-variant">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                  isActive ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
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

      {/* ── MAIN AREA ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="sticky top-0 z-20 h-16 bg-surface/90 backdrop-blur-md border-b border-outline-variant/30 flex items-center justify-between px-4 md:px-6 shadow-sm">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-extrabold text-on-surface text-lg hidden lg:block">Bài giảng</h1>
          <div className="flex items-center gap-4 ml-auto">
            <button className="relative text-on-surface-variant hover:text-primary transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <img
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? 'Giao Vien')}&background=7c3aed&color=fff&bold=true&size=64`}
              alt="Teacher avatar"
              className="w-9 h-9 rounded-full border-2 border-primary/30"
            />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">

          {/* ── BƯỚC 1: Chọn khóa học ──────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <h2 className="text-2xl font-extrabold text-on-surface mb-1">Cập nhật bài giảng</h2>
            <p className="text-on-surface-variant text-sm mb-4">
              Chọn khóa học → mở chương → thêm hoặc sửa bài giảng
            </p>

            <label className="block">
              <span className="text-sm font-bold text-on-surface mb-2 block">Chọn khóa học</span>
              <select
                value={selectedCourseId}
                onChange={e => {
                  // Đổi khóa: reset editing + mở chương đầu của khóa mới cho UX nhất quán
                  const newId = e.target.value;
                  setSelectedCourseId(newId);
                  setEditing({ mode: 'closed' });
                  const firstChapter = content.find(c => c.id === newId)?.chapters[0];
                  setExpandedChapters(firstChapter ? new Set([firstChapter.id]) : new Set());
                }}
                className="w-full max-w-md px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-on-surface font-semibold"
              >
                {content.map(course => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
            </label>
          </motion.div>

          {/* ── BƯỚC 2 & 3: Cây chương + Form bài giảng ──────── */}
          {/* Grid 2 cột: trái cây chương, phải form. Mobile: stack vertically */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* PANEL TRÁI — Cây Chương → Bài giảng */}
            <motion.div
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 shadow-sm h-fit"
            >
              <h3 className="font-extrabold text-on-surface mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                Cấu trúc khóa học
              </h3>

              {!currentCourse || currentCourse.chapters.length === 0 ? (
                <p className="text-sm text-on-surface-variant text-center py-8">
                  Khóa học chưa có chương nào
                </p>
              ) : (
                <div className="space-y-2">
                  {currentCourse.chapters.map(chapter => {
                    const isExpanded = expandedChapters.has(chapter.id);
                    return (
                      <div key={chapter.id} className="border border-outline-variant/30 rounded-xl overflow-hidden">

                        {/* Chapter header — click để toggle */}
                        <button
                          onClick={() => toggleChapter(chapter.id)}
                          className="w-full flex items-center gap-2 px-3 py-2.5 bg-surface-container/50 hover:bg-surface-container transition-colors text-left"
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 flex-shrink-0" />}
                          <span className="font-bold text-sm text-on-surface flex-1 line-clamp-1">{chapter.title}</span>
                          <span className="text-xs text-on-surface-variant flex-shrink-0">{chapter.lessons.length} bài</span>
                        </button>

                        {/* Lessons + Add button — chỉ render khi expanded */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="p-2 space-y-1">
                                {chapter.lessons.map(lesson => {
                                  // Highlight bài đang sửa
                                  const isEditing =
                                    editing.mode === 'edit' && editing.lessonId === lesson.id;
                                  return (
                                    <div
                                      key={lesson.id}
                                      className={`flex items-center gap-2 px-2 py-2 rounded-lg group ${
                                        isEditing ? 'bg-primary/10' : 'hover:bg-surface-container/50'
                                      }`}
                                    >
                                      <span className="text-xs font-mono text-on-surface-variant flex-shrink-0 w-5 text-right">
                                        {lesson.order}.
                                      </span>
                                      <span className={`text-sm flex-1 line-clamp-1 ${isEditing ? 'text-primary font-bold' : 'text-on-surface'}`}>
                                        {lesson.title}
                                      </span>
                                      <button
                                        onClick={() => startEditLesson(chapter.id, lesson)}
                                        title="Sửa"
                                        className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => deleteLesson(chapter.id, lesson.id, lesson.title)}
                                        title="Xóa"
                                        className="p-1.5 text-red-500 hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  );
                                })}
                                {/* Nút thêm bài mới vào chương này */}
                                <button
                                  onClick={() => startAddLesson(chapter.id)}
                                  className="w-full flex items-center justify-center gap-2 mt-1 px-2 py-2 text-sm font-bold text-primary hover:bg-primary/5 rounded-lg transition-colors"
                                >
                                  <Plus className="w-4 h-4" />
                                  Thêm bài giảng
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* PANEL PHẢI — Form chỉnh sửa bài giảng */}
            <motion.div
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-3 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-5 shadow-sm"
            >
              {editing.mode === 'closed' ? (
                // Khi form đóng → hiển thị hướng dẫn
                <div className="text-center py-16">
                  <FileText className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
                  <p className="text-on-surface-variant">
                    Chọn một bài giảng để chỉnh sửa,<br />
                    hoặc nhấn <span className="font-bold text-primary">+ Thêm bài giảng</span> trong chương ở bên trái.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-extrabold text-on-surface text-lg">
                      {editing.mode === 'new' ? 'Thêm bài giảng mới' : 'Chỉnh sửa bài giảng'}
                    </h3>
                  </div>

                  <div className="space-y-4">

                    {/* Tên bài giảng (required) */}
                    <label className="block">
                      <span className="text-sm font-bold text-on-surface mb-1.5 block">
                        Tên bài giảng <span className="text-red-500">*</span>
                      </span>
                      <input
                        type="text"
                        value={form.title}
                        onChange={e => setForm({ ...form, title: e.target.value })}
                        placeholder="VD: Bình phương của một tổng"
                        className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant"
                      />
                    </label>

                    {/* Mô tả ngắn */}
                    <label className="block">
                      <span className="text-sm font-bold text-on-surface mb-1.5 block">Mô tả ngắn</span>
                      <textarea
                        value={form.description}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                        placeholder="Tóm tắt nội dung bài giảng trong 1-2 câu"
                        rows={2}
                        className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant resize-none"
                      />
                    </label>

                    {/* Thứ tự bài học */}
                    <label className="block max-w-[160px]">
                      <span className="text-sm font-bold text-on-surface mb-1.5 block">Thứ tự bài học</span>
                      <input
                        type="number"
                        min={1}
                        value={form.order}
                        onChange={e => setForm({ ...form, order: parseInt(e.target.value) || 1 })}
                        className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                      />
                    </label>

                    {/* ── Khu vực đính kèm tài liệu ─────────────── */}
                    <div className="pt-4 border-t border-outline-variant/30">
                      <p className="text-sm font-bold text-on-surface mb-3">Đính kèm tài liệu</p>
                      <div className="space-y-3">

                        {/* Video — có 2 tab upload / embed */}
                        <VideoSlot
                          source={form.videoSource}
                          fileName={form.videoFileName}
                          embedUrl={form.videoEmbedUrl}
                          onChange={data => setForm({ ...form, ...data })}
                        />

                        {/* PDF */}
                        <FileSlot
                          label="Tài liệu PDF"
                          icon={<FileImage className="w-5 h-5" />}
                          accept=".pdf"
                          fileName={form.pdfFileName}
                          onSelect={name => setForm({ ...form, pdfFileName: name })}
                          onRemove={() => setForm({ ...form, pdfFileName: undefined })}
                        />

                        {/* Slide */}
                        <FileSlot
                          label="Slide bài giảng"
                          icon={<Presentation className="w-5 h-5" />}
                          accept=".pptx,.ppt,.key,.pdf"
                          fileName={form.slideFileName}
                          onSelect={name => setForm({ ...form, slideFileName: name })}
                          onRemove={() => setForm({ ...form, slideFileName: undefined })}
                        />
                      </div>
                    </div>

                    {/* Nút hành động */}
                    <div className="flex items-center justify-end gap-2 pt-4 border-t border-outline-variant/30">
                      <button
                        onClick={cancelEdit}
                        className="px-5 py-2.5 text-sm font-bold text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={saveLesson}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
                      >
                        <Save className="w-4 h-4" />
                        Lưu bài giảng
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </div>

        </main>
      </div>
    </div>
  );
}

/**
 * TeacherCoursesPage — Trang "Khóa học của tôi" cho Giáo viên (UC27)
 *
 * Kết nối API thật qua teacherCourseService:
 *  - Load danh sách qua listMyCourses()
 *  - Nộp duyệt qua submitForReview(courseId)
 *
 * Badge status đầy đủ 6 trạng thái theo UseCase v6.5:
 *   draft, pending_review, approved, rejected, needs_revision, published
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { isApiError } from '../../api/client';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import * as teacherCourseService from '../../api/teacherCourseService';
import type { TeacherCourseResponse, CreateCourseRequest } from '../../api/teacherCourseService';
import { listCategories } from '../../api/courseService';
import type { Category } from '../../types/api';
import {
  LayoutDashboard, BookOpen, FileText, HelpCircle,
  Bell, LogOut, Menu, X, Plus, Pencil, Trash2,
  PenSquare, Landmark, BarChart2, ClipboardList,
  GraduationCap, CheckCircle2, Clock, AlertTriangle,
  Megaphone, Database, Send, RefreshCcw, Eye, Save, Loader2, ChevronDown,
  Upload, Image as ImageIcon, MessageSquare, UserCircle, Lock,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
//  NAVIGATION (đồng bộ toàn teacher portal)
// ═══════════════════════════════════════════════════════════════════

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Tổng quan',         path: '/teacher'           },
  { icon: BookOpen,        label: 'Khóa học của tôi',  path: '/teacher/courses'   },
  { icon: FileText,        label: 'Bài giảng',          path: '/teacher/content'   },
  { icon: PenSquare,       label: 'Quiz chương',        path: '/teacher/quiz'      },
  { icon: Database,        label: 'Ngân hàng câu hỏi',  path: '/teacher/questions' },
  { icon: GraduationCap,   label: 'Bài kiểm tra',       path: '/teacher/exam'      },
  { icon: ClipboardList,   label: 'Chấm điểm',          path: '/teacher/grades'    },
  { icon: HelpCircle,      label: 'Hỏi & Đáp',          path: '/teacher/qa'        },
  { icon: Megaphone,       label: 'Khiếu nại',          path: '/teacher/complaints'},
  { icon: BarChart2,       label: 'Doanh thu',          path: '/teacher/revenue'   },
  { icon: Landmark,        label: 'TK ngân hàng',       path: '/teacher/bank'      },
  { icon: UserCircle,      label: 'Hồ sơ',              path: '/teacher/profile'   },
  { icon: Lock,            label: 'Tài khoản',           path: '/teacher/account'   },
];

// ═══════════════════════════════════════════════════════════════════
//  STATUS BADGE — 6 trạng thái đầy đủ từ API
// ═══════════════════════════════════════════════════════════════════

type CourseStatus = TeacherCourseResponse['status'];

function StatusBadge({ status }: { status: CourseStatus }) {
  // Ánh xạ status → { icon, label, class } theo ngữ nghĩa:
  //   draft          → xám   (chưa submit)
  //   pending_review → vàng  (đang chờ Admin xem)
  //   approved       → xanh  (Admin OK, chưa publish)
  //   rejected       → đỏ   (Admin từ chối)
  //   needs_revision → cam   (Admin yêu cầu sửa)
  //   published      → xanh đậm (đang live, HS mua được)
  const config: Record<CourseStatus, { icon: React.ReactNode; label: string; className: string }> = {
    draft: {
      icon: <FileText className="w-3.5 h-3.5" />,
      label: 'Bản nháp',
      className: 'bg-slate-500/10 text-slate-500',
    },
    pending_review: {
      icon: <Clock className="w-3.5 h-3.5" />,
      label: 'Chờ duyệt',
      className: 'bg-amber-500/10 text-amber-600',
    },
    approved: {
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      label: 'Đã duyệt',
      className: 'bg-green-500/10 text-green-600',
    },
    rejected: {
      icon: <X className="w-3.5 h-3.5" />,
      label: 'Bị từ chối',
      className: 'bg-red-500/10 text-red-600',
    },
    needs_revision: {
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      label: 'Cần chỉnh sửa',
      className: 'bg-orange-500/10 text-orange-600',
    },
    published: {
      icon: <Eye className="w-3.5 h-3.5" />,
      label: 'Đã xuất bản',
      className: 'bg-emerald-600/10 text-emerald-700',
    },
  };

  const { icon, label, className } = config[status] ?? config.draft;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${className}`}>
      {icon}{label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════

function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

// Các status cho phép nộp duyệt lại
const SUBMITTABLE: CourseStatus[] = ['draft', 'rejected', 'needs_revision'];

// Spinner nhỏ dùng cho loading row
function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  COURSE FORM PANEL (tạo mới + sửa)
// ═══════════════════════════════════════════════════════════════════

interface CourseForm {
  title: string;
  description: string;
  thumbnailUrl: string;
  categoryId: string;
  grades: number[];
  priceVnd: string;
  salePriceVnd: string;
}

const EMPTY_FORM: CourseForm = {
  title: '', description: '', thumbnailUrl: '', categoryId: '',
  grades: [], priceVnd: '', salePriceVnd: '',
};

const ALL_GRADES = [6, 7, 8, 9];
const ALLOWED_THUMBNAIL_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_THUMBNAIL_SIZE_BYTES = 5 * 1024 * 1024;

interface CourseFormPanelProps {
  open: boolean;
  editing: TeacherCourseResponse | null;
  categories: Category[];
  onClose: () => void;
  onSaved: (course: TeacherCourseResponse) => void;
}

function CourseFormPanel({ open, editing, categories, onClose, onSaved }: CourseFormPanelProps) {
  const [form, setForm] = useState<CourseForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState('');
  const [thumbnailInputKey, setThumbnailInputKey] = useState(0);

  useEffect(() => {
    if (!thumbnailFile) {
      setThumbnailPreviewUrl('');
      return;
    }

    const objectUrl = URL.createObjectURL(thumbnailFile);
    setThumbnailPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [thumbnailFile]);

  useEffect(() => {
    if (!open) return;
    setThumbnailFile(null);
    setThumbnailInputKey(k => k + 1);
    if (editing) {
      // TeacherCourseResponse đã có categoryId → set form ngay không cần đợi API
      setForm({
        title:        editing.title,
        description:  '',
        thumbnailUrl: editing.thumbnailUrl ?? '',
        categoryId:   editing.categoryId ?? '',
        grades:       editing.grades ?? [],
        priceVnd:     editing.priceVnd.toString(),
        salePriceVnd: editing.salePriceVnd?.toString() ?? '',
      });

      // Gọi thêm chỉ để lấy description (không có trong list response).
      // Dùng cờ isMounted để tránh setForm sau khi panel đã đóng/unmount.
      // Không dùng useState vì setState không ngăn được double-invoke trong StrictMode —
      // useRef ghi nhận ngay, không qua render cycle.
      let isMounted = true;
      teacherCourseService.getCourseDetail(editing.id).then(d => {
        if (isMounted) setForm(f => ({
          ...f,
          description: d.description ?? '',
          thumbnailUrl: d.thumbnailUrl ?? editing.thumbnailUrl ?? '',
        }));
      }).catch(() => {});
      return () => { isMounted = false; };
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, editing]);

  function toggleGrade(g: number) {
    setForm(f => ({
      ...f,
      grades: f.grades.includes(g) ? f.grades.filter(x => x !== g) : [...f.grades, g],
    }));
  }

  function handleThumbnailChange(file: File | undefined) {
    if (!file) return;
    if (!ALLOWED_THUMBNAIL_TYPES.includes(file.type)) {
      notify.error('Chỉ chấp nhận ảnh JPEG, PNG hoặc WEBP');
      setThumbnailInputKey(k => k + 1);
      return;
    }
    if (file.size > MAX_THUMBNAIL_SIZE_BYTES) {
      notify.error('Ảnh bìa không được vượt quá 5MB');
      setThumbnailInputKey(k => k + 1);
      return;
    }
    setThumbnailFile(file);
  }

  function cancelThumbnailSelection() {
    setThumbnailFile(null);
    setThumbnailInputKey(k => k + 1);
  }

  async function handleSave() {
    if (!form.title.trim())    { notify.error('Vui lòng nhập tiêu đề'); return; }
    if (!form.categoryId)      { notify.error('Vui lòng chọn môn học'); return; }
    if (form.grades.length === 0) { notify.error('Vui lòng chọn ít nhất 1 lớp'); return; }
    if (!form.priceVnd || Number(form.priceVnd) < 1000) {
      notify.error('Giá tối thiểu 1,000 VND'); return;
    }
    // FIX: validate giá khuyến mãi phải nhỏ hơn giá gốc (trước đây không có check này)
    if (form.salePriceVnd) {
      const saleNum  = Number(form.salePriceVnd);
      const priceNum = Number(form.priceVnd);
      if (saleNum < 1000) { notify.error('Giá khuyến mãi tối thiểu 1,000 VND'); return; }
      if (saleNum >= priceNum) {
        notify.error('Giá khuyến mãi phải nhỏ hơn giá gốc'); return;
      }
    }

    setSaving(true);
    try {
      let thumbnailUrl = form.thumbnailUrl.trim() || undefined;
      if (thumbnailFile) {
        const uploaded = await teacherCourseService.uploadCourseThumbnail(thumbnailFile);
        if (!uploaded.publicUrl) {
          throw new Error('Upload ảnh bìa không trả về URL');
        }
        thumbnailUrl = uploaded.publicUrl;
      }

      const req: CreateCourseRequest = {
        title:       form.title.trim(),
        description: form.description.trim() || undefined,
        thumbnailUrl,
        categoryId:  form.categoryId,
        grades:      form.grades,
        priceVnd:    Number(form.priceVnd),
        salePriceVnd: form.salePriceVnd ? Number(form.salePriceVnd) : undefined,
      };

      let saved: TeacherCourseResponse;
      if (editing) {
        saved = await teacherCourseService.updateCourse(editing.id, req);
        notify.success('Đã cập nhật khóa học');
      } else {
        saved = await teacherCourseService.createCourse(req);
        notify.success('Đã tạo khóa học mới');
      }
      onSaved(saved);
      onClose();
    } catch (err: unknown) {
      // FIX: hiển thị lý do thật từ backend thay vì message chung chung
      const msg = err instanceof Error ? err.message : 'Không lưu được khóa học';
      notify.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40"
            onClick={onClose}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <motion.aside
            key="panel"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-surface flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30 flex-shrink-0">
              <h2 className="font-extrabold text-on-surface text-lg">
                {editing ? 'Chỉnh sửa khóa học' : 'Tạo khóa học mới'}
              </h2>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-container text-on-surface-variant">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* Tiêu đề */}
              <div>
                <label className="block text-sm font-bold text-on-surface mb-1.5">
                  Tiêu đề <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="VD: Toán Đại Số Lớp 8 — Từ Cơ Bản Đến Nâng Cao"
                  className="w-full px-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              {/* Mô tả */}
              <div>
                <label className="block text-sm font-bold text-on-surface mb-1.5">Mô tả</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={4}
                  placeholder="Nội dung khóa học, đối tượng học sinh, mục tiêu..."
                  className="w-full px-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Ảnh bìa */}
              <div>
                <label className="block text-sm font-bold text-on-surface mb-1.5">Ảnh bìa khóa học</label>
                <label className="flex items-center justify-center gap-2 w-full px-3 py-3 text-sm font-bold bg-surface-container border border-dashed border-outline-variant rounded-xl text-on-surface-variant hover:border-primary hover:text-primary cursor-pointer transition-colors">
                  <Upload className="w-4 h-4" />
                  {thumbnailFile ? thumbnailFile.name : 'Chọn ảnh từ máy'}
                  <input
                    key={thumbnailInputKey}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={e => handleThumbnailChange(e.target.files?.[0])}
                    className="hidden"
                  />
                </label>
                <p className="mt-1.5 text-xs text-on-surface-variant">
                  JPEG, PNG hoặc WEBP — tối đa 5MB.
                </p>
                {thumbnailFile && (
                  <button
                    type="button"
                    onClick={cancelThumbnailSelection}
                    className="mt-2 text-xs font-bold text-primary hover:underline"
                  >
                    Hủy chọn ảnh
                  </button>
                )}
                <input
                  type="hidden"
                  value={form.thumbnailUrl}
                  readOnly
                />
                {(thumbnailPreviewUrl || form.thumbnailUrl.trim()) && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container">
                    <img
                      src={thumbnailPreviewUrl || form.thumbnailUrl.trim()}
                      alt="Xem trước ảnh bìa"
                      className="w-full h-36 object-cover"
                      onError={e => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                {!thumbnailPreviewUrl && !form.thumbnailUrl.trim() && (
                  <div className="mt-3 h-28 rounded-xl border border-outline-variant/30 bg-surface-container/60 flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-on-surface-variant/40" />
                  </div>
                )}
              </div>

              {/* Môn học */}
              <div>
                <label className="block text-sm font-bold text-on-surface mb-1.5">
                  Môn học <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={form.categoryId}
                    onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
                    className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="">-- Chọn môn học --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
                </div>
              </div>

              {/* Lớp */}
              <div>
                <label className="block text-sm font-bold text-on-surface mb-2">
                  Dành cho lớp <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  {ALL_GRADES.map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGrade(g)}
                      className={`flex-1 py-2 text-sm font-bold rounded-xl border-2 transition-all ${
                        form.grades.includes(g)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-outline-variant text-on-surface-variant hover:border-primary/40'
                      }`}
                    >
                      Lớp {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Giá */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1.5">
                    Giá gốc (VND) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    value={form.priceVnd}
                    onChange={e => setForm(f => ({ ...f, priceVnd: e.target.value }))}
                    placeholder="VD: 299000"
                    className="w-full px-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary"
                  />
                  {form.priceVnd && Number(form.priceVnd) >= 1000 && (
                    <p className="text-xs text-on-surface-variant mt-1">{formatVnd(Number(form.priceVnd))}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1.5">Giá khuyến mãi</label>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    value={form.salePriceVnd}
                    onChange={e => setForm(f => ({ ...f, salePriceVnd: e.target.value }))}
                    placeholder="Để trống = không KM"
                    className="w-full px-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary"
                  />
                  {form.salePriceVnd && Number(form.salePriceVnd) >= 1000 && (
                    <p className="text-xs text-on-surface-variant mt-1">{formatVnd(Number(form.salePriceVnd))}</p>
                  )}
                </div>
              </div>

              {!editing && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                  Khóa học được tạo ở trạng thái <strong>Bản nháp</strong>. Sau khi thêm nội dung, bạn có thể nộp Admin duyệt.
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-outline-variant/30 flex gap-3 flex-shrink-0">
              <button onClick={onClose}
                className="flex-1 py-2.5 text-sm font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 text-sm font-bold bg-primary text-on-primary rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Đang lưu...' : (editing ? 'Cập nhật' : 'Tạo khóa học')}
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function TeacherCoursesPage() {
  // ── State ───────────────────────────────────────────────────────
  const [courses,     setCourses]     = useState<TeacherCourseResponse[]>([]);
  // totalCourses: tổng số khóa học từ BE (bao gồm những khóa ngoài fetch limit 50).
  // Hiển thị cảnh báo nếu GV có >50 khóa học mà không thấy đủ.
  const [totalCourses, setTotalCourses] = useState(0);
  const [categories,  setCategories]  = useState<Category[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Form panel state
  const [formOpen,   setFormOpen]   = useState(false);
  const [editingCourse, setEditingCourse] = useState<TeacherCourseResponse | null>(null);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<TeacherCourseResponse | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);

  // Giới hạn fetch một lần — nếu GV có nhiều hơn thì hiện cảnh báo.
  const COURSE_FETCH_LIMIT = 50;

  // ── Load danh sách khóa học ────────────────────────────────────
  // Gọi API thật, không dùng mock data.
  async function loadCourses() {
    setLoading(true);
    try {
      const pageResult = await teacherCourseService.listMyCourses(0, COURSE_FETCH_LIMIT);
      setCourses(pageResult.items);
      // Lưu totalItems để phát hiện trường hợp GV có >50 khóa học bị cắt ngầm
      setTotalCourses(pageResult.totalItems);
    } catch {
      // apiClient interceptor đã toast lỗi network/5xx; bắt thêm để set loading=false
      notify.error('Không tải được danh sách khóa học');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCourses();
    listCategories().then(setCategories).catch(() => {});
  }, []);

  // ── Handler: Tạo / Sửa khóa học ───────────────────────────────
  function handleCreate() {
    setEditingCourse(null);
    setFormOpen(true);
  }

  function handleEdit(course: TeacherCourseResponse) {
    setEditingCourse(course);
    setFormOpen(true);
  }

  function handleOpenDiscussion(courseId: string) {
    navigate(`/teacher/qa?tab=common&courseId=${encodeURIComponent(courseId)}`);
  }

  function handleFormSaved(saved: TeacherCourseResponse) {
    setCourses(prev => {
      const exists = prev.find(c => c.id === saved.id);
      return exists
        ? prev.map(c => c.id === saved.id ? saved : c)
        : [saved, ...prev];
    });
  }

  // ── Handler: Xóa khóa học ──────────────────────────────────────
  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await teacherCourseService.deleteCourse(deleteTarget.id);
      setCourses(prev => prev.filter(c => c.id !== deleteTarget.id));
      notify.success(`Đã xóa "${deleteTarget.title}"`);
      setDeleteTarget(null);
    } catch {
      notify.error('Không xóa được khóa học');
    } finally {
      setDeleting(false);
    }
  }

  // ── Handler: Nộp duyệt ─────────────────────────────────────────
  // Chỉ khả dụng với status draft | rejected | needs_revision.
  // Sau khi nộp thành công, cập nhật status ngay trên UI (optimistic update).
  async function handleSubmit(courseId: string, courseTitle: string) {
    if (submittingId) return;
    setSubmittingId(courseId);
    try {
      const updated = await teacherCourseService.submitForReview(courseId);
      setCourses(prev => prev.map(c => c.id === updated.id ? updated : c));
      notify.success(`Đã nộp "${courseTitle}" để Admin duyệt`);
    } catch (err: unknown) {
      // apiClient interceptor đã bóc message từ body vào err.message (ApiError extends Error).
      // isApiError() kiểm tra có phải lỗi từ backend không (có .code và .status).
      // Ví dụ backend trả: "Khóa học phải có ít nhất 1 chương trước khi nộp duyệt"
      notify.error(isApiError(err) ? err.message : `Không thể nộp duyệt "${courseTitle}"`);
    } finally {
      setSubmittingId(null);
    }
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

      {/* Overlay che sidebar khi mở trên mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ─────────────────────────────────────────────── */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64
        bg-surface-container-lowest border-r border-outline-variant/30
        flex flex-col transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:flex
      `}>
        {/* Logo */}
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
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 text-on-surface-variant">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
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

        {/* Banner nhắc nhập TK ngân hàng (UC45 — bắt buộc trước khi nhận CK) */}
        <div className="mx-4 mb-3 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
          <p className="text-xs font-bold text-amber-600 mb-1">Chưa nhập TK ngân hàng</p>
          <p className="text-xs text-amber-600/80">Bắt buộc để Admin chuyển tiền cuối kỳ</p>
          <Link to="/teacher/bank" className="mt-2 block text-xs font-bold text-amber-600 hover:underline">
            Nhập ngay →
          </Link>
        </div>

        {/* Đăng xuất */}
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

      {/* ── MAIN CONTENT ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="sticky top-0 z-20 h-16 bg-surface/90 backdrop-blur-md border-b border-outline-variant/30 flex items-center justify-between px-4 md:px-6 shadow-sm">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <h1 className="font-extrabold text-on-surface text-lg hidden lg:block">Khóa học của tôi</h1>

          <div className="flex items-center gap-4 ml-auto">
            <button className="relative text-on-surface-variant hover:text-primary transition-colors">
              <Bell className="w-5 h-5" />
            </button>
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

          {/* Tiêu đề + nút tạo mới */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start justify-between gap-4 mb-6 flex-wrap"
          >
            <div>
              <h2 className="text-2xl font-extrabold text-on-surface">Khóa học của tôi</h2>
              {!loading && (
                <p className="text-on-surface-variant mt-1">
                  Tổng số: <span className="font-bold text-on-surface">{courses.length}</span> khóa học
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Nút refresh để load lại dữ liệu */}
              <button
                onClick={loadCourses}
                disabled={loading}
                className="p-2.5 text-on-surface-variant hover:text-primary hover:bg-primary/5 rounded-xl transition-colors"
                title="Làm mới danh sách"
              >
                <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={handleCreate}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
              >
                <Plus className="w-5 h-5" />
                Tạo khóa học mới
              </button>
            </div>
          </motion.div>

          {/* Loading state — spinner toàn bảng */}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 gap-4"
            >
              <svg className="animate-spin w-10 h-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <p className="text-on-surface-variant font-medium">Đang tải danh sách khóa học...</p>
            </motion.div>
          )}

          {/* Cảnh báo khi GV có >50 khóa học — phần còn lại bị cắt ngầm */}
          {!loading && totalCourses > COURSE_FETCH_LIMIT && (
            <div className="mb-4 flex items-start gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-sm text-amber-700">
              <span className="font-bold whitespace-nowrap">⚠ Lưu ý:</span>
              <span>
                Bạn có <strong>{totalCourses}</strong> khóa học nhưng chỉ hiển thị{' '}
                <strong>{COURSE_FETCH_LIMIT}</strong> khóa gần nhất.
                Hãy liên hệ Admin nếu cần xem toàn bộ danh sách.
              </span>
            </div>
          )}

          {/* Bảng khóa học */}
          {!loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl overflow-hidden shadow-sm"
            >
              {courses.length === 0 ? (
                /* Empty state */
                <div className="py-20 text-center">
                  <BookOpen className="w-14 h-14 text-on-surface-variant/30 mx-auto mb-4" />
                  <p className="text-on-surface-variant font-medium text-lg">Bạn chưa có khóa học nào</p>
                  <p className="text-on-surface-variant/70 text-sm mt-1 mb-5">
                    Tạo khóa học đầu tiên và nộp Admin duyệt để bắt đầu giảng dạy
                  </p>
                  <button
                    onClick={handleCreate}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
                  >
                    <Plus className="w-4 h-4" />
                    Tạo khóa học đầu tiên
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-outline-variant/20 bg-surface-container/50">
                        <th className="text-left px-6 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Ảnh bìa</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Tên khóa học</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden md:table-cell">Danh mục</th>
                        <th className="text-right px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden sm:table-cell">Giá bán</th>
                        <th className="text-center px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden lg:table-cell">Chương / Bài</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide hidden lg:table-cell">Ngày tạo</th>
                        <th className="text-left px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Trạng thái</th>
                        <th className="text-center px-4 py-3 font-bold text-on-surface-variant text-xs uppercase tracking-wide">Thao tác</th>
                      </tr>
                    </thead>

                    <tbody>
                      <AnimatePresence>
                        {courses.map((course, idx) => {
                          // Chỉ draft | rejected | needs_revision mới cho nộp duyệt
                          const canSubmit = SUBMITTABLE.includes(course.status);
                          // Chỉ draft | needs_revision mới cho xóa (không xóa khi đang pending hoặc published)
                          const canDelete = course.status === 'draft';
                          const isSubmitting = submittingId === course.id;

                          return (
                            <motion.tr
                              key={course.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, x: -40, transition: { duration: 0.2 } }}
                              transition={{ delay: idx * 0.04 }}
                              className={`border-b border-outline-variant/10 hover:bg-surface-container/30 transition-colors ${
                                idx % 2 !== 0 ? 'bg-surface-container/15' : ''
                              }`}
                            >
                              {/* Ảnh bìa */}
                              <td className="px-6 py-3">
                                {course.thumbnailUrl ? (
                                  <img
                                    src={course.thumbnailUrl}
                                    alt={course.title}
                                    className="w-16 h-12 rounded-lg object-cover border border-outline-variant/30"
                                  />
                                ) : (
                                  <div className="w-16 h-12 rounded-lg bg-surface-container border border-outline-variant/30 flex items-center justify-center">
                                    <BookOpen className="w-6 h-6 text-on-surface-variant/40" />
                                  </div>
                                )}
                              </td>

                              {/* Tên */}
                              <td className="px-4 py-3 max-w-[260px]">
                                <p className="font-semibold text-on-surface line-clamp-2">{course.title}</p>
                                {course.grades.length > 0 && (
                                  <p className="text-xs text-on-surface-variant mt-0.5">
                                    Lớp {course.grades.join(', ')}
                                  </p>
                                )}
                              </td>

                              {/* Danh mục */}
                              <td className="px-4 py-3 hidden md:table-cell">
                                <span className="inline-block text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-full">
                                  {course.categoryName ?? '—'}
                                </span>
                              </td>

                              {/* Giá */}
                              <td className="px-4 py-3 text-right font-bold text-on-surface hidden sm:table-cell whitespace-nowrap">
                                {course.salePriceVnd != null ? (
                                  <div>
                                    <span className="text-red-500">{formatVnd(course.salePriceVnd)}</span>
                                    <span className="block text-xs text-on-surface-variant line-through font-normal">
                                      {formatVnd(course.priceVnd)}
                                    </span>
                                  </div>
                                ) : (
                                  formatVnd(course.priceVnd)
                                )}
                              </td>

                              {/* Chương / Bài */}
                              <td className="px-4 py-3 text-center text-on-surface-variant hidden lg:table-cell">
                                <span className="font-medium text-on-surface">{course.totalChapters}</span> chương
                                {' / '}
                                <span className="font-medium text-on-surface">{course.totalLessons}</span> bài
                              </td>

                              {/* Ngày tạo */}
                              <td className="px-4 py-3 text-on-surface-variant hidden lg:table-cell whitespace-nowrap">
                                {formatDate(course.createdAt)}
                              </td>

                              {/* Trạng thái */}
                              <td className="px-4 py-3">
                                <StatusBadge status={course.status} />
                              </td>

                              {/* Thao tác */}
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-center gap-1">
                                  {/* Nộp duyệt — chỉ khi status cho phép */}
                                  {canSubmit && (
                                    <button
                                      onClick={() => handleSubmit(course.id, course.title)}
                                      disabled={!!submittingId}
                                      title="Nộp duyệt"
                                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {isSubmitting ? <Spinner /> : <Send className="w-3.5 h-3.5" />}
                                      <span className="hidden sm:inline">Nộp duyệt</span>
                                    </button>
                                  )}

                                  {/* Chỉnh sửa */}
                                  <button
                                    onClick={() => handleEdit(course)}
                                    title="Chỉnh sửa"
                                    className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>

                                  <button
                                    onClick={() => handleOpenDiscussion(course.id)}
                                    title="Q&A chung"
                                    className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                  >
                                    <MessageSquare className="w-4 h-4" />
                                  </button>

                                  {/* Xóa — chỉ khi draft */}
                                  {canDelete ? (
                                    <button
                                      onClick={() => setDeleteTarget(course)}
                                      title="Xóa"
                                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  ) : (
                                    <div className="w-8 h-8" aria-hidden="true" />
                                  )}
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {/* Ghi chú workflow */}
          {!loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-5 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl"
            >
              <p className="text-sm text-on-surface-variant leading-relaxed">
                <span className="font-bold text-blue-600">Quy trình:</span>{' '}
                Tạo khóa học →{' '}
                <Link to="/teacher/content" className="font-semibold text-blue-600 underline underline-offset-2">Thêm chương & bài giảng</Link>
                {' '}→ Nộp duyệt → Admin xem xét → Duyệt hoặc Yêu cầu sửa.{' '}
                <span className="font-bold text-on-surface">Phải có ít nhất 1 chương và 1 bài giảng</span> trước khi nộp.
                {' '}Khóa học đã duyệt <span className="font-bold text-on-surface">không thể xóa</span> — liên hệ Admin qua Khiếu nại.
              </p>
            </motion.div>
          )}

        </main>
      </div>

      {/* Form tạo / sửa khóa học */}
      <CourseFormPanel
        open={formOpen}
        editing={editingCourse}
        categories={categories}
        onClose={() => setFormOpen(false)}
        onSaved={handleFormSaved}
      />

      {/* Confirm xóa */}
      <AnimatePresence>
        {deleteTarget && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50"
              onClick={() => !deleting && setDeleteTarget(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm"
            >
              <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-center font-extrabold text-on-surface mb-2">Xóa khóa học?</h3>
              <p className="text-center text-sm text-on-surface-variant mb-5">
                "{deleteTarget.title}"
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="flex-1 py-2.5 text-sm font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded-xl disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {deleting ? 'Đang xóa...' : 'Xóa'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

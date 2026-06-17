/**
 * TeacherContentPage — UC28 — Bài giảng
 * Kết nối API thật: chapter CRUD + lesson CRUD + video/doc upload.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import * as svc from '../../api/teacherCourseService';
import type {
  TeacherCourseResponse,
  TeacherChapterResponse,
  TeacherLessonResponse,
} from '../../api/teacherCourseService';
import {
  LayoutDashboard, BookOpen, FileText, HelpCircle,
  Bell, LogOut, Menu, X, Plus, Pencil, Trash2,
  PenSquare, Landmark, BarChart2, ClipboardList,
  GraduationCap, ChevronDown, ChevronRight, Save,
  Upload, Link2, Video, FileImage, Presentation,
  Youtube, Megaphone, Database, Loader2, CheckCircle2, AlertTriangle,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════════

interface LessonFormData {
  title: string;
  description: string;
  position: number;
  isFree: boolean;
  videoSource: 'upload' | 'embed' | 'none';
  videoEmbedUrl: string;
  videoStoragePath: string;
}

interface ChapterFormData {
  title: string;
  description: string;
  position: number;
}

type LessonEditingState =
  | { mode: 'closed' }
  | { mode: 'new'; chapterId: string }
  | { mode: 'edit'; chapterId: string; lessonId: string };

type ChapterEditingState =
  | { mode: 'closed' }
  | { mode: 'new' }
  | { mode: 'edit'; chapterId: string };

// ═══════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════

function emptyLessonForm(position = 1): LessonFormData {
  return {
    title: '', description: '', position, isFree: false,
    videoSource: 'none', videoEmbedUrl: '', videoStoragePath: '',
  };
}

function emptyChapterForm(position = 1): ChapterFormData {
  return { title: '', description: '', position };
}

function lessonToForm(l: TeacherLessonResponse): LessonFormData {
  return {
    title: l.title,
    description: l.description ?? '',
    position: l.position,
    isFree: l.isFree,
    videoSource: l.videoEmbedUrl ? 'embed' : (l.videoStoragePath ? 'upload' : 'none'),
    videoEmbedUrl: l.videoEmbedUrl ?? '',
    videoStoragePath: l.videoStoragePath ?? '',
  };
}

function sortLessons(lessons: TeacherLessonResponse[]): TeacherLessonResponse[] {
  return [...lessons].sort((a, b) => a.position - b.position);
}

function sortChapters(chapters: TeacherChapterResponse[]): TeacherChapterResponse[] {
  return [...chapters]
    .map(chapter => ({
      ...chapter,
      lessons: sortLessons(chapter.lessons),
    }))
    .sort((a, b) => a.position - b.position);
}

// ═══════════════════════════════════════════════════════════════════
//  NAV
// ═══════════════════════════════════════════════════════════════════

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Tổng quan',        path: '/teacher'           },
  { icon: BookOpen,        label: 'Khóa học của tôi', path: '/teacher/courses'   },
  { icon: FileText,        label: 'Bài giảng',         path: '/teacher/content'   },
  { icon: PenSquare,       label: 'Quiz chương',       path: '/teacher/quiz'      },
  { icon: Database,        label: 'Ngân hàng câu hỏi', path: '/teacher/questions' },
  { icon: GraduationCap,   label: 'Bài kiểm tra',      path: '/teacher/exam'      },
  { icon: ClipboardList,   label: 'Chấm điểm',         path: '/teacher/grades'    },
  { icon: HelpCircle,      label: 'Hỏi & Đáp',         path: '/teacher/qa'        },
  { icon: Megaphone,       label: 'Khiếu nại',         path: '/teacher/complaints'},
  { icon: BarChart2,       label: 'Doanh thu',         path: '/teacher/revenue'   },
  { icon: Landmark,        label: 'TK ngân hàng',      path: '/teacher/bank'      },
];

// ═══════════════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════

interface FileSlotProps {
  label: string;
  icon: React.ReactNode;
  accept: string;
  existingName?: string;
  file: File | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
}
function FileSlot({ label, icon, accept, existingName, file, onSelect, onRemove }: FileSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const displayName = file?.name ?? existingName;

  return (
    <div className="border-2 border-dashed border-outline-variant rounded-xl p-4 hover:border-primary/50 transition-colors">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-primary">{icon}</span>
        <span className="font-bold text-on-surface text-sm">{label}</span>
      </div>

      {displayName ? (
        <div className="flex items-center justify-between gap-2 bg-surface-container rounded-lg px-3 py-2">
          {!file && existingName && (
            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
          )}
          <span className="text-sm text-on-surface truncate flex-1">{displayName}</span>
          <button
            onClick={onRemove}
            title="Xóa file"
            className="p-1 text-red-500 hover:bg-red-500/10 rounded-md transition-colors flex-shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-on-surface-variant hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
          >
            <Upload className="w-4 h-4" />
            Chọn file...
          </button>
          {/* FIX: hiển thị giới hạn file size tài liệu */}
          <p className="text-xs text-on-surface-variant text-center">
            PDF, PPTX, DOCX · Tối đa <strong>50 MB</strong>
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) {
            // FIX: check file size tại client (50MB cho tài liệu)
            if (f.size > 50 * 1024 * 1024) {
              alert('File tài liệu vượt quá giới hạn 50 MB. Vui lòng chọn file nhỏ hơn.');
              e.target.value = '';
              return;
            }
            onSelect(f);
            e.target.value = '';
          }
        }}
        className="hidden"
      />
    </div>
  );
}

interface VideoSlotProps {
  videoSource: LessonFormData['videoSource'];
  videoEmbedUrl: string;
  videoStoragePath: string;
  videoFile: File | null;
  onEmbedChange: (url: string) => void;
  onFileSelect: (file: File) => void;
  onRemoveFile: () => void;
  uploadProgress: number;
}
function VideoSlot({
  videoSource, videoEmbedUrl, videoStoragePath, videoFile,
  onEmbedChange, onFileSelect, onRemoveFile, uploadProgress,
}: VideoSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'upload' | 'embed'>(videoSource === 'embed' ? 'embed' : 'upload');

  const hasExistingUpload = videoSource === 'upload' && !!videoStoragePath;
  const displayFileName = videoFile?.name ?? (hasExistingUpload ? '(Video đã tải lên)' : undefined);

  return (
    <div className="border-2 border-dashed border-outline-variant rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <Video className="w-5 h-5 text-primary" />
        <span className="font-bold text-on-surface text-sm">Video bài giảng</span>
      </div>

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

      {tab === 'upload' ? (
        <>
          {displayFileName ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 bg-surface-container rounded-lg px-3 py-2">
                {hasExistingUpload && !videoFile && (
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                )}
                <span className="text-sm text-on-surface truncate flex-1">{displayFileName}</span>
                <button
                  onClick={onRemoveFile}
                  title="Xóa video"
                  className="p-1 text-red-500 hover:bg-red-500/10 rounded-md transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="space-y-1">
                  <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-on-surface-variant text-right">{uploadProgress}%</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <button
                onClick={() => inputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-on-surface-variant hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
              >
                <Upload className="w-4 h-4" />
                Chọn video MP4...
              </button>
              {/* FIX: hiển thị giới hạn file size để GV biết trước khi chọn */}
              <p className="text-xs text-on-surface-variant text-center">
                Chấp nhận MP4, WebM, MOV · Tối đa <strong>500 MB</strong>
              </p>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) {
                // FIX: check file size ngay tại client trước khi upload
                if (f.size > 500 * 1024 * 1024) {
                  alert('File video vượt quá giới hạn 500 MB. Vui lòng chọn file nhỏ hơn.');
                  e.target.value = '';
                  return;
                }
                onFileSelect(f);
                e.target.value = '';
              }
            }}
            className="hidden"
          />
        </>
      ) : (
        <div className="space-y-2">
          {/* FIX: cảnh báo khi GV đã upload video nhưng chuyển sang embed
              — file video cũ trên server sẽ trở thành orphan (không bị xóa tự động) */}
          {hasExistingUpload && (
            <div className="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Bạn đã có video đã tải lên. Thay bằng YouTube/Vimeo sẽ <strong>không xóa</strong> file cũ khỏi server.
              </p>
            </div>
          )}
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input
              type="url"
              value={videoEmbedUrl}
              onChange={e => onEmbedChange(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... hoặc https://vimeo.com/..."
              className="w-full pl-10 pr-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant"
            />
          </div>
          <p className="text-xs text-on-surface-variant">
            Dán link YouTube hoặc Vimeo công khai. Hệ thống sẽ nhúng video tự động.
          </p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function TeacherContentPage() {
  const [courses, setCourses] = useState<TeacherCourseResponse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [chapters, setChapters] = useState<TeacherChapterResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Lesson form state
  const [lessonEditing, setLessonEditing] = useState<LessonEditingState>({ mode: 'closed' });
  const [lessonForm, setLessonForm] = useState<LessonFormData>(emptyLessonForm());
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [slideFile, setSlideFile] = useState<File | null>(null);

  // Chapter form state
  const [chapterEditing, setChapterEditing] = useState<ChapterEditingState>({ mode: 'closed' });
  const [chapterForm, setChapterForm] = useState<ChapterFormData>(emptyChapterForm());

  // FIX: state cho confirm xóa inline (thay window.confirm blocking cũ)
  // null = không hiển thị confirm; có giá trị = đang hỏi xác nhận xóa target đó
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'lesson' | 'chapter';
    id: string;
    chapterId?: string;   // chỉ có khi type='lesson'
    title: string;
  } | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore(s => s.logout);
  const user = useAuthStore(s => s.user);

  // Load course list
  useEffect(() => {
    svc.listMyCourses(0, 50)
      .then(page => {
        setCourses(page.items);
        if (page.items.length > 0) setSelectedCourseId(page.items[0].id);
      })
      .catch(() => notify.error('Không thể tải danh sách khóa học'))
      .finally(() => setLoading(false));
  }, []);

  // Load course detail when selection changes
  useEffect(() => {
    if (!selectedCourseId) return;
    setLoadingDetail(true);
    setLessonEditing({ mode: 'closed' });
    setChapterEditing({ mode: 'closed' });
    svc.getCourseDetail(selectedCourseId)
      .then(detail => {
        const sortedChapters = sortChapters(detail.chapters);
        setChapters(sortedChapters);
        const first = sortedChapters[0];
        setExpandedChapters(first ? new Set([first.id]) : new Set());
      })
      .catch(() => notify.error('Không thể tải nội dung khóa học'))
      .finally(() => setLoadingDetail(false));
  }, [selectedCourseId]);

  function toggleChapter(id: string) {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function clearFiles() {
    setVideoFile(null); setPdfFile(null); setSlideFile(null);
  }

  // ── Lesson handlers ──────────────────────────────────────────────

  function startAddLesson(chapterId: string) {
    const chapter = chapters.find(c => c.id === chapterId);
    setLessonForm(emptyLessonForm((chapter?.lessons.length ?? 0) + 1));
    clearFiles();
    setLessonEditing({ mode: 'new', chapterId });
    setChapterEditing({ mode: 'closed' });
  }

  function startEditLesson(chapterId: string, lesson: TeacherLessonResponse) {
    setLessonForm(lessonToForm(lesson));
    clearFiles();
    setLessonEditing({ mode: 'edit', chapterId, lessonId: lesson.id });
    setChapterEditing({ mode: 'closed' });
  }

  function cancelLessonEdit() {
    // FIX: reset form về empty khi cancel — tránh dữ liệu cũ còn sót lại lần mở tiếp theo
    setLessonEditing({ mode: 'closed' });
    setLessonForm(emptyLessonForm());
    clearFiles();
  }

  async function saveLesson() {
    if (!lessonForm.title.trim()) { notify.error('Vui lòng nhập tên bài giảng'); return; }
    if (lessonEditing.mode === 'closed') return;

    // FIX: validate embed URL phải là YouTube hoặc Vimeo hợp lệ
    if (lessonForm.videoSource === 'embed' && lessonForm.videoEmbedUrl.trim()) {
      const url = lessonForm.videoEmbedUrl.trim();
      const isValidEmbed =
        url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com');
      if (!isValidEmbed) {
        notify.error('URL video phải là link YouTube hoặc Vimeo hợp lệ');
        return;
      }
    }

    setSaving(true);
    setUploadProgress(0);

    const { chapterId } = lessonEditing;

    try {
      const req: svc.CreateLessonRequest = {
        title:        lessonForm.title.trim(),
        description:  lessonForm.description.trim() || undefined,
        position:     lessonForm.position,
        isFree:       lessonForm.isFree,
        // Chỉ gửi embedUrl khi user chọn tab embed và đã nhập URL
        videoEmbedUrl: lessonForm.videoSource === 'embed' && lessonForm.videoEmbedUrl.trim()
          ? lessonForm.videoEmbedUrl.trim() : undefined,
      };

      // Bước 1: Tạo / cập nhật metadata bài giảng
      let lesson: TeacherLessonResponse;
      if (lessonEditing.mode === 'new') {
        lesson = await svc.addLesson(selectedCourseId, chapterId, req);
      } else {
        lesson = await svc.updateLesson(selectedCourseId, chapterId, lessonEditing.lessonId, req);
      }

      // Bước 2: Upload file (thực hiện sau khi có lessonId)
      // FIX: tách riêng try/catch cho upload để phân biệt lỗi tạo lesson vs lỗi upload.
      // Nếu upload thất bại, lesson vẫn đã được tạo — thông báo rõ để GV upload lại.
      let uploadError = false;
      try {
        if (videoFile) {
          await svc.uploadVideo(selectedCourseId, chapterId, lesson.id, videoFile,
            pct => setUploadProgress(pct));
        }
        if (pdfFile) {
          await svc.uploadDocument(lesson.id, pdfFile);
        }
        if (slideFile) {
          await svc.uploadDocument(lesson.id, slideFile, slideFile.name);
        }
      } catch (uploadErr: unknown) {
        uploadError = true;
        // Lấy message từ backend nếu có (vd: file quá lớn, sai định dạng)
        // FIX: dùng err.message thay vì err.response?.data?.message
        const msg = uploadErr instanceof Error ? uploadErr.message : 'Upload file thất bại';
        notify.error(msg + ' — Bài giảng đã được lưu. Vào chỉnh sửa bài giảng để upload lại.');
      }

      // Bước 3: Refresh danh sách từ server (dù upload lỗi, lesson vẫn cần hiển thị)
      const detail = await svc.getCourseDetail(selectedCourseId);
      setChapters(sortChapters(detail.chapters));

      // Chỉ đóng form và hiển thị success khi KHÔNG có upload error
      if (!uploadError) {
        notify.success(lessonEditing.mode === 'new' ? 'Đã thêm bài giảng' : 'Đã cập nhật bài giảng');
        setLessonEditing({ mode: 'closed' });
        clearFiles();
      }
    } catch (err: unknown) {
      // FIX: apiClient interceptor đã wrap lỗi backend thành plain Error với .message
      // — KHÔNG dùng .response?.data?.message nữa vì interceptor đã bóc ra rồi
      const msg = err instanceof Error ? err.message : 'Lưu bài giảng thất bại';
      notify.error(msg);
    } finally {
      setSaving(false);
      setUploadProgress(0);
    }
  }

  // FIX: thay window.confirm bằng confirm inline — không blocking, có loading state
  function deleteLessonHandler(chapterId: string, lessonId: string, title: string) {
    setDeleteConfirm({ type: 'lesson', id: lessonId, chapterId, title });
  }

  async function confirmDeleteLesson(lessonId: string, chapterId: string) {
    setDeleteConfirm(null);
    try {
      await svc.deleteLesson(selectedCourseId, chapterId, lessonId);
      setChapters(prev => sortChapters(prev.map(ch =>
        ch.id !== chapterId ? ch : { ...ch, lessons: ch.lessons.filter(l => l.id !== lessonId) }
      )));
      // Đóng form nếu đang edit bài giảng bị xóa
      if (lessonEditing.mode === 'edit' && lessonEditing.lessonId === lessonId) {
        setLessonEditing({ mode: 'closed' });
      }
      notify.success('Đã xóa bài giảng');
    } catch {
      notify.error('Xóa bài giảng thất bại');
    }
  }

  // ── Chapter handlers ─────────────────────────────────────────────

  function startAddChapter() {
    setChapterForm(emptyChapterForm(chapters.length + 1));
    setChapterEditing({ mode: 'new' });
    setLessonEditing({ mode: 'closed' });
  }

  function startEditChapter(ch: TeacherChapterResponse) {
    setChapterForm({ title: ch.title, description: ch.description ?? '', position: ch.position });
    setChapterEditing({ mode: 'edit', chapterId: ch.id });
    setLessonEditing({ mode: 'closed' });
  }

  async function saveChapter() {
    if (!chapterForm.title.trim()) { notify.error('Vui lòng nhập tên chương'); return; }
    if (chapterEditing.mode === 'closed') return;
    setSaving(true);
    try {
      const req: svc.CreateChapterRequest = {
        title: chapterForm.title.trim(),
        description: chapterForm.description.trim() || undefined,
        position: chapterForm.position,
      };

      if (chapterEditing.mode === 'new') {
        const ch = await svc.addChapter(selectedCourseId, req);
        setChapters(prev => sortChapters([...prev, { ...ch, lessons: [] }]));
        setExpandedChapters(prev => new Set([...prev, ch.id]));
        notify.success('Đã thêm chương');
      } else {
        const ch = await svc.updateChapter(selectedCourseId, chapterEditing.chapterId, req);
        setChapters(prev => sortChapters(prev.map(c =>
          c.id === chapterEditing.chapterId ? { ...ch, lessons: c.lessons } : c
        )));
        notify.success('Đã cập nhật chương');
      }
      setChapterEditing({ mode: 'closed' });
    } catch (err: unknown) {
      // FIX: dùng err.message — interceptor đã bóc message từ backend ra rồi
      const msg = err instanceof Error ? err.message : 'Lưu chương thất bại';
      notify.error(msg);
    } finally {
      setSaving(false);
    }
  }

  function deleteChapterHandler(chapterId: string, title: string) {
    setDeleteConfirm({ type: 'chapter', id: chapterId, title });
  }

  async function confirmDeleteChapter(chapterId: string) {
    setDeleteConfirm(null);
    try {
      await svc.deleteChapter(selectedCourseId, chapterId);
      setChapters(prev => sortChapters(prev.filter(c => c.id !== chapterId)));
      setLessonEditing({ mode: 'closed' });
      notify.success('Đã xóa chương');
    } catch {
      notify.error('Xóa chương thất bại');
    }
  }

  function handleLogout() { logout(); navigate('/login'); }

  // ─────────────────────────────────────────────────────────────────
  //  RENDER — right panel content
  // ─────────────────────────────────────────────────────────────────

  const rightPanel = () => {
    // Chapter form
    if (chapterEditing.mode !== 'closed') {
      return (
        <>
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-extrabold text-on-surface text-lg">
              {chapterEditing.mode === 'new' ? 'Thêm chương mới' : 'Chỉnh sửa chương'}
            </h3>
          </div>
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-bold text-on-surface mb-1.5 block">
                Tên chương <span className="text-red-500">*</span>
              </span>
              <input
                type="text"
                value={chapterForm.title}
                onChange={e => setChapterForm({ ...chapterForm, title: e.target.value })}
                placeholder="VD: Chương 1: Hằng đẳng thức đáng nhớ"
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-on-surface mb-1.5 block">Mô tả ngắn</span>
              <textarea
                value={chapterForm.description}
                onChange={e => setChapterForm({ ...chapterForm, description: e.target.value })}
                placeholder="Tóm tắt nội dung chương"
                rows={2}
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant resize-none"
              />
            </label>
            <label className="block max-w-[160px]">
              <span className="text-sm font-bold text-on-surface mb-1.5 block">Thứ tự chương</span>
              <input
                type="number"
                min={1}
                value={chapterForm.position}
                onChange={e => setChapterForm({ ...chapterForm, position: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
              />
            </label>
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-outline-variant/30">
              <button
                onClick={() => setChapterEditing({ mode: 'closed' })}
                className="px-5 py-2.5 text-sm font-bold text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={saveChapter}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20 disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Lưu chương
              </button>
            </div>
          </div>
        </>
      );
    }

    // Lesson form
    if (lessonEditing.mode !== 'closed') {
      return (
        <>
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-extrabold text-on-surface text-lg">
              {lessonEditing.mode === 'new' ? 'Thêm bài giảng mới' : 'Chỉnh sửa bài giảng'}
            </h3>
          </div>
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-bold text-on-surface mb-1.5 block">
                Tên bài giảng <span className="text-red-500">*</span>
              </span>
              <input
                type="text"
                value={lessonForm.title}
                onChange={e => setLessonForm({ ...lessonForm, title: e.target.value })}
                placeholder="VD: Bình phương của một tổng"
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-on-surface mb-1.5 block">Mô tả ngắn</span>
              <textarea
                value={lessonForm.description}
                onChange={e => setLessonForm({ ...lessonForm, description: e.target.value })}
                placeholder="Tóm tắt nội dung bài giảng trong 1-2 câu"
                rows={2}
                className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant resize-none"
              />
            </label>

            <div className="flex items-center gap-6">
              <label className="block max-w-[160px]">
                <span className="text-sm font-bold text-on-surface mb-1.5 block">Thứ tự bài học</span>
                <input
                  type="number"
                  min={1}
                  value={lessonForm.position}
                  onChange={e => setLessonForm({ ...lessonForm, position: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                />
              </label>
              <label className="flex items-center gap-2 cursor-pointer mt-5">
                <input
                  type="checkbox"
                  checked={lessonForm.isFree}
                  onChange={e => setLessonForm({ ...lessonForm, isFree: e.target.checked })}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm font-semibold text-on-surface">Bài học miễn phí (xem thử)</span>
              </label>
            </div>

            <div className="pt-4 border-t border-outline-variant/30">
              <p className="text-sm font-bold text-on-surface mb-3">Đính kèm tài liệu</p>
              <div className="space-y-3">
                <VideoSlot
                  videoSource={lessonForm.videoSource}
                  videoEmbedUrl={lessonForm.videoEmbedUrl}
                  videoStoragePath={lessonForm.videoStoragePath}
                  videoFile={videoFile}
                  uploadProgress={uploadProgress}
                  onEmbedChange={url => setLessonForm({
                    ...lessonForm,
                    videoSource: url ? 'embed' : 'none',
                    videoEmbedUrl: url,
                    videoStoragePath: '',  // xóa path upload cũ khi chuyển sang embed
                  })}
                  onFileSelect={f => {
                    setVideoFile(f);
                    setLessonForm({ ...lessonForm, videoSource: 'upload', videoEmbedUrl: '' });
                  }}
                  onRemoveFile={() => {
                    setVideoFile(null);
                    setLessonForm({ ...lessonForm, videoSource: 'none', videoStoragePath: '' });
                  }}
                />

                <FileSlot
                  label="Tài liệu PDF"
                  icon={<FileImage className="w-5 h-5" />}
                  accept=".pdf"
                  existingName={undefined}
                  file={pdfFile}
                  onSelect={f => setPdfFile(f)}
                  onRemove={() => setPdfFile(null)}
                />

                <FileSlot
                  label="Slide bài giảng"
                  icon={<Presentation className="w-5 h-5" />}
                  accept=".pptx,.ppt,.key,.pdf"
                  existingName={undefined}
                  file={slideFile}
                  onSelect={f => setSlideFile(f)}
                  onRemove={() => setSlideFile(null)}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-outline-variant/30">
              <button
                onClick={cancelLessonEdit}
                disabled={saving}
                className="px-5 py-2.5 text-sm font-bold text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={saveLesson}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20 disabled:opacity-60"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" />{uploadProgress > 0 ? `Đang tải ${uploadProgress}%...` : 'Đang lưu...'}</>
                  : <><Save className="w-4 h-4" />Lưu bài giảng</>
                }
              </button>
            </div>
          </div>
        </>
      );
    }

    // Empty state
    return (
      <div className="text-center py-16">
        <FileText className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
        <p className="text-on-surface-variant">
          Chọn một bài giảng để chỉnh sửa,<br />
          hoặc nhấn <span className="font-bold text-primary">+ Thêm bài giảng</span> trong chương ở bên trái,<br />
          hoặc nhấn <span className="font-bold text-primary">+ Thêm chương</span> để tạo chương mới.
        </p>
      </div>
    );
  };

  // ═════════════════════════════════════════════════════════════════
  //  MAIN RENDER
  // ═════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-surface flex font-sans">

      {isSidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* FIX: Confirm dialog inline thay cho window.confirm() blocking cũ.
          Hiển thị overlay mờ + hộp xác nhận ở giữa màn hình.
          deleteConfirm = null → ẩn; có giá trị → hiển thị. */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-on-surface text-base">
                  Xác nhận xóa {deleteConfirm.type === 'chapter' ? 'chương' : 'bài giảng'}
                </h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  {deleteConfirm.type === 'chapter'
                    ? `Xóa chương "${deleteConfirm.title}" sẽ xóa toàn bộ bài giảng bên trong. Hành động này không thể hoàn tác.`
                    : `Xóa bài giảng "${deleteConfirm.title}"? Hành động này không thể hoàn tác.`
                  }
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-surface-container hover:bg-surface-container-high transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  if (deleteConfirm.type === 'chapter') {
                    confirmDeleteChapter(deleteConfirm.id);
                  } else {
                    confirmDeleteLesson(deleteConfirm.id, deleteConfirm.chapterId!);
                  }
                }}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
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

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0">

        <header className="sticky top-0 z-20 h-16 bg-surface/90 backdrop-blur-md border-b border-outline-variant/30 flex items-center justify-between px-4 md:px-6 shadow-sm">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors"
          >
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

          {/* Course selector */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <h2 className="text-2xl font-extrabold text-on-surface mb-1">Cập nhật bài giảng</h2>
            <p className="text-on-surface-variant text-sm mb-4">
              Chọn khóa học → thêm chương → thêm hoặc sửa bài giảng
            </p>

            {loading ? (
              <div className="flex items-center gap-2 text-on-surface-variant text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Đang tải khóa học...
              </div>
            ) : courses.length === 0 ? (
              <p className="text-sm text-on-surface-variant">
                Bạn chưa có khóa học nào.{' '}
                <Link to="/teacher/courses" className="text-primary font-bold hover:underline">
                  Tạo khóa học mới
                </Link>
              </p>
            ) : (
              <label className="block">
                <span className="text-sm font-bold text-on-surface mb-2 block">Chọn khóa học</span>
                <select
                  value={selectedCourseId}
                  onChange={e => setSelectedCourseId(e.target.value)}
                  className="w-full max-w-md px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-on-surface font-semibold"
                >
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </label>
            )}
          </motion.div>

          {/* Content grid */}
          {!loading && courses.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

              {/* LEFT — chapter tree */}
              <motion.div
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 shadow-sm h-fit"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-extrabold text-on-surface flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" />
                    Cấu trúc khóa học
                  </h3>
                </div>

                {loadingDetail ? (
                  <div className="flex items-center justify-center py-12 text-on-surface-variant gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Đang tải...</span>
                  </div>
                ) : chapters.length === 0 ? (
                  <p className="text-sm text-on-surface-variant text-center py-8">
                    Khóa học chưa có chương nào
                  </p>
                ) : (
                  <div className="space-y-2">
                    {chapters.map(chapter => {
                      const isExpanded = expandedChapters.has(chapter.id);
                      const isChapterEditing =
                        chapterEditing.mode === 'edit' && chapterEditing.chapterId === chapter.id;
                      return (
                        <div
                          key={chapter.id}
                          className={`border rounded-xl overflow-hidden ${
                            isChapterEditing ? 'border-primary/50' : 'border-outline-variant/30'
                          }`}
                        >
                          {/* Chapter header */}
                          <div className="flex items-center bg-surface-container/50 hover:bg-surface-container transition-colors">
                            <button
                              onClick={() => toggleChapter(chapter.id)}
                              className="flex items-center gap-2 px-3 py-2.5 flex-1 text-left min-w-0"
                            >
                              {isExpanded
                                ? <ChevronDown className="w-4 h-4 flex-shrink-0" />
                                : <ChevronRight className="w-4 h-4 flex-shrink-0" />
                              }
                              <span className="font-bold text-sm text-on-surface flex-1 line-clamp-1">
                                {chapter.title}
                              </span>
                              <span className="text-xs text-on-surface-variant flex-shrink-0 mr-1">
                                {chapter.lessons.length} bài
                              </span>
                            </button>
                            <div className="flex items-center gap-0.5 pr-2">
                              <button
                                onClick={() => startEditChapter(chapter)}
                                title="Sửa chương"
                                className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => deleteChapterHandler(chapter.id, chapter.title)}
                                title="Xóa chương"
                                className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Lesson list */}
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
                                    const isEditing =
                                      lessonEditing.mode === 'edit' && lessonEditing.lessonId === lesson.id;
                                    return (
                                      <div
                                        key={lesson.id}
                                        className={`flex items-center gap-2 px-2 py-2 rounded-lg group ${
                                          isEditing ? 'bg-primary/10' : 'hover:bg-surface-container/50'
                                        }`}
                                      >
                                        <span className="text-xs font-mono text-on-surface-variant flex-shrink-0 w-5 text-right">
                                          {lesson.position}.
                                        </span>
                                        <span className={`text-sm flex-1 line-clamp-1 ${isEditing ? 'text-primary font-bold' : 'text-on-surface'}`}>
                                          {lesson.title}
                                        </span>
                                        {lesson.hasVideo && (
                                          <Video className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                        )}
                                        <button
                                          onClick={() => startEditLesson(chapter.id, lesson)}
                                          title="Sửa"
                                          className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => deleteLessonHandler(chapter.id, lesson.id, lesson.title)}
                                          title="Xóa"
                                          className="p-1.5 text-red-500 hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    );
                                  })}
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

                {/* Add chapter button */}
                {!loadingDetail && (
                  <button
                    onClick={startAddChapter}
                    className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-on-surface-variant border-2 border-dashed border-outline-variant hover:border-primary hover:text-primary rounded-xl transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Thêm chương
                  </button>
                )}
              </motion.div>

              {/* RIGHT — form panel */}
              <motion.div
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                className="lg:col-span-3 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-5 shadow-sm"
              >
                {rightPanel()}
              </motion.div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

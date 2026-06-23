/**
 * ExcelImportModal — Phase 2
 * Giáo viên upload file .xlsx → parse → preview → bulk import
 *
 * Định dạng Excel (hàng 1 = header, dữ liệu từ hàng 2):
 *   A: Nội dung câu hỏi   (bắt buộc)
 *   B: Loại               TN = trắc nghiệm | DS = đúng/sai
 *   C: Độ khó             D = dễ | TB = trung bình | K = khó
 *   D: Đáp án A           (bắt buộc)
 *   E: Đáp án B           (bắt buộc)
 *   F: Đáp án C           (tùy chọn)
 *   G: Đáp án D           (tùy chọn)
 *   H: Đáp án đúng        A / B / C / D
 *   I: Giải thích         (tùy chọn)
 */

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { notify } from '../../lib/toast';
import * as questionService from '../../api/questionService';
import type { CreateQuestionRequest } from '../../api/questionService';
import { isApiError } from '../../api/client';
import { listCategories } from '../../api/courseService';
import { listMyCourses, getCourseDetail } from '../../api/teacherCourseService';
import type { TeacherCourseResponse, TeacherChapterResponse } from '../../api/teacherCourseService';
import type { Category } from '../../types/api';
import {
  X, Upload, FileSpreadsheet, ChevronDown, Loader2,
  CheckCircle2, AlertCircle, Download, Trash2, Eye, Lock,
} from 'lucide-react';
import { useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Difficulty = 'easy' | 'medium' | 'hard';

interface ParsedRow {
  rowNum: number;
  content: string;
  type: 'multiple_choice' | 'true_false';
  difficulty: Difficulty;
  choices: Array<{ content: string; isCorrect: boolean }>;
  explanation: string;
  error?: string;
}

// ─── Excel parser ─────────────────────────────────────────────────────────────

function plain(value: unknown): string {
  return String(value ?? '').trim();
}

function token(value: unknown): string {
  return plain(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase();
}

function parseQuestionType(value: unknown): 'multiple_choice' | 'true_false' {
  const t = token(value);
  return ['DS', 'DUNG/SAI', 'TRUE_FALSE', 'TRUEFALSE', 'TF'].includes(t)
    ? 'true_false'
    : 'multiple_choice';
}

function parseDifficulty(value: unknown): Difficulty {
  const d = token(value);
  if (['D', 'DE', 'EASY'].includes(d)) return 'easy';
  if (['K', 'KHO', 'HARD'].includes(d)) return 'hard';
  return 'medium';
}

function correctChoiceIndex(value: unknown): number {
  const c = token(value);
  if (['A', '1'].includes(c)) return 0;
  if (['B', '2'].includes(c)) return 1;
  if (['C', '3'].includes(c)) return 2;
  if (['D', '4'].includes(c)) return 3;
  return -1;
}

function trueFalseCorrectIndex(value: unknown): number {
  const c = token(value);
  return ['B', 'S', 'SAI', 'FALSE', 'F', '0'].includes(c) ? 1 : 0;
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (isApiError(err)) return err.message;
  return err instanceof Error && err.message ? err.message : fallback;
}

function wasNetworkErrorAlreadyToasted(err: unknown): boolean {
  const message = err instanceof Error ? err.message : '';
  return message.startsWith('Không thể kết nối') || message.startsWith('Mất kết nối');
}

function parseExcel(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        const parsed: ParsedRow[] = [];
        // Bỏ hàng header (hàng 0)
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          // Bỏ qua hàng trống hoàn toàn
          if (!r.some(cell => String(cell).trim())) continue;

          const content     = plain(r[0]);
          const type        = parseQuestionType(r[1] || 'TN');
          const difficulty  = parseDifficulty(r[2] || 'TB');
          const ansA        = plain(r[3]);
          const ansB        = plain(r[4]);
          const ansC        = plain(r[5]);
          const ansD        = plain(r[6]);
          const explanation = plain(r[8]);

          // Build choices
          let choices: Array<{ content: string; isCorrect: boolean }>;
          let error: string | undefined;

          if (type === 'true_false') {
            const correctIdx = trueFalseCorrectIndex(r[7] || 'A');
            choices = [
              { content: 'Đúng', isCorrect: correctIdx === 0 },
              { content: 'Sai',  isCorrect: correctIdx === 1 },
            ];
          } else {
            const raw = [ansA, ansB, ansC, ansD].filter(Boolean);
            if (raw.length < 2) {
              error = 'Cần ít nhất 2 đáp án';
            }
            const correctIdx = correctChoiceIndex(r[7] || 'A');
            choices = raw.map((c, idx) => ({
              content: c,
              isCorrect: idx === correctIdx,
            }));
            if (correctIdx < 0 || correctIdx >= raw.length) {
              error = `Đáp án đúng "${plain(r[7])}" không hợp lệ`;
            }
          }

          if (!content) error = 'Thiếu nội dung câu hỏi';

          parsed.push({ rowNum: i + 1, content, type, difficulty, choices, explanation, error });
        }
        resolve(parsed);
      } catch (err) {
        reject(new Error('Không đọc được file Excel'));
      }
    };
    reader.onerror = () => reject(new Error('Lỗi đọc file'));
    reader.readAsArrayBuffer(file);
  });
}

// ─── Download template ────────────────────────────────────────────────────────

function downloadTemplate() {
  const header = [
    'Nội dung câu hỏi',
    'Loại (TN/DS)',
    'Độ khó (D/TB/K)',
    'Đáp án A',
    'Đáp án B',
    'Đáp án C',
    'Đáp án D',
    'Đáp án đúng (A/B/C/D)',
    'Giải thích (tùy chọn)',
  ];
  const examples = [
    ['Phương trình bậc hai ax²+bx+c=0 có tối đa bao nhiêu nghiệm thực?', 'TN', 'D', '1 nghiệm', '2 nghiệm', '3 nghiệm', '0 nghiệm', 'B', 'Theo định lý cơ bản đại số'],
    ['Trái đất quay quanh Mặt Trời.', 'DS', 'D', '', '', '', '', 'A', ''],
    ['Nguyên tố nào có số hiệu nguyên tử bằng 1?', 'TN', 'TB', 'Heli', 'Oxy', 'Hydro', 'Carbon', 'C', 'H có Z=1 trong bảng tuần hoàn'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([header, ...examples]);

  // Style header row width
  ws['!cols'] = [
    { wch: 50 }, { wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 20 },
    { wch: 20 }, { wch: 20 }, { wch: 22 }, { wch: 35 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Câu hỏi');
  XLSX.writeFile(wb, 'mau_ngan_hang_cau_hoi.xlsx');
}

// ─── Difficulty badge (small) ─────────────────────────────────────────────────

function DiffBadge({ d }: { d: Difficulty }) {
  const map = {
    easy:   'bg-green-100 text-green-700',
    medium: 'bg-amber-100 text-amber-700',
    hard:   'bg-red-100 text-red-700',
  };
  const label = { easy: 'Dễ', medium: 'TB', hard: 'Khó' };
  return (
    <span className={`px-1.5 py-0.5 rounded-md text-xs font-bold ${map[d]}`}>{label[d]}</span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export default function ExcelImportModal({ open, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  // Context selectors
  const [categories,  setCategories]  = useState<Category[]>([]);
  const [courses,     setCourses]     = useState<TeacherCourseResponse[]>([]);
  const [chapters,    setChapters]    = useState<TeacherChapterResponse[]>([]);
  const [categoryId,  setCategoryId]  = useState('');
  const [grade,       setGrade]       = useState('');
  const [courseId,    setCourseId]    = useState('');
  const [chapterId,   setChapterId]   = useState('');
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingCh,   setLoadingCh]   = useState(false);

  // Parse state
  const [parsing,   setParsing]   = useState(false);
  const [rows,      setRows]      = useState<ParsedRow[]>([]);
  const [fileName,  setFileName]  = useState('');
  const [importing, setImporting] = useState(false);
  const [result,    setResult]    = useState<questionService.BulkImportResult | null>(null);

  // Load categories + courses on open
  useEffect(() => {
    if (!open) return;
    setLoadingMeta(true);
    Promise.all([listCategories(), listMyCourses(0, 100).then(p => p.items)])
      .then(([cats, crs]) => { setCategories(cats); setCourses(crs); })
      .catch(() => notify.error('Không tải được danh mục'))
      .finally(() => setLoadingMeta(false));
  }, [open]);

  // Load chapters + lock category khi chọn course
  useEffect(() => {
    if (!courseId) { setChapters([]); setChapterId(''); return; }
    setLoadingCh(true);
    getCourseDetail(courseId)
      .then(d => {
        setChapters(d.chapters);
        // Luôn fill (bỏ điều kiện !categoryId cũ) — đảm bảo category khớp course
        if (d.categoryId) setCategoryId(d.categoryId);
        if (d.grades?.[0]) setGrade(String(d.grades[0]));
      })
      .catch(() => {})
      .finally(() => setLoadingCh(false));
    setChapterId('');
  }, [courseId]);

  function resetFile() {
    setRows([]);
    setFileName('');
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleClose() {
    resetFile();
    setCategoryId(''); setGrade(''); setCourseId(''); setChapterId('');
    onClose();
  }

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.xlsx?$/i)) {
      notify.error('Chỉ hỗ trợ file .xlsx / .xls');
      return;
    }
    setParsing(true);
    setResult(null);
    try {
      const parsed = await parseExcel(file);
      setRows(parsed);
      setFileName(file.name);
    } catch (err: any) {
      notify.error(err.message ?? 'Lỗi đọc file');
    } finally {
      setParsing(false);
    }
  }, []);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  const validRows  = rows.filter(r => !r.error);
  const errorRows  = rows.filter(r => r.error);

  function handleCourseChange(nextCourseId: string) {
    setCourseId(nextCourseId);
    setChapterId('');

    if (!nextCourseId) return;

    const selectedCourse = courses.find(c => c.id === nextCourseId);
    if (selectedCourse?.categoryId) setCategoryId(selectedCourse.categoryId);
    setGrade(selectedCourse?.grades?.[0] ? String(selectedCourse.grades[0]) : '');
  }

  async function handleImport() {
    if (!categoryId) { notify.error('Vui lòng chọn môn học'); return; }
    if (!grade) { notify.error('Vui lòng chọn lớp'); return; }
    if (validRows.length === 0) { notify.error('Không có câu hỏi hợp lệ để nhập'); return; }

    const requests: CreateQuestionRequest[] = validRows.map(r => ({
      categoryId,
      grade: Number(grade),
      chapterId: chapterId || undefined,
      content:     r.content,
      explanation: r.explanation || undefined,
      difficulty:  r.difficulty,
      type:        r.type,
      choices:     r.choices,
    }));

    setImporting(true);
    try {
      const res = await questionService.bulkCreateQuestions(requests);
      setResult(res);
      if (res.created > 0) {
        notify.success(`Nhập thành công ${res.created} câu hỏi`);
        onImported();
      } else if (res.failed > 0) {
        notify.error(res.errors?.[0]?.message ?? 'Không nhập được câu hỏi nào');
      }
    } catch (err) {
      if (!wasNetworkErrorAlreadyToasted(err)) {
        notify.error(getErrorMessage(err, 'Nhập thất bại — kiểm tra lại kết nối'));
      }
    } finally {
      setImporting(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            className="fixed z-50 inset-x-4 top-[4vh] bottom-[4vh] max-w-4xl mx-auto bg-surface rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-green-500/10 text-green-600 rounded-xl flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-extrabold text-on-surface">Nhập câu hỏi từ Excel</h2>
                  <p className="text-xs text-on-surface-variant">Hỗ trợ .xlsx / .xls — tối đa 200 câu mỗi lần</p>
                </div>
              </div>
              <button onClick={handleClose} className="p-2 rounded-xl hover:bg-surface-container text-on-surface-variant">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* Step 1 — Tải template */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <Eye className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-blue-800">Bước 1 — Tải file mẫu</p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    File mẫu có 3 câu hỏi ví dụ giúp bạn điền đúng định dạng.
                  </p>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-xs font-bold rounded-lg hover:bg-blue-600 transition-colors flex-shrink-0"
                >
                  <Download className="w-3.5 h-3.5" /> Tải mẫu
                </button>
              </div>

              {/* Step 2 — Chọn khóa học + môn + chương */}
              <div>
                <p className="text-sm font-bold text-on-surface mb-2">
                  Bước 2 — Gắn nhãn cho toàn bộ câu hỏi trong file
                </p>
                {(() => {
                  const isCategoryLocked = Boolean(courseId);
                  const isGradeLocked = Boolean(courseId);
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      {/* Khóa học — chọn trước để auto-fill môn */}
                      <div>
                        <label className="block text-xs font-semibold text-on-surface-variant mb-1">Khóa học</label>
                        <div className="relative">
                          <select
                            value={courseId}
                            onChange={e => handleCourseChange(e.target.value)}
                            disabled={loadingMeta}
                            className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary disabled:opacity-50"
                          >
                            <option value="">-- Không gắn --</option>
                            {courses.map(c => <option key={c.id} value={c.id}>{c.title.slice(0, 35)}</option>)}
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
                        </div>
                      </div>

                      {/* Môn học — locked khi đã chọn course */}
                      <div>
                        <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                          Môn học <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <select
                            value={categoryId} onChange={e => setCategoryId(e.target.value)}
                            disabled={loadingMeta || isCategoryLocked}
                            className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <option value="">-- Chọn môn --</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                          {isCategoryLocked
                            ? <Lock className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
                            : <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
                          }
                        </div>
                        {isCategoryLocked && (
                          <p className="text-xs text-primary/70 mt-1">Lấy từ khóa học</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                          Lớp <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <select
                            value={grade} onChange={e => setGrade(e.target.value)}
                            disabled={isGradeLocked}
                            className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <option value="">-- Chọn lớp --</option>
                            {[6, 7, 8, 9].map(g => <option key={g} value={g}>Lớp {g}</option>)}
                          </select>
                          {isGradeLocked
                            ? <Lock className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
                            : <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
                          }
                        </div>
                        {isGradeLocked && (
                          <p className="text-xs text-primary/70 mt-1">Lấy từ khóa học</p>
                        )}
                      </div>

                      {/* Chương */}
                      <div>
                        <label className="block text-xs font-semibold text-on-surface-variant mb-1">Chương</label>
                        <div className="relative">
                          <select
                            value={chapterId} onChange={e => setChapterId(e.target.value)}
                            disabled={!courseId || loadingCh}
                            className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary disabled:opacity-50"
                          >
                            <option value="">-- Cấp môn học --</option>
                            {chapters.map(ch => <option key={ch.id} value={ch.id}>{ch.title.slice(0, 35)}</option>)}
                          </select>
                          {loadingCh
                            ? <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
                            : <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
                          }
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Step 3 — Upload file */}
              <div>
                <p className="text-sm font-bold text-on-surface mb-2">Bước 3 — Chọn file Excel</p>
                <div
                  onDrop={onDrop}
                  onDragOver={e => e.preventDefault()}
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-outline-variant rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/2 transition-colors"
                >
                  <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFileChange} />
                  {parsing ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-10 h-10 text-primary animate-spin" />
                      <p className="text-sm font-medium text-on-surface-variant">Đang đọc file...</p>
                    </div>
                  ) : fileName ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileSpreadsheet className="w-8 h-8 text-green-500" />
                      <div className="text-left">
                        <p className="font-bold text-on-surface text-sm">{fileName}</p>
                        <p className="text-xs text-on-surface-variant">
                          {rows.length} dòng · {validRows.length} hợp lệ · {errorRows.length} lỗi
                        </p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); resetFile(); }}
                        className="ml-2 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-10 h-10 text-on-surface-variant/40" />
                      <p className="font-semibold text-on-surface-variant">Kéo thả hoặc click để chọn file</p>
                      <p className="text-xs text-on-surface-variant/60">.xlsx / .xls</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Preview table */}
              {rows.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-on-surface">
                      Preview — {rows.length} câu hỏi
                      {errorRows.length > 0 && (
                        <span className="ml-2 text-red-500 text-xs font-semibold">
                          ({errorRows.length} dòng lỗi sẽ bị bỏ qua)
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="border border-outline-variant/40 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto max-h-64">
                      <table className="w-full text-xs">
                        <thead className="bg-surface-container/60 sticky top-0">
                          <tr className="border-b border-outline-variant/20">
                            <th className="text-left px-3 py-2 font-bold text-on-surface-variant w-8">#</th>
                            <th className="text-left px-3 py-2 font-bold text-on-surface-variant w-[40%]">Nội dung</th>
                            <th className="text-left px-3 py-2 font-bold text-on-surface-variant">Loại</th>
                            <th className="text-left px-3 py-2 font-bold text-on-surface-variant">Độ khó</th>
                            <th className="text-left px-3 py-2 font-bold text-on-surface-variant">Đáp án đúng</th>
                            <th className="text-left px-3 py-2 font-bold text-on-surface-variant">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(row => (
                            <tr
                              key={row.rowNum}
                              className={`border-b border-outline-variant/10 ${row.error ? 'bg-red-50' : 'hover:bg-surface-container/20'}`}
                            >
                              <td className="px-3 py-2 text-on-surface-variant">{row.rowNum}</td>
                              <td className="px-3 py-2 text-on-surface max-w-0">
                                <p className="truncate">{row.content || <span className="text-red-400 italic">Trống</span>}</p>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-on-surface-variant">
                                {row.type === 'multiple_choice' ? 'Trắc nghiệm' : 'Đúng/Sai'}
                              </td>
                              <td className="px-3 py-2">
                                <DiffBadge d={row.difficulty} />
                              </td>
                              <td className="px-3 py-2 text-on-surface">
                                {row.choices.find(c => c.isCorrect)?.content.slice(0, 30) ?? '—'}
                              </td>
                              <td className="px-3 py-2">
                                {row.error ? (
                                  <span className="flex items-center gap-1 text-red-500 font-medium">
                                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                    {row.error}
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-green-600 font-medium">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> OK
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Result */}
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={`rounded-xl p-4 flex items-start gap-3 ${
                    result.failed === 0 ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'
                  }`}
                >
                  <CheckCircle2 className={`w-5 h-5 flex-shrink-0 mt-0.5 ${result.failed === 0 ? 'text-green-600' : 'text-amber-600'}`} />
                  <div>
                    <p className={`font-bold text-sm ${result.failed === 0 ? 'text-green-800' : 'text-amber-800'}`}>
                      Nhập hoàn tất
                    </p>
                    <p className={`text-xs mt-0.5 ${result.failed === 0 ? 'text-green-700' : 'text-amber-700'}`}>
                      {result.created} câu hỏi đã được thêm vào ngân hàng.
                      {result.failed > 0 && ` ${result.failed} câu bị bỏ qua do lỗi.`}
                    </p>
                    {result.errors && result.errors.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-amber-800">
                        {result.errors.slice(0, 3).map(err => (
                          <li key={`${err.row}-${err.message}`}>
                            Dòng {err.row}: {err.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-outline-variant/30 flex items-center justify-between gap-3 flex-shrink-0">
              <p className="text-xs text-on-surface-variant">
                {validRows.length > 0 && !result && (
                  <span className="font-semibold text-primary">{validRows.length} câu hợp lệ sẵn sàng nhập</span>
                )}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="px-5 py-2.5 text-sm font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded-xl transition-colors"
                >
                  {result ? 'Đóng' : 'Hủy'}
                </button>
                {!result && (
                  <button
                    onClick={handleImport}
                    disabled={importing || validRows.length === 0 || !categoryId || !grade}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {importing
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang nhập...</>
                      : <><Upload className="w-4 h-4" /> Nhập {validRows.length > 0 ? `${validRows.length} câu hỏi` : ''}</>
                    }
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

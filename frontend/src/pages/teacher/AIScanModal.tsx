/**
 * AIScanModal — Phase 3
 * Upload PDF → backend gọi Gemini (server-side key) → trích xuất câu hỏi → preview → bulk import
 *
 * API key Gemini được giữ ở backend (GEMINI_API_KEY trong backend/.env),
 * không bao giờ expose ra JS bundle client-side.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { notify } from '../../lib/toast';
import * as questionService from '../../api/questionService';
import type { CreateQuestionRequest } from '../../api/questionService';
import { isApiError, apiClient, unwrap } from '../../api/client';
import { listCategories } from '../../api/courseService';
import { listMyCourses, getCourseDetail } from '../../api/teacherCourseService';
import type { TeacherCourseResponse, TeacherChapterResponse } from '../../api/teacherCourseService';
import type { Category, ApiResponse } from '../../types/api';
import {
  X, FileText, ChevronDown, Loader2,
  CheckCircle2, AlertCircle, Sparkles,
  RotateCcw, Lock,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Difficulty = 'easy' | 'medium' | 'hard';

interface ParsedQuestion {
  content: string;
  type: 'multiple_choice' | 'true_false';
  difficulty: Difficulty;
  choices: Array<{ content: string; isCorrect: boolean }>;
  explanation: string | null;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getErrorMessage(err: unknown, fallback: string): string {
  if (isApiError(err)) return err.message;
  return err instanceof Error && err.message ? err.message : fallback;
}

function wasNetworkErrorAlreadyToasted(err: unknown): boolean {
  const message = err instanceof Error ? err.message : '';
  return message.startsWith('Không thể kết nối') || message.startsWith('Mất kết nối');
}

/** Gọi backend proxy để upload PDF → Gemini, trả raw text. */
async function callAiScanBackend(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiClient.post<ApiResponse<string>>(
    '/api/teacher/ai/scan-pdf',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return unwrap(res.data);
}

function parseGeminiResponse(raw: string): ParsedQuestion[] {
  // Tìm JSON array trong response (đề phòng Gemini thêm text thừa)
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Gemini không trả về JSON hợp lệ');

  const arr = JSON.parse(match[0]);
  if (!Array.isArray(arr)) throw new Error('Phản hồi không phải array');

  return arr.map((item: any, i: number): ParsedQuestion => {
    try {
      let choices: Array<{ content: string; isCorrect: boolean }> =
        (item.choices ?? []).map((c: any) => ({
          content:   String(c.content ?? '').trim(),
          isCorrect: Boolean(c.isCorrect),
        })).filter((c: { content: string; isCorrect: boolean }) => c.content);

      let error: string | undefined;
      if (choices.length > 4) {
        error = 'Tối đa 4 đáp án';
        choices = choices.slice(0, 4);
      }

      // Đảm bảo đúng 1 đáp án đúng
      let correctCount = choices.filter(c => c.isCorrect).length;
      if (correctCount === 0 && choices.length > 0) choices[0].isCorrect = true;
      if (correctCount > 1) {
        // Giữ lại đáp án đúng đầu tiên
        let found = false;
        choices.forEach(c => { if (c.isCorrect && found) c.isCorrect = false; else if (c.isCorrect) found = true; });
      }
      correctCount = choices.filter(c => c.isCorrect).length;

      if (!item.content?.trim())        error = 'Thiếu nội dung câu hỏi';
      else if (choices.length < 2)      error = 'Cần ít nhất 2 đáp án';
      else if (choices.some(c => !c.content)) error = 'Đáp án trống';
      else if (correctCount !== 1)      error = 'Cần đúng 1 đáp án đúng';

      const difficulty: Difficulty =
        item.difficulty === 'easy' ? 'easy' : item.difficulty === 'hard' ? 'hard' : 'medium';

      const type: 'multiple_choice' | 'true_false' =
        item.type === 'true_false' ? 'true_false' : 'multiple_choice';

      return {
        content:     String(item.content ?? '').trim(),
        type,
        difficulty,
        choices,
        explanation: item.explanation ? String(item.explanation).trim() : null,
        error,
      };
    } catch {
      return {
        content: `(câu ${i + 1})`, type: 'multiple_choice',
        difficulty: 'medium', choices: [], explanation: null,
        error: 'Lỗi parse từ AI',
      };
    }
  });
}

// ─── Difficulty badge ─────────────────────────────────────────────────────────

function DiffBadge({ d }: { d: Difficulty }) {
  const cfg = {
    easy:   { cls: 'bg-green-100 text-green-700', label: 'Dễ'  },
    medium: { cls: 'bg-amber-100 text-amber-700', label: 'TB'  },
    hard:   { cls: 'bg-red-100 text-red-700',     label: 'Khó' },
  };
  return (
    <span className={`px-1.5 py-0.5 rounded-md text-xs font-bold ${cfg[d].cls}`}>{cfg[d].label}</span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

type Step = 'setup' | 'scanning' | 'preview' | 'done';

export default function AIScanModal({ open, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  // Context
  const [categories,  setCategories]  = useState<Category[]>([]);
  const [courses,     setCourses]     = useState<TeacherCourseResponse[]>([]);
  const [chapters,    setChapters]    = useState<TeacherChapterResponse[]>([]);
  const [categoryId,  setCategoryId]  = useState('');
  const [grade,       setGrade]       = useState('');
  const [courseId,    setCourseId]    = useState('');
  const [chapterId,   setChapterId]   = useState('');
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingCh,   setLoadingCh]   = useState(false);

  // State
  const [step,      setStep]      = useState<Step>('setup');
  const [fileName,  setFileName]  = useState('');
  const [progress,  setProgress]  = useState('');
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [importing, setImporting] = useState(false);
  const [result,    setResult]    = useState<questionService.BulkImportResult | null>(null);

  // Load metadata on open
  useEffect(() => {
    if (!open) return;
    setLoadingMeta(true);
    Promise.all([listCategories(), listMyCourses(0, 100).then(p => p.items)])
      .then(([cats, crs]) => { setCategories(cats); setCourses(crs); })
      .catch(() => {})
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

  function handleClose() {
    if (step === 'scanning') return;
    setStep('setup');
    setFileName(''); setQuestions([]); setResult(null); setProgress('');
    setCategoryId(''); setGrade(''); setCourseId(''); setChapterId('');
    onClose();
  }

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.pdf$/i)) {
      notify.error('Chỉ hỗ trợ file PDF');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      notify.error('File quá lớn — tối đa 20MB');
      return;
    }
    if (!categoryId) {
      notify.error('Vui lòng chọn môn học trước khi scan');
      return;
    }
    if (!grade) {
      notify.error('Vui lòng chọn lớp trước khi scan');
      return;
    }

    setFileName(file.name);
    setStep('scanning');
    setProgress('Đang gửi PDF đến server...');

    try {
      setProgress('Đang phân tích bằng Gemini AI...');
      const rawText = await callAiScanBackend(file);

      setProgress('Đang xử lý kết quả...');
      const parsed = parseGeminiResponse(rawText);
      setQuestions(parsed);
      setStep('preview');
    } catch (err) {
      notify.error(getErrorMessage(err, 'Không thể xử lý PDF. Thử lại sau.'));
      setStep('setup');
      setFileName('');
    } finally {
      setProgress('');
    }
  }, [categoryId, grade]);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  const validQ  = questions.filter(q => !q.error);
  const errorQ  = questions.filter(q => q.error);

  async function handleImport() {
    if (!categoryId) { notify.error('Chọn môn học'); return; }
    if (!grade) { notify.error('Chọn lớp'); return; }
    if (validQ.length === 0) return;

    const requests: CreateQuestionRequest[] = validQ.map(q => ({
      categoryId,
      grade: Number(grade),
      chapterId:   chapterId   || undefined,
      content:     q.content,
      explanation: q.explanation ?? undefined,
      difficulty:  q.difficulty,
      type:        q.type,
      choices:     q.choices,
    }));

    setImporting(true);
    try {
      const res = await questionService.bulkCreateQuestions(requests);
      setResult(res);
      setStep('done');
      if (res.created > 0) {
        notify.success(`Nhập thành công ${res.created} câu hỏi từ AI`);
        onImported();
      } else if (res.failed > 0) {
        notify.error(res.errors?.[0]?.message ?? 'Không nhập được câu hỏi nào');
      }
    } catch (err) {
      if (!wasNetworkErrorAlreadyToasted(err)) {
        notify.error(getErrorMessage(err, 'Nhập thất bại'));
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
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={handleClose}
          />
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
                <div className="w-9 h-9 bg-violet-500/10 text-violet-600 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-extrabold text-on-surface">Scan PDF bằng AI</h2>
                  <p className="text-xs text-on-surface-variant">Gemini tự động trích xuất câu hỏi từ file PDF</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={step === 'scanning'}
                className="p-2 rounded-xl hover:bg-surface-container text-on-surface-variant disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* Form scan PDF — API key quản lý bởi backend */}
              <>
                  {/* Step 1 — Chọn khóa học + môn + chương */}
                  <div>
                    <p className="text-sm font-bold text-on-surface mb-2">
                      Bước 1 — Gắn nhãn cho câu hỏi sẽ nhập
                    </p>
                    {(() => {
                      const isCategoryLocked = Boolean(courseId);
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                          {/* Khóa học — chọn trước để auto-fill môn */}
                          <div>
                            <label className="block text-xs font-semibold text-on-surface-variant mb-1">Khóa học</label>
                            <div className="relative">
                              <select
                                value={courseId}
                                onChange={e => { setCourseId(e.target.value); setChapterId(''); }}
                                disabled={loadingMeta || step === 'scanning'}
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
                                value={categoryId}
                                onChange={e => setCategoryId(e.target.value)}
                                disabled={loadingMeta || step === 'scanning' || isCategoryLocked}
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
                                value={grade}
                                onChange={e => setGrade(e.target.value)}
                                disabled={step === 'scanning'}
                                className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary disabled:opacity-50"
                              >
                                <option value="">-- Chọn lớp --</option>
                                {[6, 7, 8, 9].map(g => <option key={g} value={g}>Lớp {g}</option>)}
                              </select>
                              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
                            </div>
                          </div>

                          {/* Chương */}
                          <div>
                            <label className="block text-xs font-semibold text-on-surface-variant mb-1">Chương</label>
                            <div className="relative">
                              <select
                                value={chapterId}
                                onChange={e => setChapterId(e.target.value)}
                                disabled={!courseId || loadingCh || step === 'scanning'}
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

                  {/* Step 2 — Upload PDF */}
                  {(step === 'setup' || step === 'scanning') && (
                    <div>
                      <p className="text-sm font-bold text-on-surface mb-2">Bước 2 — Chọn file PDF</p>
                      <div
                        onDrop={onDrop}
                        onDragOver={e => e.preventDefault()}
                        onClick={() => step === 'setup' && fileRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
                          step === 'scanning'
                            ? 'border-violet-400 bg-violet-50 cursor-default'
                            : 'border-outline-variant cursor-pointer hover:border-violet-400/60 hover:bg-violet-500/3'
                        }`}
                      >
                        <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={onFileChange} />

                        {step === 'scanning' ? (
                          <div className="flex flex-col items-center gap-4">
                            {/* Gemini thinking animation */}
                            <div className="relative w-16 h-16">
                              <div className="absolute inset-0 rounded-full border-4 border-violet-200 animate-ping opacity-50" />
                              <div className="absolute inset-2 rounded-full border-4 border-t-violet-500 border-violet-200 animate-spin" />
                              <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-violet-500" />
                            </div>
                            <div>
                              <p className="font-bold text-violet-700">{progress}</p>
                              <p className="text-xs text-violet-500 mt-1">
                                {fileName} · Gemini đang phân tích...
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-14 h-14 bg-violet-500/10 rounded-2xl flex items-center justify-center">
                              <FileText className="w-7 h-7 text-violet-500" />
                            </div>
                            <div>
                              <p className="font-semibold text-on-surface">Kéo thả hoặc click để chọn PDF</p>
                              <p className="text-xs text-on-surface-variant mt-1">Tối đa 20MB · Gemini sẽ đọc và trích xuất câu hỏi tự động</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Preview */}
                  {(step === 'preview' || step === 'done') && questions.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-bold text-on-surface">
                            Kết quả từ AI — {questions.length} câu hỏi tìm thấy
                          </p>
                          <p className="text-xs text-on-surface-variant mt-0.5">
                            Từ file: <span className="font-semibold">{fileName}</span>
                            {errorQ.length > 0 && (
                              <span className="ml-2 text-red-500">{errorQ.length} câu lỗi sẽ bị bỏ qua</span>
                            )}
                          </p>
                        </div>
                        {step === 'preview' && (
                          <button
                            onClick={() => { setStep('setup'); setQuestions([]); setFileName(''); if (fileRef.current) fileRef.current.value = ''; }}
                            className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant hover:text-on-surface px-3 py-1.5 bg-surface-container rounded-lg"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Scan lại
                          </button>
                        )}
                      </div>

                      {/* Stats row */}
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        {[
                          { label: 'Hợp lệ',      value: validQ.length,  cls: 'bg-green-50 text-green-700 border-green-200' },
                          { label: 'Dễ',           value: validQ.filter(q => q.difficulty === 'easy').length,   cls: 'bg-green-50 text-green-600 border-green-100' },
                          { label: 'Trung bình',   value: validQ.filter(q => q.difficulty === 'medium').length, cls: 'bg-amber-50 text-amber-600 border-amber-100' },
                          { label: 'Khó',          value: validQ.filter(q => q.difficulty === 'hard').length,   cls: 'bg-red-50 text-red-600 border-red-100' },
                        ].map(s => (
                          <div key={s.label} className={`border rounded-xl p-3 text-center ${s.cls}`}>
                            <p className="text-xl font-extrabold">{s.value}</p>
                            <p className="text-xs font-medium">{s.label}</p>
                          </div>
                        ))}
                      </div>

                      <div className="border border-outline-variant/40 rounded-xl overflow-hidden">
                        <div className="overflow-x-auto max-h-72">
                          <table className="w-full text-xs">
                            <thead className="bg-surface-container/60 sticky top-0">
                              <tr className="border-b border-outline-variant/20">
                                <th className="text-left px-3 py-2 font-bold text-on-surface-variant w-8">#</th>
                                <th className="text-left px-3 py-2 font-bold text-on-surface-variant w-[42%]">Nội dung</th>
                                <th className="text-left px-3 py-2 font-bold text-on-surface-variant">Loại</th>
                                <th className="text-left px-3 py-2 font-bold text-on-surface-variant">Độ khó</th>
                                <th className="text-left px-3 py-2 font-bold text-on-surface-variant">Đáp án đúng</th>
                                <th className="text-left px-3 py-2 font-bold text-on-surface-variant">Trạng thái</th>
                              </tr>
                            </thead>
                            <tbody>
                              {questions.map((q, idx) => (
                                <tr key={idx} className={`border-b border-outline-variant/10 ${q.error ? 'bg-red-50' : 'hover:bg-surface-container/20'}`}>
                                  <td className="px-3 py-2 text-on-surface-variant">{idx + 1}</td>
                                  <td className="px-3 py-2 text-on-surface max-w-0">
                                    <p className="truncate" title={q.content}>{q.content || <span className="text-red-400 italic">Trống</span>}</p>
                                    {q.explanation && <p className="text-on-surface-variant truncate mt-0.5">💡 {q.explanation}</p>}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-on-surface-variant">
                                    {q.type === 'multiple_choice' ? 'Trắc nghiệm' : 'Đúng/Sai'}
                                  </td>
                                  <td className="px-3 py-2"><DiffBadge d={q.difficulty} /></td>
                                  <td className="px-3 py-2 text-on-surface">
                                    {q.choices.find(c => c.isCorrect)?.content.slice(0, 35) ?? '—'}
                                  </td>
                                  <td className="px-3 py-2">
                                    {q.error ? (
                                      <span className="flex items-center gap-1 text-red-500 font-medium whitespace-nowrap">
                                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{q.error}
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

                  {/* Done result */}
                  {step === 'done' && result && (
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
                          {result.created} câu hỏi đã được thêm vào ngân hàng từ AI.
                          {result.failed > 0 && ` ${result.failed} câu bị bỏ qua.`}
                        </p>
                        {result.errors && result.errors.length > 0 && (
                          <ul className="mt-2 space-y-1 text-xs text-amber-800">
                            {result.errors.slice(0, 3).map(err => (
                              <li key={`${err.row}-${err.message}`}>
                                Câu {err.row}: {err.message}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </motion.div>
                  )}
              </>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-outline-variant/30 flex items-center justify-between gap-3 flex-shrink-0">
              <p className="text-xs text-on-surface-variant">
                {step === 'preview' && validQ.length > 0 && (
                  <span className="font-semibold text-violet-600">{validQ.length} câu hợp lệ sẵn sàng nhập</span>
                )}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  disabled={step === 'scanning'}
                  className="px-5 py-2.5 text-sm font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded-xl transition-colors disabled:opacity-40"
                >
                  {step === 'done' ? 'Đóng' : 'Hủy'}
                </button>

                {step === 'preview' && (
                  <button
                    onClick={handleImport}
                    disabled={importing || validQ.length === 0 || !categoryId || !grade}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50"
                  >
                    {importing
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang nhập...</>
                      : <><Sparkles className="w-4 h-4" /> Nhập {validQ.length} câu hỏi</>
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

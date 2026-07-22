import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Loader2,
  Plus,
  RotateCcw,
  Send,
  Trophy,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  listCourseAssignments,
  submitAssignment,
  uploadSubmissionFile,
  type StudentAssignmentResponse,
  type SubmissionFile,
} from '../../../api/assignmentService';
import { isApiError } from '../../../api/client';
import { notify } from '../../../lib/toast';

function assignmentAvailabilityMessage(assignment: StudentAssignmentResponse): string {
  switch (assignment.submissionAvailability) {
    case 'overdue':
      return 'Đã quá hạn và giáo viên không cho phép nộp muộn.';
    case 'late_allowed':
      return `Đã quá hạn nhưng vẫn được nộp; bài muộn bị trừ ${assignment.latePenaltyPercent}%.`;
    case 'closed':
      return 'Giáo viên đã đóng nhận bài.';
    case 'attempts_exhausted':
      return `Đã sử dụng hết ${assignment.maxAttempts} lần nộp.`;
    case 'graded':
      return 'Bài đã được chấm và không thể nộp lại.';
    default:
      return 'Đang trong thời gian nhận bài.';
  }
}

export default function CourseAssignmentsPanel({
  courseId,
  onProgressChanged,
}: {
  courseId: string;
  onProgressChanged?: () => Promise<void> | void;
}) {
  const [assignments, setAssignments] = useState<StudentAssignmentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openFormId, setOpenFormId] = useState<string | null>(null);
  const [contentInput, setContentInput] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listCourseAssignments(courseId)
      .then(data => {
        if (!cancelled) {
          setAssignments(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(isApiError(err) ? err.message : 'Không tải được danh sách bài tập');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  function openForm(assignment: StudentAssignmentResponse) {
    setOpenFormId(assignment.id);
    setContentInput(assignment.mySubmission?.content ?? '');
    setPendingFiles([]);
  }

  async function handleSubmit(assignmentId: string) {
    if (!contentInput.trim() && pendingFiles.length === 0) {
      notify.error('Bài nộp phải có nội dung hoặc file đính kèm');
      return;
    }
    const oversized = pendingFiles.find(file => file.size > 25 * 1024 * 1024);
    if (oversized) {
      notify.error(`File "${oversized.name}" vượt quá giới hạn 25MB.`);
      return;
    }
    setSubmitting(true);
    try {
      const uploadedFiles: SubmissionFile[] = [];
      for (const file of pendingFiles) {
        const uploaded = await uploadSubmissionFile(assignmentId, file);
        uploadedFiles.push({
          name: file.name,
          url: uploaded.publicUrl ?? uploaded.storagePath,
          type: uploaded.fileType,
          sizeBytes: uploaded.fileSizeBytes,
        });
      }
      const updated = await submitAssignment(assignmentId, contentInput.trim(), uploadedFiles);
      setAssignments(prev => prev.map(item => (item.id === assignmentId ? updated : item)));
      setOpenFormId(null);
      setContentInput('');
      setPendingFiles([]);
      await onProgressChanged?.();
      notify.success('Đã nộp bài tập');
    } catch (err: unknown) {
      notify.error(isApiError(err) ? err.message : 'Nộp bài thất bại, thử lại sau');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-on-surface-variant">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Đang tải bài tập...
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-2xl bg-error/10 text-error font-medium">
        <AlertCircle className="w-5 h-5 flex-shrink-0" /> {error}
      </div>
    );
  }
  if (assignments.length === 0) {
    return (
      <div className="text-center py-12 text-on-surface-variant">
        <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p className="font-medium">Khóa học này chưa có bài tập tự luận nào.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {assignments.map(assignment => {
        const submission = assignment.mySubmission;
        const isGraded = submission?.status === 'graded';
        const needsResubmit = submission?.status === 'resubmit';
        const dueLabel = assignment.dueAt
          ? new Date(assignment.dueAt).toLocaleString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
          })
          : null;
        const isFormOpen = openFormId === assignment.id;
        return (
          <div
            key={assignment.id}
            className="rounded-2xl border border-outline-variant/40 bg-surface-container overflow-hidden"
          >
            <div className="p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="font-bold text-on-surface">{assignment.title}</h4>
                  <p className="text-xs text-on-surface-variant mt-1 font-medium">
                    {assignment.chapterTitle ?? assignment.lessonTitle ?? 'Khóa học'}
                    {' · '}Điểm tối đa: {assignment.maxScore}
                    {dueLabel && <> {' · '}Hạn nộp: {dueLabel}</>}
                    {' · '}Lượt nộp: {submission?.attemptNumber ?? 0}/{assignment.maxAttempts}
                  </p>
                  {assignment.allowLateSubmission && (
                    <p className="mt-1 text-xs font-semibold text-amber-700">
                      Cho phép nộp muộn · Trừ {assignment.latePenaltyPercent}% điểm
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {!submission && assignment.submissionAvailability === 'open' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-surface-container-high text-on-surface-variant">
                      <Clock className="w-3.5 h-3.5" /> Chưa nộp
                    </span>
                  )}
                  {!submission && assignment.submissionAvailability === 'late_allowed' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700">
                      <Clock className="w-3.5 h-3.5" /> Quá hạn · Vẫn nhận
                    </span>
                  )}
                  {!submission && ['overdue', 'closed'].includes(assignment.submissionAvailability) && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-error/10 text-error">
                      <AlertCircle className="w-3.5 h-3.5" /> {assignment.submissionAvailability === 'closed' ? 'Đã đóng' : 'Quá hạn'}
                    </span>
                  )}
                  {submission && submission.status === 'pending' && (
                    <div className="text-right">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Chờ chấm
                      </span>
                      <p className="mt-1 text-[11px] font-semibold text-on-surface-variant">
                        Dự kiến trước {new Date(submission.expectedGradedBy).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                  )}
                  {needsResubmit && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-error/10 text-error">
                      <RotateCcw className="w-3.5 h-3.5" /> Cần nộp lại
                    </span>
                  )}
                  {isGraded && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                      <Trophy className="w-3.5 h-3.5" /> {submission.score}/{assignment.maxScore} điểm
                    </span>
                  )}
                </div>
              </div>

              {assignment.description && (
                <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-line">
                  {assignment.description}
                </p>
              )}

              {submission && (
                <div className="rounded-xl bg-surface-container-high p-4 space-y-2">
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">
                    Bài đã nộp lần {submission.attemptNumber}
                    {submission.late && (
                      <span className="text-error"> (trễ hạn, trừ {submission.appliedLatePenaltyPercent}%)</span>
                    )}
                  </p>
                  {submission.content && (
                    <p className="text-sm text-on-surface whitespace-pre-line">{submission.content}</p>
                  )}
                  {submission.files.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {submission.files.map((file, idx) => (
                        <a
                          key={idx}
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface text-xs font-semibold text-primary hover:underline"
                        >
                          <FileText className="w-3.5 h-3.5" /> {file.name ?? 'File đính kèm'}
                        </a>
                      ))}
                    </div>
                  )}
                  {isGraded && submission.feedback && (
                    <div className="pt-2 border-t border-outline-variant/30">
                      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1">
                        Nhận xét của giáo viên
                      </p>
                      <p className="text-sm text-on-surface whitespace-pre-line">{submission.feedback}</p>
                    </div>
                  )}
                </div>
              )}

              {!isGraded && !assignment.canSubmit && (
                <div className="flex items-center gap-2 rounded-xl bg-error/10 px-3 py-2 text-sm font-semibold text-error">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {assignmentAvailabilityMessage(assignment)}
                </div>
              )}

              {!isGraded && assignment.canSubmit && !isFormOpen && (
                <button
                  onClick={() => openForm(assignment)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-bold hover:opacity-90 transition-opacity"
                >
                  <Send className="w-4 h-4" />
                  {submission ? 'Nộp lại bài' : 'Nộp bài'}
                </button>
              )}

              {!isGraded && assignment.canSubmit && isFormOpen && (
                <div className="space-y-3 pt-2">
                  <textarea
                    value={contentInput}
                    onChange={event => setContentInput(event.target.value)}
                    rows={5}
                    placeholder="Nhập nội dung bài làm của em..."
                    className="w-full rounded-xl border border-outline-variant/50 bg-surface p-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <label className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-outline-variant/50 text-sm font-semibold text-on-surface-variant cursor-pointer hover:border-primary hover:text-primary transition-colors">
                      <Plus className="w-4 h-4" /> Chọn file (tối đa 5, mỗi file 25MB)
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.webp"
                        className="hidden"
                        onChange={event => {
                          const selected = Array.from(event.target.files ?? []);
                          const valid = selected.filter(file => {
                            if (file.size <= 25 * 1024 * 1024) return true;
                            notify.error(`File "${file.name}" vượt quá giới hạn 25MB.`);
                            return false;
                          });
                          setPendingFiles(prev => [...prev, ...valid].slice(0, 5));
                          event.target.value = '';
                        }}
                      />
                    </label>
                    {pendingFiles.map((file, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high text-xs font-semibold text-on-surface"
                      >
                        <FileText className="w-3.5 h-3.5" /> {file.name}
                        <button
                          onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))}
                          className="text-on-surface-variant hover:text-error"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleSubmit(assignment.id)}
                      disabled={submitting}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-primary text-on-primary text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {submitting ? 'Đang nộp...' : 'Xác nhận nộp'}
                    </button>
                    <button
                      onClick={() => setOpenFormId(null)}
                      disabled={submitting}
                      className="text-sm font-semibold text-on-surface-variant hover:text-on-surface"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

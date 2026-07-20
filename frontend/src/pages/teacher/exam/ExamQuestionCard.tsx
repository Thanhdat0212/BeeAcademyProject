import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Plus,
  Trash2
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import type { QuestionMetadata } from '../../../api/questionService';
import { notify } from '../../../lib/toast';
import type { Difficulty, ExamQuestion } from './examTypes';
import {
  formatPoints,
  isDirectExamQuestion,
  isManualExamType,
  isObjectiveExamType,
  questionTypeLabel,
} from './examUtils';

interface ExamQuestionCardProps {
  question: ExamQuestion;
  index: number;
  onChange: (q: ExamQuestion) => void;
  onDelete: () => void;
  onApproveAi?: () => void;
  onRejectAi?: () => void;
  hideHeader?: boolean;
}
export default function ExamQuestionCard({ question, index, onChange, onDelete, onApproveAi, onRejectAi, hideHeader = false }: ExamQuestionCardProps) {
  // Mặc định mở khi câu hỏi còn rỗng (mới tạo) để GV nhập luôn
  const [internalExpanded, setInternalExpanded] = useState(question.text === '');
  const isExpanded = hideHeader ? true : internalExpanded;

  // Config màu sắc cho difficulty — gói lại để dễ tra trong JSX
  const difficultyConfig: Record<Difficulty, { label: string; className: string }> = {
    easy:   { label: 'Dễ',         className: 'bg-green-500/10 text-green-600'   },
    medium: { label: 'Trung bình', className: 'bg-amber-500/10 text-amber-600'   },
    hard:   { label: 'Khó',        className: 'bg-red-500/10 text-red-600'       },
  };

  // ── Thêm 1 lựa chọn rỗng ────────────────────────────────────
  const aiStatus = question.metadata?.aiStatus;

  function addOption() {
    if (!isObjectiveExamType(question.type)) return;
    onChange({ ...question, options: [...question.options, ''] });
  }

  // ── Sửa nội dung 1 option ───────────────────────────────────
  function updateOption(optionIdx: number, value: string) {
    if (!isObjectiveExamType(question.type)) return;
    onChange({
      ...question,
      options: question.options.map((opt, i) => i === optionIdx ? value : opt),
    });
  }

  // ── Xóa 1 option ───────────────────────────────────────────
  // Ràng buộc: phải còn ≥ 2 lựa chọn
  // Sau khi xóa, các correctIndices phải được điều chỉnh:
  //   - bỏ index vừa xóa
  //   - giảm các index lớn hơn xuống 1 (vì array thu nhỏ)
  function removeOption(optionIdx: number) {
    if (!isObjectiveExamType(question.type)) return;
    if (question.options.length <= 2) {
      notify.error('Câu hỏi phải có ít nhất 2 lựa chọn');
      return;
    }
    const newOptions = question.options.filter((_, i) => i !== optionIdx);
    const newCorrect = question.correctIndices
      .filter(i => i !== optionIdx)
      .map(i => i > optionIdx ? i - 1 : i);
    onChange({ ...question, options: newOptions, correctIndices: newCorrect });
  }

  // ── Toggle đáp án đúng ─────────────────────────────────────
  // single: chỉ giữ 1 index → set [optionIdx]
  // multiple: toggle thêm/bỏ index
  function toggleCorrect(optionIdx: number) {
    if (!isObjectiveExamType(question.type)) return;
    if (question.type === 'true_false') {
      onChange({ ...question, correctIndices: [optionIdx] });
    } else {
      const isCorrect = question.correctIndices.includes(optionIdx);
      const newCorrect = isCorrect
        ? question.correctIndices.filter(i => i !== optionIdx)
        : [...question.correctIndices, optionIdx];
      onChange({ ...question, correctIndices: newCorrect });
    }
  }

  // ── Đổi loại câu hỏi ───────────────────────────────────────
  // Multiple → single: chỉ giữ đáp án đúng đầu tiên
  function changeDirectQuestionType(nextType: 'multiple_choice' | 'true_false' | 'essay') {
    const directMetadata: QuestionMetadata = {
      ...(question.metadata ?? {}),
      sourceType: 'direct_exam',
      createdInExam: true,
    };
    if (nextType === 'true_false') {
      onChange({
        ...question,
        type: nextType,
        options: ['Đúng', 'Sai'],
        correctIndices: [0],
        metadata: directMetadata,
      });
      return;
    }
    if (nextType === 'essay') {
      onChange({
        ...question,
        type: nextType,
        options: [],
        correctIndices: [],
        metadata: directMetadata,
      });
      return;
    }
    onChange({
      ...question,
      type: nextType,
      options: question.options.length >= 2 ? question.options : ['', '', '', ''],
      correctIndices: question.correctIndices.length > 0 ? question.correctIndices : [0],
      metadata: directMetadata,
    });
  }

  const canEditType = isDirectExamQuestion(question) && !question.metadata?.aiPromptId;

  return (
    <div className="border border-outline-variant/40 rounded-xl bg-surface-container/30 overflow-hidden">

      {/* Header card */}
      {!hideHeader && (
      <div className="flex items-center gap-2 px-4 py-3 bg-surface-container/50">
        <button
          onClick={() => setInternalExpanded(!isExpanded)}
          className="flex items-center gap-2 flex-1 text-left min-w-0"
        >
          {isExpanded ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 flex-shrink-0" />}
          <span className="font-bold text-on-surface text-sm flex-shrink-0">Câu {index + 1}</span>
          {!isExpanded && question.text && (
            <span className="text-sm text-on-surface-variant line-clamp-1">
              — {question.text}
            </span>
          )}
        </button>

        {/* Badge mức độ khó */}
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${difficultyConfig[question.difficulty].className}`}>
          {difficultyConfig[question.difficulty].label}
        </span>

        {/* Badge loại */}
        <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full whitespace-nowrap">
          {questionTypeLabel(question.type, question.correctIndices.length)}
        </span>

        <span className="text-xs font-bold text-on-surface-variant">{formatPoints(question.points)}đ</span>

        {aiStatus && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
            aiStatus === 'approved'
              ? 'bg-green-500/10 text-green-600'
              : aiStatus === 'rejected'
              ? 'bg-red-500/10 text-red-600'
              : 'bg-amber-500/10 text-amber-600'
          }`}>
            AI {aiStatus.toUpperCase()}
          </span>
        )}

        <button
          onClick={onDelete}
          title="Xóa câu hỏi"
          className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      )}

      {/* Body — chỉ render khi mở */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {aiStatus && (
                <div className={`rounded-xl border p-3 text-sm ${
                  aiStatus === 'approved'
                    ? 'border-green-200 bg-green-50 text-green-800'
                    : aiStatus === 'rejected'
                    ? 'border-red-200 bg-red-50 text-red-800'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                }`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-extrabold">
                        {aiStatus === 'approved'
                          ? 'Câu AI đã được duyệt'
                          : aiStatus === 'rejected'
                          ? 'Câu AI đã bị từ chối'
                          : 'Câu AI đang chờ review'}
                      </p>
                      {question.metadata?.rejectionReason && (
                        <p className="mt-1 text-xs font-semibold">{question.metadata.rejectionReason}</p>
                      )}
                      {question.metadata?.sourceRefs?.length ? (
                        <p className="mt-1 text-xs font-semibold">
                          Nguồn: {question.metadata.sourceRefs.join(', ')}
                        </p>
                      ) : null}
                    </div>
                    {aiStatus === 'draft' && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={onApproveAi}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={onRejectAi}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Nội dung câu hỏi */}
              {question.type === 'fill_in_blank' && (
                <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                    Đáp án chấp nhận
                  </p>
                  <p className="mt-2 text-sm text-on-surface">
                    {(question.metadata?.acceptedAnswers ?? []).join(', ') || 'Chưa có dữ liệu'}
                  </p>
                </div>
              )}

              {question.type === 'matching' && (
                <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                    Cặp nối
                  </p>
                  <div className="mt-2 space-y-2">
                    {(question.metadata?.matchingPairs ?? []).map((pair, pairIndex) => (
                      <div key={pairIndex} className="grid grid-cols-2 gap-2 rounded-lg border border-outline-variant/30 bg-surface px-3 py-2 text-sm text-on-surface">
                        <span>{pair.left}</span>
                        <span>{pair.right}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {question.metadata?.readingSetId && question.metadata?.sharedPrompt && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">
                    Bài đọc chung
                  </p>
                  <p className="text-sm text-on-surface">
                    Mã nhóm: {question.metadata.readingSetId}
                  </p>
                  {question.metadata.sharedPromptTitle && (
                    <p className="text-sm text-on-surface">
                      Tiêu đề: {question.metadata.sharedPromptTitle}
                    </p>
                  )}
                  {question.metadata.questionOrderInSet != null && (
                    <p className="text-sm text-on-surface">
                      Thứ tự câu: {question.metadata.questionOrderInSet}
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap text-on-surface">
                    {question.metadata.sharedPrompt}
                  </p>
                </div>
              )}

              {(question.type === 'essay'
                || question.type === 'essay_short'
                || question.type === 'essay_long'
                || question.type === 'file_upload') && (
                <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                    Thông tin chấm bài
                  </p>
                  {question.metadata?.sampleAnswer && (
                    <p className="text-sm text-on-surface whitespace-pre-wrap">
                      Đáp án mẫu: {question.metadata.sampleAnswer}
                    </p>
                  )}
                  {question.metadata?.wordLimit != null && (
                    <p className="text-sm text-on-surface">Giới hạn từ: {question.metadata.wordLimit}</p>
                  )}
                  {question.metadata?.gradingRubric && (
                    <p className="text-sm text-on-surface whitespace-pre-wrap">
                      Rubric: {question.metadata.gradingRubric}
                    </p>
                  )}
                  {question.metadata?.allowedUploadTypes?.length ? (
                    <p className="text-sm text-on-surface">
                      Loại file: {question.metadata.allowedUploadTypes.join(', ')}
                    </p>
                  ) : null}
                  {question.metadata?.maxFiles != null && (
                    <p className="text-sm text-on-surface">Số file tối đa: {question.metadata.maxFiles}</p>
                  )}
                </div>
              )}

              {(question.type === 'image_question' || question.type === 'audio_question') && question.metadata?.promptAssetUrl && (
                <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                    Tài nguyên đính kèm
                  </p>
                  <p className="mt-2 text-sm break-all text-on-surface">{question.metadata.promptAssetUrl}</p>
                  {question.type === 'audio_question' && question.metadata?.transcript && (
                    <p className="mt-2 text-sm whitespace-pre-wrap text-on-surface">{question.metadata.transcript}</p>
                  )}
                </div>
              )}

              {question.type === 'formula_question' && question.metadata?.formulaLatex && (
                <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                    Công thức
                  </p>
                  <p className="mt-2 text-sm break-all text-on-surface">{question.metadata.formulaLatex}</p>
                </div>
              )}

              <label className="block">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                  Nội dung câu hỏi <span className="text-red-500">*</span>
                </span>
                <textarea
                  value={question.text}
                  onChange={e => onChange({ ...question, text: e.target.value })}
                  placeholder="Nhập nội dung câu hỏi..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant resize-none"
                />
              </label>

              {/* Loại + Mức độ + Điểm (3 cột) */}
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                    Loại câu hỏi
                  </span>
                  <select
                    value={question.type}
                    disabled={!canEditType}
                    onChange={e => changeDirectQuestionType(e.target.value as 'multiple_choice' | 'true_false' | 'essay')}
                    className="w-full px-3 py-2 text-sm bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                  >
                    {canEditType ? (
                      <>
                        <option value="multiple_choice">Trắc nghiệm</option>
                        <option value="true_false">Đúng / Sai</option>
                        <option value="essay">Tự luận</option>
                      </>
                    ) : (
                      <option value={question.type}>{questionTypeLabel(question.type, question.correctIndices.length)}</option>
                    )}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                    Mức độ
                  </span>
                  <select
                    value={question.difficulty}
                    onChange={e => onChange({ ...question, difficulty: e.target.value as Difficulty })}
                    className="w-full px-3 py-2 text-sm bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                  >
                    <option value="easy">Dễ</option>
                    <option value="medium">Trung bình</option>
                    <option value="hard">Khó</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                    Điểm
                  </span>
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={question.points}
                    onChange={e => onChange({ ...question, points: parseFloat(e.target.value) || 0.01 })}
                    className="w-full px-3 py-2 text-sm bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                  />
                </label>
              </div>

              {/* Lựa chọn + Đáp án đúng */}
              {isObjectiveExamType(question.type) && (
              <div>
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                  Lựa chọn & đáp án đúng
                  <span className="text-on-surface-variant/70 font-normal normal-case ml-2">
                    (click vào ô tròn/vuông để chọn đáp án đúng)
                  </span>
                </span>
                <div className="space-y-2">
                  {question.options.map((opt, optIdx) => {
                    const isCorrect = question.correctIndices.includes(optIdx);
                    return (
                      <div key={optIdx} className="flex items-center gap-2">
                        {/* Nút chọn đáp án đúng — radio (single) hoặc checkbox (multiple) */}
                        <button
                          onClick={() => toggleCorrect(optIdx)}
                          title={isCorrect ? 'Đáp án đúng' : 'Click để chọn làm đáp án đúng'}
                          className={`flex-shrink-0 w-7 h-7 ${question.type === 'multiple_choice' ? 'rounded-md' : 'rounded-full'} flex items-center justify-center transition-colors ${
                            isCorrect
                              ? 'bg-green-500 text-white'
                              : 'bg-surface-container-lowest border border-outline-variant hover:border-green-500'
                          }`}
                        >
                          {isCorrect
                            ? <CheckCircle2 className="w-4 h-4" />
                            : <Circle className="w-4 h-4 opacity-30" />}
                        </button>

                        <span className="text-sm font-bold text-on-surface-variant w-5 flex-shrink-0">
                          {String.fromCharCode(65 + optIdx)}.
                        </span>

                        <input
                          type="text"
                          value={opt}
                          onChange={e => updateOption(optIdx, e.target.value)}
                          placeholder={`Lựa chọn ${String.fromCharCode(65 + optIdx)}`}
                          className="flex-1 px-3 py-2 text-sm bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant"
                        />

                        {question.options.length > 2 && (
                          <button
                            onClick={() => removeOption(optIdx)}
                            title="Xóa lựa chọn"
                            className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors flex-shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {question.options.length < 6 && (
                  <button
                    onClick={addOption}
                    className="mt-2 flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Thêm lựa chọn
                  </button>
                )}
              </div>
              )}

              {/* Giải thích / barem */}
              <label className="block">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                  {isManualExamType(question.type) ? 'Barem chấm' : 'Lời giải thích'}
                  <span className={`font-normal normal-case ml-1 ${isManualExamType(question.type) ? 'text-red-500' : 'text-on-surface-variant/70'}`}>
                    {isManualExamType(question.type) ? '*' : '(tùy chọn)'}
                  </span>
                </span>
                <textarea
                  value={question.explanation ?? ''}
                  onChange={e => onChange({ ...question, explanation: e.target.value })}
                  placeholder={isManualExamType(question.type) ? 'Nhập tiêu chí chấm hoặc đáp án mẫu...' : 'VD: Đáp án B vì...'}
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant resize-none"
                />
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 5 — MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

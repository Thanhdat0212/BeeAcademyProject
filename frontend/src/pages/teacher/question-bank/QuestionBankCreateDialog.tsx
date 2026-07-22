import {
  ChevronDown,
  Loader2,
  Save,
  X
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { isApiError } from '../../../api/client';
import type { QuestionBankResponse } from '../../../api/questionBankService';
import * as questionBankService from '../../../api/questionBankService';
import { notify } from '../../../lib/toast';
import type { Category } from '../../../types/api';

export default function QuestionBankCreateDialog({
  open,
  categories,
  onClose,
  onCreated,
}: {
  open: boolean;
  categories: Category[];
  onClose: () => void;
  onCreated: (bank: QuestionBankResponse) => void;
}) {
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [grade, setGrade] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setCategoryId('');
    setGrade('');
    setDescription('');
    setSaving(false);
  }, [open]);

  async function handleSave() {
    if (!title.trim()) {
      notify.error('Vui lòng nhập tên ngân hàng câu hỏi');
      return;
    }
    if (!categoryId) {
      notify.error('Vui lòng chọn lĩnh vực / môn học');
      return;
    }
    if (!grade) {
      notify.error('Vui lòng chọn lớp');
      return;
    }

    setSaving(true);
    try {
      const created = await questionBankService.createQuestionBank({
        title: title.trim(),
        categoryId,
        grade: Number(grade),
        description: description.trim() || undefined,
      });
      notify.success('Đã tạo ngân hàng câu hỏi');
      onCreated(created);
      onClose();
    } catch (error) {
      notify.error(isApiError(error) ? error.message : 'Không tạo được ngân hàng câu hỏi');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={saving ? undefined : onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="fixed z-50 top-1/2 left-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-surface p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h3 className="text-xl font-extrabold text-on-surface">Tạo ngân hàng câu hỏi</h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  Khởi tạo bank rỗng để tiếp tục bổ sung câu hỏi ở bước sau.
                </p>
              </div>
              <button
                onClick={onClose}
                disabled={saving}
                className="p-2 rounded-xl hover:bg-surface-container text-on-surface-variant disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-on-surface mb-1.5">
                  Tên ngân hàng <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ví dụ: Ngân hàng Toán lớp 8 - Đại số"
                  className="w-full px-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1.5">
                    Lĩnh vực / môn học <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={categoryId}
                      onChange={e => setCategoryId(e.target.value)}
                      className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary"
                    >
                      <option value="">-- Chọn môn học --</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1.5">
                    Lớp <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={grade}
                      onChange={e => setGrade(e.target.value)}
                      className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary"
                    >
                      <option value="">-- Chọn lớp --</option>
                      {[6, 7, 8, 9].map(item => <option key={item} value={item}>Lớp {item}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-on-surface mb-1.5">
                  Mô tả <span className="text-xs font-normal text-on-surface-variant">(tùy chọn)</span>
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Mô tả phạm vi câu hỏi, mục tiêu sử dụng hoặc ghi chú biên soạn..."
                  className="w-full px-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl text-on-surface focus:outline-none focus:border-primary resize-none"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={onClose}
                disabled={saving}
                className="flex-1 py-2.5 text-sm font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded-xl disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 text-sm font-bold bg-primary text-on-primary rounded-xl hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Đang tạo...' : 'Tạo ngân hàng'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Main page

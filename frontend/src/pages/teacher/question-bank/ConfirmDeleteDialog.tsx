import {
  Trash2
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  QuestionResponse
} from '../../../api/questionService';

import { truncate } from './questionBankUtils';
export default function ConfirmDeleteDialog({
  question, onConfirm, onCancel,
}: { question: QuestionResponse | null; onConfirm: () => void; onCancel: () => void }) {
  return (
    <AnimatePresence>
      {question && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm"
          >
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-center font-extrabold text-on-surface mb-2">Xóa câu hỏi?</h3>
            <p className="text-center text-sm text-on-surface-variant mb-5">
              "{truncate(question.content, 80)}"
            </p>
            <div className="flex gap-3">
              <button onClick={onCancel} className="flex-1 py-2.5 text-sm font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded-xl">
                Hủy
              </button>
              <button onClick={onConfirm} className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl">
                Xóa
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

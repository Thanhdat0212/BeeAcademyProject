import {
  Loader2,
  Trash2
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export default function ConfirmBulkDeleteDialog({
  count, deleting, onConfirm, onCancel,
}: { count: number; deleting: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={deleting ? undefined : onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface rounded-2xl shadow-2xl p-6 w-full max-w-sm"
          >
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-center font-extrabold text-on-surface mb-2">Xóa câu hỏi đã chọn?</h3>
            <p className="text-center text-sm text-on-surface-variant mb-5">
              Bạn đang chọn <span className="font-bold text-on-surface">{count}</span> câu hỏi. Thao tác này sẽ xóa hoặc tạm ẩn câu hỏi đã được dùng.
            </p>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                disabled={deleting}
                className="flex-1 py-2.5 text-sm font-bold text-on-surface-variant bg-surface-container hover:bg-surface-container-high rounded-xl disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={onConfirm}
                disabled={deleting}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {deleting ? 'Đang xóa...' : 'Xóa tất cả'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

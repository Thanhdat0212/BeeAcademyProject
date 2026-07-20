import {
  Loader2,
  X
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  QuestionAuditLogResponse,
  QuestionResponse,
  QuestionVersionResponse
} from '../../../api/questionService';

import { formatDate, truncate } from './questionBankUtils';
export default function QuestionHistoryDialog({
  question,
  versions,
  audits,
  loading,
  onClose,
}: {
  question: QuestionResponse | null;
  versions: QuestionVersionResponse[];
  audits: QuestionAuditLogResponse[];
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {question && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
            className="fixed z-50 top-1/2 left-1/2 w-full max-w-3xl max-h-[82vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-surface shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-outline-variant/30 px-5 py-4">
              <div>
                <h3 className="font-extrabold text-on-surface">Lịch sử câu hỏi</h3>
                <p className="mt-0.5 text-xs text-on-surface-variant">{truncate(question.content, 90)}</p>
              </div>
              <button onClick={onClose} className="rounded-xl p-2 text-on-surface-variant hover:bg-surface-container">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid max-h-[68vh] grid-cols-1 gap-5 overflow-y-auto p-5 md:grid-cols-2">
              {loading ? (
                <div className="md:col-span-2 flex items-center justify-center py-12 text-primary">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <>
                  <section>
                    <h4 className="mb-3 text-sm font-extrabold text-on-surface">Phiên bản</h4>
                    <div className="space-y-2">
                      {versions.length === 0 ? (
                        <p className="text-sm text-on-surface-variant">Chưa có phiên bản.</p>
                      ) : versions.map(version => (
                        <div key={version.id} className="rounded-xl border border-outline-variant/40 bg-surface-container/40 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-extrabold text-on-surface">v{version.versionNo}</span>
                            <span className="text-xs text-on-surface-variant">{formatDate(version.createdAt)}</span>
                          </div>
                          <p className="mt-2 text-sm text-on-surface">{truncate(version.content, 120)}</p>
                          <p className="mt-1 text-xs text-on-surface-variant">
                            {[version.defaultPoints != null ? `${version.defaultPoints} điểm` : null, version.tags?.map(tag => `#${tag}`).join(' ')].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section>
                    <h4 className="mb-3 text-sm font-extrabold text-on-surface">Audit log</h4>
                    <div className="space-y-2">
                      {audits.length === 0 ? (
                        <p className="text-sm text-on-surface-variant">Chưa có audit log.</p>
                      ) : audits.map(audit => (
                        <div key={audit.id} className="rounded-xl border border-outline-variant/40 bg-surface-container/40 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-extrabold text-primary">{audit.action}</span>
                            <span className="text-xs text-on-surface-variant">{formatDate(audit.createdAt)}</span>
                          </div>
                          <p className="mt-1 text-xs text-on-surface-variant">
                            v{audit.oldVersion ?? '-'} → v{audit.newVersion ?? '-'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

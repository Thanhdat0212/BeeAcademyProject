/**
 * ComplaintsInbox — Tab "Hộp thư khiếu nại" của Admin (UC38).
 *
 * Layout Split-View:
 *   - Cột trái (~33%): danh sách ticket (lọc trạng thái + tìm kiếm), click để chọn.
 *   - Cột phải (~67%): chi tiết thread đang chọn — nội dung, lịch sử trao đổi,
 *     ô phản hồi và các nút đổi trạng thái (Đang xử lý / Giải quyết / Từ chối).
 *
 * Dữ liệu thật từ /api/admin/complaints.
 */

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Inbox, Search, Filter, Send, Loader2, Clock, MessageSquare,
  CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react';
import { notify } from '../../lib/toast';
import {
  getAdminComplaints, getAdminComplaint, adminReplyComplaint, adminUpdateComplaintStatus,
  CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS,
  type ComplaintSummary, type ComplaintDetail, type ComplaintStatus,
  type ComplaintPriority, type ComplaintMessage,
} from '../../api/complaintService';
import { formatDateTime, formatRelativeTime } from './format';

export default function ComplaintsInbox({ onStatsChange }: { onStatsChange?: () => void }) {
  const [list, setList] = useState<ComplaintSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ComplaintDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const page = await getAdminComplaints({
        status: statusFilter === 'all' ? '' : statusFilter,
        search: debouncedSearch,
      });
      setList(page.items);
    } catch {
      notify.error('Không tải được danh sách khiếu nại');
    } finally {
      setLoadingList(false);
    }
  }, [statusFilter, debouncedSearch]);

  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const selectComplaint = useCallback(async (id: string) => {
    setSelectedId(id);
    setLoadingDetail(true);
    try {
      setDetail(await getAdminComplaint(id));
    } catch {
      notify.error('Không tải được chi tiết khiếu nại');
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  // Đồng bộ 1 ticket trong list từ detail mới nhất (sau reply / đổi trạng thái).
  function syncListRow(updated: ComplaintDetail) {
    setList(prev => prev.map(c => (c.id === updated.id
      ? { ...c, status: updated.status, lastActivityAt: updated.lastActivityAt }
      : c)));
    onStatsChange?.();
  }

  async function handleReply(content: string) {
    if (!detail) return;
    const updated = await adminReplyComplaint(detail.id, content);
    setDetail(updated);
    syncListRow(updated);
  }

  async function handleChangeStatus(status: Exclude<ComplaintStatus, 'pending'>) {
    if (!detail) return;
    try {
      const updated = await adminUpdateComplaintStatus(detail.id, status);
      setDetail(updated);
      syncListRow(updated);
      notify.success(`Đã chuyển trạng thái: ${STATUS_LABELS[status]}`);
    } catch {
      notify.error('Không cập nhật được trạng thái');
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* ── CỘT TRÁI: danh sách ticket ─────────────────────────────── */}
      <div className="lg:col-span-1 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-outline-variant/20 space-y-3">
          <h3 className="font-extrabold text-on-surface flex items-center gap-2">
            <Inbox className="w-4 h-4 text-primary" />
            Khiếu nại ({list.length})
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Tìm tiêu đề / người gửi..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as ComplaintStatus | 'all')}
              className="w-full pl-3 pr-8 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-sm font-semibold focus:outline-none appearance-none cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">Chờ xử lý</option>
              <option value="in_progress">Đang xử lý</option>
              <option value="resolved">Đã giải quyết</option>
              <option value="rejected">Đã từ chối</option>
            </select>
            <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant pointer-events-none" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[640px]">
          {loadingList ? (
            <div className="flex items-center justify-center py-12 text-on-surface-variant gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary" /> Đang tải...
            </div>
          ) : list.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-12">Không có khiếu nại nào.</p>
          ) : (
            <div className="p-2 space-y-1.5">
              {list.map(c => (
                <button
                  key={c.id}
                  onClick={() => selectComplaint(c.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${
                    c.id === selectedId
                      ? 'bg-primary/10 border-primary/30'
                      : 'bg-surface-container/30 border-outline-variant/20 hover:bg-surface-container/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className={`font-bold text-sm line-clamp-2 flex-1 ${c.id === selectedId ? 'text-primary' : 'text-on-surface'}`}>
                      {c.title}
                    </p>
                    <PriorityBadge priority={c.priority} />
                  </div>
                  <p className="text-xs text-on-surface-variant mb-2">
                    {c.senderName} · {CATEGORY_LABELS[c.category]}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={c.status} />
                    <span className="text-xs text-on-surface-variant">{formatRelativeTime(c.lastActivityAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── CỘT PHẢI: chi tiết thread ──────────────────────────────── */}
      <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-sm">
        {!selectedId ? (
          <EmptyDetail />
        ) : loadingDetail || !detail ? (
          <div className="flex items-center justify-center py-24 text-on-surface-variant gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" /> Đang tải chi tiết...
          </div>
        ) : (
          <ComplaintThread
            detail={detail}
            onReply={handleReply}
            onChangeStatus={handleChangeStatus}
          />
        )}
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function EmptyDetail() {
  return (
    <div className="text-center py-24 px-6">
      <Inbox className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
      <p className="text-on-surface-variant">Chọn một khiếu nại bên trái để xem chi tiết và phản hồi.</p>
    </div>
  );
}

function ComplaintThread({ detail, onReply, onChangeStatus }: {
  detail: ComplaintDetail;
  onReply: (content: string) => Promise<void>;
  onChangeStatus: (status: Exclude<ComplaintStatus, 'pending'>) => Promise<void>;
}) {
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const isClosed = detail.status === 'resolved' || detail.status === 'rejected';

  async function submitReply() {
    const content = reply.trim();
    if (!content) {
      notify.error('Vui lòng nhập nội dung phản hồi');
      return;
    }
    setSending(true);
    try {
      await onReply(content);
      setReply('');
      notify.success('Đã gửi phản hồi');
    } catch {
      notify.error('Không gửi được phản hồi');
    } finally {
      setSending(false);
    }
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div key={detail.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col h-full">
        {/* Header */}
        <div className="px-5 py-4 border-b border-outline-variant/30">
          <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
            <h3 className="font-extrabold text-on-surface flex-1 min-w-0">{detail.title}</h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              <PriorityBadge priority={detail.priority} />
              <StatusBadge status={detail.status} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-on-surface-variant flex-wrap">
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              {CATEGORY_LABELS[detail.category]}
            </span>
            <span>·</span>
            <span className="font-semibold text-on-surface">{detail.senderName}</span>
            <span>·</span>
            <span>Gửi lúc {formatDateTime(detail.createdAt)}</span>
          </div>
        </div>

        {/* Thread */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[380px] flex-1">
          {detail.messages.map(m => <MessageBubble key={m.id} message={m} />)}
        </div>

        {/* Nút đổi trạng thái */}
        <div className="px-5 py-3 border-t border-outline-variant/20 flex flex-wrap gap-2">
          <button
            onClick={() => onChangeStatus('in_progress')}
            disabled={detail.status === 'in_progress'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors disabled:opacity-40"
          >
            <MessageSquare className="w-3.5 h-3.5" /> Đang xử lý
          </button>
          <button
            onClick={() => onChangeStatus('resolved')}
            disabled={detail.status === 'resolved'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors disabled:opacity-40"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Đã giải quyết
          </button>
          <button
            onClick={() => onChangeStatus('rejected')}
            disabled={detail.status === 'rejected'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors disabled:opacity-40"
          >
            <XCircle className="w-3.5 h-3.5" /> Từ chối
          </button>
        </div>

        {/* Ô phản hồi */}
        {isClosed ? (
          <div className="px-5 py-4 border-t border-outline-variant/30 bg-surface-container/30">
            <p className="text-sm text-on-surface-variant text-center">
              Khiếu nại này đã đóng. Bấm "Đang xử lý" để mở lại nếu cần.
            </p>
          </div>
        ) : (
          <div className="px-5 py-4 border-t border-outline-variant/30">
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              placeholder="Nhập nội dung phản hồi cho người gửi..."
              rows={3}
              className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant/30 rounded-xl focus:outline-none focus:border-primary resize-none mb-3"
            />
            <div className="flex justify-end">
              <button
                onClick={submitReply}
                disabled={sending}
                className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-on-primary text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20 disabled:opacity-60"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Gửi phản hồi
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function MessageBubble({ message }: { message: ComplaintMessage }) {
  const isAdmin = message.authorRole === 'admin';
  return (
    <div className={`flex gap-2 ${isAdmin ? 'flex-row-reverse' : 'flex-row'}`}>
      <img
        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(message.authorName)}&size=36&background=${isAdmin ? 'ad2c00' : '7c3aed'}&color=fff&bold=true`}
        alt={message.authorName}
        className="w-8 h-8 rounded-full flex-shrink-0"
      />
      <div className={`flex flex-col max-w-[75%] ${isAdmin ? 'items-end' : 'items-start'}`}>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-xs font-bold text-on-surface">{message.authorName}</span>
          <span className="text-xs text-on-surface-variant">{formatRelativeTime(message.sentAt)}</span>
        </div>
        <div className={`px-4 py-2.5 rounded-2xl text-sm ${
          isAdmin
            ? 'bg-primary/10 text-on-surface rounded-tr-sm border border-primary/20'
            : 'bg-surface-container text-on-surface rounded-tl-sm'
        }`}>
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ComplaintStatus }) {
  const config: Record<ComplaintStatus, { icon: React.ReactNode; className: string }> = {
    pending:     { icon: <Clock className="w-3.5 h-3.5" />,         className: 'bg-amber-500/10 text-amber-600' },
    in_progress: { icon: <MessageSquare className="w-3.5 h-3.5" />, className: 'bg-blue-500/10 text-blue-600' },
    resolved:    { icon: <CheckCircle2 className="w-3.5 h-3.5" />,  className: 'bg-green-500/10 text-green-600' },
    rejected:    { icon: <XCircle className="w-3.5 h-3.5" />,       className: 'bg-red-500/10 text-red-600' },
  };
  const { icon, className } = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap ${className}`}>
      {icon}{STATUS_LABELS[status]}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: ComplaintPriority }) {
  const className: Record<ComplaintPriority, string> = {
    low: 'bg-on-surface-variant/10 text-on-surface-variant',
    medium: 'bg-amber-500/10 text-amber-600',
    high: 'bg-red-500/10 text-red-600',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${className[priority]}`}>
      {priority === 'high' && <AlertTriangle className="w-3 h-3" />}
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

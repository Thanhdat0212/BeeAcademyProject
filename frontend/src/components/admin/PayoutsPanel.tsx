/**
 * PayoutsPanel — Tab "Kế toán & Lương" của Admin (UC37 / UC39 / UC40).
 *
 * Dữ liệu thật từ /api/admin/payouts: mỗi dòng là một kỳ thanh toán
 * (1 giáo viên / 1 tháng) kèm TK ngân hàng + tổng tiền lấy từ revenue_splits.
 *
 * Gồm: 3 thẻ thống kê → bộ lọc (tìm tên GV + trạng thái) → bảng đối soát
 * → xuất CSV (UC39) → modal xác nhận chuyển khoản (UC40).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Wallet, Calculator, TrendingUp, Search, Filter, Download,
  Hash, Calendar, X, Loader2,
} from 'lucide-react';
import { notify } from '../../lib/toast';
import {
  getAdminPayouts, getAdminPayoutStats, confirmPayout,
  type AdminPayoutRow, type AdminPayoutStats,
} from '../../api/adminService';
import { formatVnd, formatDate, formatMonthYear } from './format';

type StatusFilter = 'all' | 'paid' | 'pending' | 'overdue';

export default function PayoutsPanel() {
  const [rows, setRows] = useState<AdminPayoutRow[]>([]);
  const [stats, setStats] = useState<AdminPayoutStats | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [modalRow, setModalRow] = useState<AdminPayoutRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [payouts, payoutStats] = await Promise.all([
        getAdminPayouts(),
        getAdminPayoutStats(),
      ]);
      setRows(payouts);
      setStats(payoutStats);
    } catch {
      notify.error('Không tải được dữ liệu kế toán');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      const matchSearch = r.teacherName.toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'paid' && r.status === 'PAID') ||
        (statusFilter === 'overdue' && r.overdue) ||
        (statusFilter === 'pending' && r.status !== 'PAID' && !r.overdue);
      return matchSearch && matchStatus;
    });
  }, [rows, search, statusFilter]);

  // Cập nhật 1 dòng tại chỗ sau khi xác nhận chuyển khoản — tránh refetch toàn bộ.
  function handleConfirmed(updated: AdminPayoutRow) {
    setRows(prev => prev.map(r => (r.periodId === updated.periodId ? updated : r)));
    setModalRow(null);
    getAdminPayoutStats().then(setStats).catch(() => {});
  }

  function handleExportCSV() {
    if (rows.length === 0) {
      notify.error('Không có dữ liệu để xuất');
      return;
    }
    const headers = [
      'Kỳ', 'Giáo viên', 'Ngân hàng', 'Số tài khoản', 'Chủ tài khoản',
      'Doanh thu (đ)', 'Phí nền tảng (đ)', 'Thực nhận (đ)', 'Trạng thái',
    ];
    const statusText = (r: AdminPayoutRow) =>
      r.status === 'PAID' ? 'Đã thanh toán' : r.overdue ? 'Trễ hạn' : 'Chờ thanh toán';
    const lines = rows.map(r => [
      r.monthYear,
      r.teacherName,
      r.bankName ?? '',
      // Dấu nháy đầu để Excel không đổi số TK dài thành ký hiệu khoa học.
      r.accountNumber ? `'${r.accountNumber}` : '',
      r.accountHolder ?? '',
      r.totalGross,
      r.platformFee,
      r.teacherAmount,
      statusText(r),
    ]);
    const csv = '﻿' + [headers, ...lines].map(row => row.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bao_Cao_Doi_Soat_GV_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notify.success('Đã xuất báo cáo đối soát');
  }

  return (
    <div className="space-y-6">
      {/* 3 thẻ thống kê */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Tổng doanh thu tháng này"
          value={stats ? formatVnd(stats.currentMonthGross) : '…'}
          icon={<TrendingUp className="w-5 h-5" />}
          tone="green"
          hint="Doanh thu phát sinh trong tháng hiện tại"
        />
        <StatCard
          label="Tiền chờ đối soát cho GV"
          value={stats ? formatVnd(stats.pendingTeacherAmount) : '…'}
          icon={<Calculator className="w-5 h-5" />}
          tone="primary"
          hint="Phần giáo viên các kỳ chưa chuyển khoản"
        />
        <StatCard
          label="Lợi nhuận ròng nền tảng"
          value={stats ? formatVnd(stats.netPlatformFee) : '…'}
          icon={<Wallet className="w-5 h-5" />}
          tone="blue"
          hint="Tổng phí nền tảng giữ lại (all-time)"
        />
      </div>

      {/* Bảng đối soát */}
      <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold">Đối soát & chuyển lương cho giáo viên</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Xuất báo cáo (Excel/CSV) và xác nhận chuyển khoản ngân hàng thủ công cho từng kỳ.
            </p>
          </div>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-xl text-xs font-bold transition-colors"
          >
            <Download className="w-4 h-4" />
            Xuất báo cáo CSV
          </button>
        </div>

        {/* Bộ lọc */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Tìm theo tên giáo viên..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="pl-3 pr-8 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-sm font-semibold focus:outline-none appearance-none cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="paid">Đã thanh toán</option>
              <option value="pending">Chờ thanh toán</option>
              <option value="overdue">Trễ hạn</option>
            </select>
            <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant pointer-events-none" />
          </div>
        </div>

        {/* Bảng */}
        <div className="overflow-x-auto border border-outline-variant/20 rounded-xl">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-outline-variant/20 bg-surface-container-low/50">
                <th className="px-6 py-3 font-bold text-on-surface-variant text-xs uppercase">Giáo viên / Số tài khoản</th>
                <th className="px-4 py-3 font-bold text-on-surface-variant text-xs uppercase">Kỳ</th>
                <th className="px-4 py-3 font-bold text-on-surface-variant text-xs uppercase">Doanh thu kỳ</th>
                <th className="px-4 py-3 font-bold text-on-surface-variant text-xs uppercase">Thực nhận (70%)</th>
                <th className="px-4 py-3 font-bold text-on-surface-variant text-xs uppercase">Trạng thái</th>
                <th className="px-6 py-3 font-bold text-on-surface-variant text-xs uppercase text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">
                    <Loader2 className="w-5 h-5 animate-spin inline mr-2 text-primary" />
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-on-surface-variant">
                    Không có kỳ đối soát nào khớp bộ lọc.
                  </td>
                </tr>
              ) : (
                filtered.map(r => (
                  <tr key={r.periodId} className="border-b border-outline-variant/10 hover:bg-surface-container/20 transition-colors">
                    <td className="px-6 py-3.5">
                      <p className="font-bold text-on-surface">{r.teacherName}</p>
                      {r.bankName ? (
                        <p className="text-xs text-on-surface-variant font-medium">
                          {r.bankName} · <span className="font-mono text-on-surface font-semibold">{r.accountNumber}</span>
                          {r.accountHolder ? ` (${r.accountHolder})` : ''}
                        </p>
                      ) : (
                        <p className="text-xs text-red-500 font-medium">Chưa cập nhật TK ngân hàng</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-on-surface-variant font-medium whitespace-nowrap">{formatMonthYear(r.monthYear)}</td>
                    <td className="px-4 py-3.5 text-on-surface-variant font-medium">{formatVnd(r.totalGross)}</td>
                    <td className="px-4 py-3.5 font-extrabold text-on-surface">{formatVnd(r.teacherAmount)}</td>
                    <td className="px-4 py-3.5"><PayoutStatusBadge row={r} /></td>
                    <td className="px-6 py-3.5 text-right">
                      {r.status === 'PAID' ? (
                        <div className="text-xs text-on-surface-variant font-semibold">
                          <p className="text-green-600 font-bold">Đã chuyển: {formatDate(r.paidAt)}</p>
                          {r.transferRef && <p className="font-mono text-[10px] mt-0.5">Mã: {r.transferRef}</p>}
                        </div>
                      ) : (
                        <button
                          onClick={() => setModalRow(r)}
                          disabled={!r.bankName}
                          title={!r.bankName ? 'GV chưa có TK ngân hàng' : undefined}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Xác nhận chuyển
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalRow && (
        <ConfirmPayoutModal
          row={modalRow}
          onClose={() => setModalRow(null)}
          onConfirmed={handleConfirmed}
        />
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

const TONE_CLASSES = {
  green: 'bg-green-500/10 text-green-600',
  primary: 'bg-primary/10 text-primary',
  blue: 'bg-blue-500/10 text-blue-600',
} as const;

function StatCard({ label, value, icon, tone, hint }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: keyof typeof TONE_CLASSES;
  hint: string;
}) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-3">
        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{label}</span>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${TONE_CLASSES[tone]}`}>{icon}</div>
      </div>
      <p className="text-2xl font-extrabold text-on-surface">{value}</p>
      <p className="text-xs text-on-surface-variant mt-2 font-medium">{hint}</p>
    </div>
  );
}

function PayoutStatusBadge({ row }: { row: AdminPayoutRow }) {
  if (row.status === 'PAID') {
    return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Đã thanh toán</span>;
  }
  if (row.overdue) {
    return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 animate-pulse">Trễ hạn</span>;
  }
  return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">Chờ thanh toán</span>;
}

function ConfirmPayoutModal({ row, onClose, onConfirmed }: {
  row: AdminPayoutRow;
  onClose: () => void;
  onConfirmed: (updated: AdminPayoutRow) => void;
}) {
  const [transferRef, setTransferRef] = useState('');
  const [transferContent, setTransferContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!transferRef.trim()) {
      notify.error('Vui lòng nhập mã giao dịch ngân hàng');
      return;
    }
    setSubmitting(true);
    try {
      const updated = await confirmPayout(row.periodId, {
        transferRef: transferRef.trim(),
        transferContent: transferContent.trim() || undefined,
      });
      notify.success(`Đã xác nhận chuyển ${formatVnd(row.teacherAmount)} cho ${row.teacherName}`);
      onConfirmed(updated);
    } catch {
      notify.error('Không xác nhận được — vui lòng thử lại');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl w-full max-w-md p-6 shadow-2xl z-10 relative"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/10 text-green-600 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-on-surface">Xác nhận chuyển khoản</h3>
              <p className="text-[11px] text-on-surface-variant font-medium">Lưu biên lai giao dịch lương GV.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-on-surface-variant hover:bg-surface-container rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="my-4 p-3 bg-surface-container-low rounded-2xl border border-outline-variant/15 space-y-1 text-xs">
          <p className="font-semibold text-on-surface">Giáo viên: <span className="font-bold">{row.teacherName}</span></p>
          <p className="font-semibold text-on-surface">Kỳ: <span className="font-bold">{formatMonthYear(row.monthYear)}</span></p>
          <p className="font-semibold text-on-surface">Ngân hàng: <span className="font-bold">{row.bankName ?? '—'}</span></p>
          <p className="font-semibold text-on-surface">Số tài khoản: <span className="font-mono font-bold text-primary">{row.accountNumber ?? '—'}</span></p>
          <p className="font-semibold text-on-surface">Số tiền cần chuyển: <span className="font-black text-green-600 text-sm">{formatVnd(row.teacherAmount)}</span></p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-on-surface-variant uppercase flex items-center gap-1">
              <Hash className="w-3.5 h-3.5" />
              Mã giao dịch ngân hàng (Ref No.)
            </label>
            <input
              type="text"
              required
              placeholder="Ví dụ: FT2606987163"
              value={transferRef}
              onChange={e => setTransferRef(e.target.value)}
              className="w-full px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-xl text-sm focus:outline-none focus:border-primary font-mono font-bold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-on-surface-variant uppercase flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Nội dung / Ghi chú đối soát
            </label>
            <textarea
              rows={2}
              placeholder="Ghi chú thêm nếu có..."
              value={transferContent}
              onChange={e => setTransferContent(e.target.value)}
              className="w-full px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-xl text-sm focus:outline-none focus:border-primary resize-none"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold shadow-md transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Xác nhận đã chuyển
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest rounded-xl text-sm font-bold transition-colors"
            >
              Đóng
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

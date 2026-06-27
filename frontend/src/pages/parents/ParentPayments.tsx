import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Loader2,
  Receipt,
  RefreshCw,
  Search,
  User,
  XCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardHeader from '../../components/DashboardHeader';
import PageBanner from '../../components/PageBanner';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import { getChildPaymentHistory } from '../../api/parentService';
import type {
  ParentPaymentHistoryResponse,
  ParentPaymentStatus,
  ParentPaymentTransaction,
} from '../../types/api';

type StatusFilter = 'ALL' | ParentPaymentStatus;

const STATUS_CONFIG: Record<ParentPaymentStatus, {
  label: string;
  className: string;
  icon: ReactNode;
}> = {
  PAID: {
    label: 'Đã thanh toán',
    className: 'bg-green-500/10 text-green-700',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  PENDING: {
    label: 'Đang chờ',
    className: 'bg-amber-500/10 text-amber-700',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  CANCELLED: {
    label: 'Đã hủy',
    className: 'bg-red-500/10 text-red-700',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
  EXPIRED: {
    label: 'Hết hạn',
    className: 'bg-slate-500/10 text-slate-700',
    icon: <AlertCircle className="w-3.5 h-3.5" />,
  },
};

function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Chưa có';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa có';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function transactionDate(transaction: ParentPaymentTransaction): string {
  return transaction.paidAt ?? transaction.createdAt;
}

function formatGrades(grades: number[], fallback: string): string {
  if (grades.length > 0) return `Lớp ${grades.join(', ')}`;
  return fallback || 'Chưa rõ lớp';
}

function payerLabel(transaction: ParentPaymentTransaction): string {
  return transaction.payerRole === 'parent'
    ? `${transaction.payerName} (Phụ huynh)`
    : `${transaction.payerName} (Học sinh)`;
}

function escapeHtml(value: string | number | null | undefined): string {
  if (value == null) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function StatusBadge({ status }: { status: ParentPaymentStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

function CourseThumb({ transaction }: { transaction: ParentPaymentTransaction }) {
  const [failed, setFailed] = useState(false);
  const canUseImage = Boolean(transaction.thumbnailUrl) && !failed;

  if (canUseImage) {
    return (
      <img
        src={transaction.thumbnailUrl ?? ''}
        alt={transaction.courseTitle}
        onError={() => setFailed(true)}
        className="w-20 h-16 rounded-xl object-cover border border-outline-variant/30 bg-surface-container"
      />
    );
  }

  return (
    <div className="w-20 h-16 rounded-xl border border-outline-variant/30 bg-surface-container flex items-center justify-center text-on-surface-variant">
      <BookOpen className="w-6 h-6 opacity-60" />
    </div>
  );
}

function printInvoice(history: ParentPaymentHistoryResponse, transaction: ParentPaymentTransaction): boolean {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) return false;

  const status = STATUS_CONFIG[transaction.status].label;
  const html = `<!doctype html>
  <html lang="vi">
    <head>
      <meta charset="utf-8" />
      <title>Hoa don ${escapeHtml(transaction.invoiceCode)}</title>
      <style>
        :root {
          --ink: #161616;
          --muted: #665b55;
          --line: #ead8ce;
          --panel: #fff7f1;
          --accent: #b32600;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: "Segoe UI", Arial, sans-serif;
          color: var(--ink);
          background: white;
        }
        .page {
          width: 100%;
          max-width: 820px;
          margin: 0 auto;
          padding: 44px 40px 56px;
        }
        .hero {
          border-bottom: 3px solid var(--accent);
          padding-bottom: 20px;
          margin-bottom: 28px;
          display: flex;
          justify-content: space-between;
          gap: 24px;
        }
        .brand {
          font-size: 24px;
          font-weight: 900;
          color: var(--accent);
          margin: 0 0 6px;
        }
        .muted { color: var(--muted); }
        h1 {
          margin: 0;
          font-size: 30px;
        }
        .invoice-code {
          text-align: right;
          font-size: 13px;
          color: var(--muted);
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 24px;
        }
        .box {
          border: 1px solid var(--line);
          border-radius: 14px;
          background: var(--panel);
          padding: 16px;
        }
        .box span {
          display: block;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted);
          font-weight: 800;
          margin-bottom: 6px;
        }
        .box strong {
          font-size: 16px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid var(--line);
          border-radius: 14px;
          overflow: hidden;
        }
        th {
          background: var(--panel);
          color: var(--accent);
          text-align: left;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 13px 14px;
        }
        td {
          border-top: 1px solid var(--line);
          padding: 14px;
          font-size: 14px;
          vertical-align: top;
        }
        .right { text-align: right; }
        .total {
          margin-top: 18px;
          display: flex;
          justify-content: flex-end;
        }
        .total-box {
          min-width: 280px;
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 18px;
          background: #fff;
        }
        .total-box span {
          color: var(--muted);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 800;
        }
        .total-box strong {
          display: block;
          margin-top: 6px;
          font-size: 26px;
          color: var(--accent);
        }
        .footer {
          margin-top: 34px;
          padding-top: 18px;
          border-top: 1px solid var(--line);
          color: var(--muted);
          font-size: 12px;
          line-height: 1.6;
        }
        @media print {
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .page { padding: 28px; }
        }
      </style>
    </head>
    <body>
      <main class="page">
        <section class="hero">
          <div>
            <p class="brand">Bee Academy</p>
            <h1>Hoa don dien tu</h1>
            <p class="muted">Lich su thanh toan khoa hoc cua hoc sinh</p>
          </div>
          <div class="invoice-code">
            <strong>${escapeHtml(transaction.invoiceCode)}</strong><br />
            Tao luc: ${escapeHtml(formatDateTime(new Date().toISOString()))}
          </div>
        </section>

        <section class="grid">
          <div class="box">
            <span>Hoc sinh</span>
            <strong>${escapeHtml(history.studentName)}</strong>
            <p class="muted">${escapeHtml(history.gradeLabel || formatGrades(transaction.grades, ''))}</p>
          </div>
          <div class="box">
            <span>Nguoi thanh toan</span>
            <strong>${escapeHtml(payerLabel(transaction))}</strong>
            <p class="muted">Ma don: ${escapeHtml(transaction.paymentRef)}</p>
          </div>
          <div class="box">
            <span>Ngay giao dich</span>
            <strong>${escapeHtml(formatDateTime(transactionDate(transaction)))}</strong>
          </div>
          <div class="box">
            <span>Trang thai</span>
            <strong>${escapeHtml(status)}</strong>
          </div>
        </section>

        <table>
          <thead>
            <tr>
              <th>Khoa hoc</th>
              <th>Giao vien</th>
              <th>Tien do hien tai</th>
              <th class="right">So tien</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>${escapeHtml(transaction.courseTitle)}</strong><br />
                <span class="muted">${escapeHtml(transaction.categoryName ?? '')} ${escapeHtml(formatGrades(transaction.grades, ''))}</span>
              </td>
              <td>${escapeHtml(transaction.teacherName ?? 'Bee Academy')}</td>
              <td>${escapeHtml(transaction.currentProgressPct)}%</td>
              <td class="right">${escapeHtml(formatVnd(transaction.amountVnd))}</td>
            </tr>
          </tbody>
        </table>

        <div class="total">
          <div class="total-box">
            <span>Tong thanh toan</span>
            <strong>${escapeHtml(formatVnd(transaction.amountVnd))}</strong>
          </div>
        </div>

        <p class="footer">
          Chung tu nay duoc tao tu Bee Academy cho muc dich doi soat hoc phi va lich su giao dich cua phu huynh.
          Vui long doi chieu voi ma don PayOS ${escapeHtml(transaction.orderCode)} khi can ho tro.
        </p>
      </main>
      <script>
        window.addEventListener('load', () => {
          window.print();
        });
      </script>
    </body>
  </html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
}

export default function ParentPayments() {
  const navigate = useNavigate();
  const { linkedStudents, fetchLinkedStudents } = useAuthStore();
  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => {
    return localStorage.getItem('parent_active_student_id') || linkedStudents[0]?.id || '';
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [history, setHistory] = useState<ParentPaymentHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    fetchLinkedStudents();
  }, [fetchLinkedStudents]);

  useEffect(() => {
    if (linkedStudents.length > 0) {
      const savedStudentId = localStorage.getItem('parent_active_student_id');
      const isValidSavedStudent = savedStudentId && linkedStudents.some(student => student.id === savedStudentId);
      const isValidCurrentStudent = linkedStudents.some(student => student.id === selectedStudentId);

      if (isValidSavedStudent && savedStudentId !== selectedStudentId) {
        setSelectedStudentId(savedStudentId);
      } else if (!isValidCurrentStudent) {
        setSelectedStudentId(linkedStudents[0].id);
        localStorage.setItem('parent_active_student_id', linkedStudents[0].id);
      }
    } else {
      setSelectedStudentId('');
    }
  }, [linkedStudents, selectedStudentId]);

  useEffect(() => {
    if (!selectedStudentId) {
      setHistory(null);
      return;
    }

    let active = true;
    const loadHistory = async () => {
      setLoading(true);
      try {
        const data = await getChildPaymentHistory(selectedStudentId);
        if (!active) return;
        setHistory(data);
      } catch (error) {
        if (!active) return;
        setHistory(null);
        notify.error(error instanceof Error ? error.message : 'Không thể tải lịch sử thanh toán.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadHistory();
    return () => {
      active = false;
    };
  }, [selectedStudentId]);

  const activeStudent = linkedStudents.find(student => student.id === selectedStudentId);

  const filteredTransactions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return (history?.transactions ?? [])
      .filter(transaction => statusFilter === 'ALL' || transaction.status === statusFilter)
      .filter(transaction => {
        const date = transactionDate(transaction).slice(0, 10);
        if (fromDate && date < fromDate) return false;
        if (toDate && date > toDate) return false;
        return true;
      })
      .filter(transaction => {
        if (!query) return true;
        return (
          transaction.paymentRef.toLowerCase().includes(query) ||
          String(transaction.orderCode).includes(query) ||
          transaction.courseTitle.toLowerCase().includes(query) ||
          (transaction.teacherName ?? '').toLowerCase().includes(query) ||
          transaction.payerName.toLowerCase().includes(query)
        );
      });
  }, [fromDate, history, searchTerm, statusFilter, toDate]);

  const stats = useMemo(() => {
    const paid = filteredTransactions.filter(transaction => transaction.status === 'PAID');
    return {
      totalPaid: paid.reduce((sum, transaction) => sum + transaction.amountVnd, 0),
      totalRows: filteredTransactions.length,
      pendingRows: filteredTransactions.filter(transaction => transaction.status === 'PENDING').length,
      avgProgress: filteredTransactions.length > 0
        ? filteredTransactions.reduce((sum, transaction) => sum + transaction.currentProgressPct, 0) / filteredTransactions.length
        : 0,
    };
  }, [filteredTransactions]);

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    localStorage.setItem('parent_active_student_id', studentId);
    setDropdownOpen(false);
    setSearchTerm('');
    setStatusFilter('ALL');
    setFromDate('');
    setToDate('');
    notify.success(`Đã chuyển sang lịch sử thanh toán của ${linkedStudents.find(student => student.id === studentId)?.name}`);
  };

  const handleRefresh = async () => {
    if (!selectedStudentId) return;
    setLoading(true);
    try {
      const data = await getChildPaymentHistory(selectedStudentId);
      setHistory(data);
      notify.success('Đã cập nhật lịch sử thanh toán mới nhất.');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không thể làm mới lịch sử thanh toán.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setFromDate('');
    setToDate('');
  };

  const handlePrintInvoice = (transaction: ParentPaymentTransaction) => {
    if (!history) return;
    const opened = printInvoice(history, transaction);
    if (!opened) {
      notify.error('Trình duyệt đang chặn cửa sổ hóa đơn.');
      return;
    }
    notify.success(`Đã mở hóa đơn ${transaction.invoiceCode}.`);
  };

  if (linkedStudents.length === 0) {
    return (
      <div className="min-h-screen bg-surface flex flex-col font-sans">
        <DashboardHeader />
        <PageBanner title="Lịch sử thanh toán" subtitle="Theo dõi giao dịch khóa học của con" />
        <div className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-10 py-12">
          <main className="max-w-2xl mx-auto text-center">
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-10 shadow-sm">
              <AlertCircle className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-extrabold text-on-surface mb-3">Chưa liên kết tài khoản con</h2>
              <p className="text-sm text-on-surface-variant mb-8">
                Liên kết tài khoản học sinh để xem lịch sử thanh toán và tiến độ tương ứng.
              </p>
              <button
                onClick={() => navigate('/parent/link')}
                className="px-6 py-3.5 bg-primary text-on-primary font-bold rounded-xl text-sm hover:bg-primary/95 transition-all shadow-md shadow-primary/20"
              >
                Liên kết tài khoản con
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <DashboardHeader />

      <div className="relative">
        <PageBanner
          title="Lịch sử thanh toán"
          subtitle="Theo dõi giao dịch khóa học, người thanh toán và tiến độ hiện tại của con"
        />

        <div className="absolute bottom-4 right-4 md:right-10 z-10">
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 bg-surface-container-lowest px-4 py-2.5 rounded-xl border border-outline-variant/30 shadow-md font-bold text-sm text-on-surface hover:bg-surface-container-low transition-colors"
            >
              <User className="w-4 h-4 text-primary" />
              <span>Con: {activeStudent?.name ?? 'Chưa chọn'}</span>
              <ChevronDown className="w-4 h-4 text-on-surface-variant" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-xl z-20 py-2">
                {linkedStudents.map(student => (
                  <button
                    key={student.id}
                    onClick={() => handleSelectStudent(student.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-surface-container-low ${
                      student.id === selectedStudentId ? 'bg-primary/5 text-primary font-bold' : 'text-on-surface'
                    }`}
                  >
                    <img
                      src={student.avatar}
                      alt={student.name}
                      className="w-7 h-7 rounded-full object-cover border border-outline-variant/20"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-xs leading-none">{student.name}</p>
                      <p className="text-[10px] text-on-surface-variant mt-1">{student.grade || 'Chưa phân lớp'}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-10 py-8">
        <main>
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-5 mb-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-primary">UC26 · Lịch sử thanh toán</p>
                <h2 className="text-2xl font-extrabold text-on-surface mt-1">{history?.studentName ?? activeStudent?.name}</h2>
                <p className="text-sm text-on-surface-variant mt-1">
                  {history?.gradeLabel || activeStudent?.grade || 'Chưa phân lớp'} · Cập nhật {formatDateTime(history?.generatedAt)}
                </p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="h-11 px-4 rounded-xl border border-outline-variant/40 text-sm font-bold text-on-surface hover:bg-surface-container transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Làm mới
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-primary text-on-primary rounded-3xl p-6 shadow-lg shadow-primary/15">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-on-primary/80">Tổng đã thanh toán</p>
                  <p className="text-3xl font-extrabold mt-2">{formatVnd(stats.totalPaid)}</p>
                </div>
                <Receipt className="w-9 h-9 text-on-primary/80" />
              </div>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm">
              <p className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">Dòng giao dịch</p>
              <p className="text-3xl font-extrabold text-on-surface mt-2">{stats.totalRows}</p>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm">
              <p className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">Đang chờ</p>
              <p className="text-3xl font-extrabold text-on-surface mt-2">{stats.pendingRows}</p>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm">
              <p className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">Tiến độ TB</p>
              <p className="text-3xl font-extrabold text-on-surface mt-2">{stats.avgProgress.toFixed(1)}%</p>
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-3xl p-4 shadow-sm mb-6">
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_180px_170px_170px_auto] gap-3">
              <label className="block">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">Tìm kiếm</span>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={event => setSearchTerm(event.target.value)}
                    placeholder="Mã đơn, khóa học, giáo viên, người thanh toán..."
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant"
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">Trạng thái</span>
                <select
                  value={statusFilter}
                  onChange={event => setStatusFilter(event.target.value as StatusFilter)}
                  className="w-full px-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-on-surface"
                >
                  <option value="ALL">Tất cả</option>
                  <option value="PAID">Đã thanh toán</option>
                  <option value="PENDING">Đang chờ</option>
                  <option value="EXPIRED">Hết hạn</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">Từ ngày</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={event => setFromDate(event.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-on-surface"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">Đến ngày</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={event => setToDate(event.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-surface-container border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-on-surface"
                />
              </label>

              <div className="flex items-end">
                <button
                  onClick={handleResetFilters}
                  className="w-full xl:w-auto px-4 py-2.5 rounded-xl border border-outline-variant/40 text-sm font-bold text-on-surface hover:bg-surface-container transition-colors"
                >
                  Xóa lọc
                </button>
              </div>
            </div>
          </div>

          <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant/20 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-on-surface text-lg">Giao dịch khóa học</h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  Hiển thị giao dịch của học sinh và phụ huynh liên quan tới các khóa con đang học.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 text-sm font-bold text-on-surface">
                <CalendarDays className="w-4 h-4 text-primary" />
                {filteredTransactions.length} dòng
              </div>
            </div>

            {loading ? (
              <div className="py-20 flex justify-center text-on-surface-variant">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center px-6">
                <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mb-4">
                  <Receipt className="w-8 h-8 text-on-surface-variant/50" />
                </div>
                <h4 className="text-lg font-extrabold text-on-surface">Không có giao dịch phù hợp</h4>
                <p className="text-sm text-on-surface-variant mt-2 max-w-md">
                  Thử đổi bộ lọc hoặc kiểm tra lại các khóa học mà con đang được ghi danh.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-outline-variant/15">
                {filteredTransactions.map((transaction, index) => (
                  <motion.article
                    key={`${transaction.orderId}-${transaction.courseId}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="p-5"
                  >
                    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_190px_130px_150px_auto] gap-4 xl:items-center">
                      <div className="flex items-start gap-4 min-w-0">
                        <CourseThumb transaction={transaction} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <h4 className="font-extrabold text-on-surface line-clamp-2">{transaction.courseTitle}</h4>
                            <StatusBadge status={transaction.status} />
                          </div>
                          <p className="text-sm text-on-surface-variant">
                            {transaction.teacherName ?? 'Bee Academy'} · {formatGrades(transaction.grades, history?.gradeLabel ?? '')}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant">
                            <span>Mã đơn: <strong className="text-on-surface">{transaction.paymentRef}</strong></span>
                            <span>PayOS: {transaction.orderCode}</span>
                            <span>{formatDateTime(transactionDate(transaction))}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Người thanh toán</p>
                        <p className="text-sm font-bold text-on-surface">{payerLabel(transaction)}</p>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Tiến độ</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-surface-container overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.min(100, Math.max(0, transaction.currentProgressPct))}%` }}
                            />
                          </div>
                          <span className="text-sm font-extrabold text-on-surface">{transaction.currentProgressPct}%</span>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Số tiền</p>
                        <p className="text-lg font-extrabold text-primary">{formatVnd(transaction.amountVnd)}</p>
                      </div>

                      <button
                        onClick={() => handlePrintInvoice(transaction)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-primary/30 text-primary text-sm font-extrabold hover:bg-primary/10 transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        Hóa đơn
                      </button>
                    </div>
                  </motion.article>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

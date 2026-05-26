/**
 * TeacherBankPage — Trang "Tài khoản ngân hàng" cho Giáo viên (UC45 + UC46)
 *
 * Bối cảnh v6.5:
 *   - GV bắt buộc phải có TK ngân hàng đã NHẬP (UC45) trước khi Admin xuất Excel thanh toán (UC39).
 *   - Mọi thay đổi TK đều phải GHI AUDIT LOG (UC46) — vì tiền bạc nhạy cảm, cần evidence khi có tranh chấp.
 *   - Trạng thái xác minh: Admin có thể cần xác minh thông tin trước khi dùng để chuyển tiền.
 *
 * Luồng chính:
 *   1. Vào trang → thấy TK hiện tại ở chế độ READONLY (chỉ xem)
 *   2. Click "Cập nhật" → form chuyển sang chế độ EDIT, các field editable
 *   3. GV sửa thông tin + nhập "Lý do thay đổi" (tùy chọn)
 *   4. Click "Lưu thay đổi" → mở CONFIRM DIALOG (vì là tiền bạc, cần xác nhận kép)
 *   5. Xác nhận → commit + ghi 1 entry vào audit log
 *   6. Trạng thái xác minh reset về 'pending' vì Admin cần xác minh lại
 *
 * Bảng audit log ở dưới:
 *   - 1 row = 1 lần save (có thể chứa nhiều field đã đổi)
 *   - Click row → expand để xem chi tiết old → new từng trường
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import {
  LayoutDashboard, BookOpen, FileText, HelpCircle,
  Bell, LogOut, Menu, X, Save, Pencil,
  PenSquare, Landmark, BarChart2, ClipboardList,
  GraduationCap, CheckCircle2, Clock, AlertTriangle,
  Eye, EyeOff, History, ChevronDown, ChevronRight,
  Megaphone,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 1 — TYPES
// ═══════════════════════════════════════════════════════════════════

// Trạng thái xác minh TK:
//   - pending:  TK đã nhập nhưng Admin chưa xác minh
//   - verified: Admin đã xác minh → dùng được cho UC39 (xuất Excel CK)
//   - rejected: Admin từ chối (vd: tên không khớp) — GV cần sửa
type VerifyStatus = 'pending' | 'verified' | 'rejected';

// Thông tin TK ngân hàng
interface BankInfo {
  bankName: string;       // Tên ngân hàng (chọn từ dropdown)
  accountNumber: string;  // Số TK
  accountHolder: string;  // Tên chủ TK (in hoa, không dấu — chuẩn ngân hàng)
  branch: string;         // Chi nhánh
  verifyStatus: VerifyStatus;
}

// 1 trường đã thay đổi trong 1 lần save
interface FieldChange {
  field: string;       // Tên hiển thị, vd "Tên ngân hàng"
  oldValue: string;
  newValue: string;
}

// 1 entry trong audit log = 1 lần GV save (có thể đổi nhiều trường cùng lúc)
interface AuditEntry {
  id: string;
  changedBy: string;     // Tên người sửa (= GV đang đăng nhập)
  changedAt: string;     // ISO datetime
  changes: FieldChange[];
  reason?: string;       // Lý do (tùy chọn) — hữu ích cho compliance / dispute
}

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 2 — CONSTANTS
// ═══════════════════════════════════════════════════════════════════
// Danh sách 14 NH phổ biến VN — dùng dropdown thay free text
// để tránh sai chính tả → mismatch với hệ thống ngân hàng khi CK
const VN_BANKS = [
  'Vietcombank (VCB)',
  'BIDV',
  'Vietinbank',
  'Agribank',
  'Techcombank',
  'MB Bank',
  'ACB',
  'VPBank',
  'TPBank',
  'Sacombank',
  'OCB',
  'SHB',
  'HDBank',
  'VIB',
];

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 3 — MOCK DATA
// ═══════════════════════════════════════════════════════════════════
// TK hiện tại + 2 entry audit log mẫu để demo
const INITIAL_BANK: BankInfo = {
  bankName: 'Vietcombank (VCB)',
  accountNumber: '0123456789012',
  accountHolder: 'NGUYEN VAN BEE',
  branch: 'CN Hồ Chí Minh',
  verifyStatus: 'verified',
};

const INITIAL_AUDIT: AuditEntry[] = [
  {
    id: 'a1',
    changedBy: 'Giáo viên Bee',
    changedAt: '2026-04-15T10:30:00',
    changes: [
      { field: 'Chi nhánh', oldValue: 'CN Quận 1', newValue: 'CN Hồ Chí Minh' },
    ],
    reason: 'Đổi chi nhánh giao dịch chính.',
  },
  {
    id: 'a2',
    changedBy: 'Giáo viên Bee',
    changedAt: '2026-03-01T14:00:00',
    changes: [
      { field: 'Tên ngân hàng', oldValue: 'Techcombank', newValue: 'Vietcombank (VCB)' },
      { field: 'Số tài khoản',  oldValue: '19036789012345', newValue: '0123456789012' },
      { field: 'Chi nhánh',     oldValue: 'CN Cầu Giấy', newValue: 'CN Quận 1' },
    ],
    reason: 'Đóng TK Techcombank, chuyển sang Vietcombank.',
  },
];

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 4 — NAV_ITEMS (đồng bộ sidebar teacher)
// ═══════════════════════════════════════════════════════════════════
const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Tổng quan',         path: '/teacher',          },
  { icon: BookOpen,        label: 'Khóa học của tôi',  path: '/teacher/courses',  },
  { icon: FileText,        label: 'Bài giảng',          path: '/teacher/content',  },
  { icon: PenSquare,       label: 'Quiz chương',        path: '/teacher/quiz',     },
  { icon: GraduationCap,   label: 'Bài kiểm tra',       path: '/teacher/exam',     },
  { icon: ClipboardList,   label: 'Chấm điểm',          path: '/teacher/grades',   },
  { icon: HelpCircle,      label: 'Hỏi & Đáp',          path: '/teacher/qa',       },
  { icon: Megaphone,       label: 'Khiếu nại',          path: '/teacher/complaints',},
  { icon: BarChart2,       label: 'Doanh thu',          path: '/teacher/revenue',  },
  { icon: Landmark,        label: 'TK ngân hàng',       path: '/teacher/bank',     },
];

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 5 — HELPER: mask số TK
// ═══════════════════════════════════════════════════════════════════
/**
 * maskAccountNumber — Ẩn phần giữa của số TK, chỉ lộ 4 ký tự cuối.
 * Lý do: bảo mật khi GV share màn hình hoặc demo.
 * Ví dụ: "0123456789012" → "*********9012"
 */
function maskAccountNumber(num: string): string {
  if (num.length <= 4) return num;
  return '*'.repeat(num.length - 4) + num.slice(-4);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 6 — SUB-COMPONENT: VerifyStatusBadge
// ═══════════════════════════════════════════════════════════════════
function VerifyStatusBadge({ status }: { status: VerifyStatus }) {
  const config = {
    pending: {
      icon: <Clock className="w-3.5 h-3.5" />,
      label: 'Chờ Admin xác minh',
      className: 'bg-amber-500/10 text-amber-600',
    },
    verified: {
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      label: 'Đã xác minh',
      className: 'bg-green-500/10 text-green-600',
    },
    rejected: {
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      label: 'Bị từ chối',
      className: 'bg-red-500/10 text-red-600',
    },
  };
  const { icon, label, className } = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${className}`}>
      {icon}{label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  PHẦN 7 — MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function TeacherBankPage() {
  // ── State chính ─────────────────────────────────────────────────
  // bank: TK hiện tại đã commit (source of truth)
  const [bank, setBank] = useState<BankInfo>(INITIAL_BANK);
  // auditLog: lịch sử các lần thay đổi
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(INITIAL_AUDIT);

  // Mode hiển thị: 'view' = readonly, 'edit' = đang sửa
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  // Form state — chỉ dùng khi mode='edit'
  // Tách khỏi bank để "Hủy" không ảnh hưởng state gốc
  const [form, setForm] = useState<BankInfo>(INITIAL_BANK);
  const [reasonInput, setReasonInput] = useState<string>('');

  // Toggle hiện/ẩn số TK (mặc định ẩn để an toàn)
  const [showAccountNumber, setShowAccountNumber] = useState<boolean>(false);

  // Confirm dialog hiển thị hay không
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  // Audit log: id đang được expand (null = không expand row nào)
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  // Sidebar mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);

  // ── Handler: vào chế độ chỉnh sửa ───────────────────────────────
  // Copy bank hiện tại vào form để GV sửa
  function startEdit() {
    setForm({ ...bank });
    setReasonInput('');
    setMode('edit');
  }

  // ── Handler: hủy chỉnh sửa ──────────────────────────────────────
  function cancelEdit() {
    setMode('view');
    setShowConfirm(false);
  }

  // ── Handler: tính các trường đã đổi ─────────────────────────────
  // Compare form với bank để liệt kê các field đã thay đổi
  // Trả về mảng FieldChange — dùng cho confirm dialog & audit log
  function computeChanges(): FieldChange[] {
    const changes: FieldChange[] = [];
    if (form.bankName !== bank.bankName) {
      changes.push({ field: 'Tên ngân hàng', oldValue: bank.bankName, newValue: form.bankName });
    }
    if (form.accountNumber !== bank.accountNumber) {
      changes.push({ field: 'Số tài khoản', oldValue: bank.accountNumber, newValue: form.accountNumber });
    }
    if (form.accountHolder !== bank.accountHolder) {
      changes.push({ field: 'Tên chủ tài khoản', oldValue: bank.accountHolder, newValue: form.accountHolder });
    }
    if (form.branch !== bank.branch) {
      changes.push({ field: 'Chi nhánh', oldValue: bank.branch, newValue: form.branch });
    }
    return changes;
  }

  // ── Handler: bắt đầu lưu — validate rồi mở confirm dialog ───────
  function attemptSave() {
    // Validate cơ bản — các field bắt buộc không được rỗng
    if (!form.bankName.trim() || !form.accountNumber.trim() || !form.accountHolder.trim() || !form.branch.trim()) {
      notify.error('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    // Số TK phải toàn số (banking convention VN)
    if (!/^\d+$/.test(form.accountNumber.trim())) {
      notify.error('Số tài khoản chỉ được chứa chữ số');
      return;
    }

    // Nếu không có thay đổi gì thì không cần lưu
    const changes = computeChanges();
    if (changes.length === 0) {
      notify.info('Không có thay đổi nào để lưu');
      return;
    }

    // Mở confirm dialog (vì là tiền bạc, cần xác nhận kép)
    setShowConfirm(true);
  }

  // ── Handler: xác nhận lưu (sau confirm dialog) ──────────────────
  // Logic:
  //   1. Tạo 1 entry audit log với danh sách changes + reason
  //   2. Commit form về bank, reset verifyStatus về 'pending'
  //      (vì Admin cần xác minh lại sau khi đổi)
  //   3. Đóng confirm + về mode view
  function confirmSave() {
    const changes = computeChanges();

    // Trang này thuộc teacher portal → người sửa luôn là Giáo viên.
    // Không lấy từ user?.name vì useAuthStore mặc định trả về tên Học viên
    // (chưa có role-based auth thật, default mock là student).
    // Khi tích hợp backend với role thật → đổi thành user?.name (đã có role check).
    const TEACHER_DISPLAY_NAME = 'Giáo viên Bee';

    const newEntry: AuditEntry = {
      id: `a-${Date.now()}`,
      changedBy: TEACHER_DISPLAY_NAME,
      changedAt: new Date().toISOString(),
      changes,
      reason: reasonInput.trim() || undefined,
    };

    // Push entry mới lên ĐẦU audit log (DESC theo thời gian)
    setAuditLog(prev => [newEntry, ...prev]);

    // Commit + reset verify
    setBank({ ...form, verifyStatus: 'pending' });

    setShowConfirm(false);
    setMode('view');
    notify.success('Đã cập nhật TK ngân hàng. Admin sẽ xác minh lại.');
  }

  // ── Handler: toggle expand 1 row audit log ──────────────────────
  function toggleAuditRow(id: string) {
    setExpandedEntryId(prev => prev === id ? null : id);
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  // ═════════════════════════════════════════════════════════════════
  //  RENDER
  // ═════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-surface flex font-sans">

      {/* Overlay sidebar mobile */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* ── SIDEBAR ─────────────────────────────────────────────── */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64
        bg-surface-container-lowest border-r border-outline-variant/30
        flex flex-col transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:flex
      `}>
        <div className="p-6 flex items-center justify-between border-b border-outline-variant/20">
          <Link to="/teacher" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary text-on-primary rounded-xl flex items-center justify-center font-extrabold text-lg shadow-md shadow-primary/20">B</div>
            <div>
              <p className="font-extrabold text-on-surface text-sm">Bee Academy</p>
              <p className="text-xs text-on-surface-variant font-medium">Cổng Giáo Viên</p>
            </div>
          </Link>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 text-on-surface-variant">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                  isActive ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
                {isActive && <div className="ml-auto w-2 h-2 bg-primary rounded-full" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-outline-variant/20">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors text-left"
          >
            <LogOut className="w-5 h-5" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* ── MAIN AREA ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        <header className="sticky top-0 z-20 h-16 bg-surface/90 backdrop-blur-md border-b border-outline-variant/30 flex items-center justify-between px-4 md:px-6 shadow-sm">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-extrabold text-on-surface text-lg hidden lg:block">TK ngân hàng</h1>
          <div className="flex items-center gap-4 ml-auto">
            <button className="relative text-on-surface-variant hover:text-primary transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <img
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? 'Giao Vien')}&background=7c3aed&color=fff&bold=true&size=64`}
              alt="Teacher avatar"
              className="w-9 h-9 rounded-full border-2 border-primary/30"
            />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto max-w-4xl">

          {/* Tiêu đề */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
            <h2 className="text-2xl font-extrabold text-on-surface mb-1">Tài khoản ngân hàng</h2>
            <p className="text-on-surface-variant text-sm">
              Bắt buộc để Admin xuất file Excel thanh toán hoa hồng. Mọi thay đổi đều được ghi audit log.
            </p>
          </motion.div>

          {/* ── CARD: TK HIỆN TẠI ─────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-5 shadow-sm mb-6"
          >
            <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
              <h3 className="font-extrabold text-on-surface flex items-center gap-2">
                <Landmark className="w-5 h-5 text-primary" />
                Thông tin tài khoản
              </h3>
              <VerifyStatusBadge status={bank.verifyStatus} />
            </div>

            {/* Cảnh báo nếu pending */}
            {bank.verifyStatus === 'pending' && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700">
                  TK đang chờ Admin xác minh. Khi được xác minh, bạn mới có thể nhận chuyển khoản cuối kỳ.
                </p>
              </div>
            )}

            {/* ── MODE VIEW (readonly) ─────────────────────── */}
            {mode === 'view' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1">Tên ngân hàng</p>
                    <p className="text-on-surface font-semibold">{bank.bankName}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1">Tên chủ tài khoản</p>
                    <p className="text-on-surface font-semibold uppercase">{bank.accountHolder}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1">Số tài khoản</p>
                    <div className="flex items-center gap-2">
                      <p className="text-on-surface font-mono font-bold">
                        {showAccountNumber ? bank.accountNumber : maskAccountNumber(bank.accountNumber)}
                      </p>
                      {/* Toggle hiện/ẩn số TK — bảo mật khi share màn hình */}
                      <button
                        onClick={() => setShowAccountNumber(!showAccountNumber)}
                        title={showAccountNumber ? 'Ẩn số TK' : 'Hiện số TK'}
                        className="p-1 text-on-surface-variant hover:text-primary transition-colors"
                      >
                        {showAccountNumber ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1">Chi nhánh</p>
                    <p className="text-on-surface font-semibold">{bank.branch}</p>
                  </div>
                </div>

                <button
                  onClick={startEdit}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
                >
                  <Pencil className="w-4 h-4" />
                  Cập nhật TK
                </button>
              </>
            )}

            {/* ── MODE EDIT ─────────────────────────────────── */}
            {mode === 'edit' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Tên ngân hàng — dropdown */}
                  <label className="block">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                      Tên ngân hàng <span className="text-red-500">*</span>
                    </span>
                    <select
                      value={form.bankName}
                      onChange={e => setForm({ ...form, bankName: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                    >
                      {VN_BANKS.map(bn => (
                        <option key={bn} value={bn}>{bn}</option>
                      ))}
                    </select>
                  </label>

                  {/* Tên chủ TK */}
                  <label className="block">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                      Tên chủ tài khoản <span className="text-red-500">*</span>
                      <span className="text-on-surface-variant/70 font-normal normal-case ml-2">(in hoa, không dấu)</span>
                    </span>
                    <input
                      type="text"
                      value={form.accountHolder}
                      onChange={e => setForm({ ...form, accountHolder: e.target.value.toUpperCase() })}
                      placeholder="VD: NGUYEN VAN A"
                      className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface uppercase"
                    />
                  </label>

                  {/* Số TK */}
                  <label className="block">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                      Số tài khoản <span className="text-red-500">*</span>
                    </span>
                    <input
                      type="text"
                      value={form.accountNumber}
                      onChange={e => setForm({ ...form, accountNumber: e.target.value })}
                      placeholder="0123456789..."
                      inputMode="numeric"
                      className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface font-mono"
                    />
                  </label>

                  {/* Chi nhánh */}
                  <label className="block">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                      Chi nhánh <span className="text-red-500">*</span>
                    </span>
                    <input
                      type="text"
                      value={form.branch}
                      onChange={e => setForm({ ...form, branch: e.target.value })}
                      placeholder="VD: CN Hồ Chí Minh"
                      className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                    />
                  </label>
                </div>

                {/* Lý do thay đổi (tùy chọn) — phục vụ compliance/dispute */}
                <label className="block">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">
                    Lý do thay đổi <span className="text-on-surface-variant/70 font-normal normal-case">(tùy chọn — ghi vào audit log)</span>
                  </span>
                  <textarea
                    value={reasonInput}
                    onChange={e => setReasonInput(e.target.value)}
                    placeholder="VD: Đổi ngân hàng do TK cũ đã đóng"
                    rows={2}
                    className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant resize-none"
                  />
                </label>

                {/* Nút hành động */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/30">
                  <button
                    onClick={cancelEdit}
                    className="px-5 py-2.5 text-sm font-bold text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={attemptSave}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
                  >
                    <Save className="w-4 h-4" />
                    Lưu thay đổi
                  </button>
                </div>
              </div>
            )}
          </motion.div>

          {/* ── BẢNG AUDIT LOG ───────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl overflow-hidden shadow-sm"
          >
            <div className="px-5 py-4 border-b border-outline-variant/20 flex items-center justify-between">
              <h3 className="font-extrabold text-on-surface flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Lịch sử thay đổi
              </h3>
              <span className="text-sm text-on-surface-variant">{auditLog.length} lần</span>
            </div>

            {auditLog.length === 0 ? (
              <p className="px-5 py-12 text-center text-on-surface-variant text-sm">
                Chưa có thay đổi nào
              </p>
            ) : (
              <div className="divide-y divide-outline-variant/10">
                {auditLog.map(entry => {
                  const isExpanded = entry.id === expandedEntryId;
                  return (
                    <div key={entry.id}>
                      {/* Header row — click để expand */}
                      <button
                        onClick={() => toggleAuditRow(entry.id)}
                        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-surface-container/30 transition-colors text-left"
                      >
                        {isExpanded
                          ? <ChevronDown className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
                          : <ChevronRight className="w-4 h-4 text-on-surface-variant flex-shrink-0" />}

                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-on-surface text-sm">{entry.changedBy}</p>
                          <p className="text-xs text-on-surface-variant">{formatDateTime(entry.changedAt)}</p>
                        </div>

                        <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded-full whitespace-nowrap">
                          {entry.changes.length} trường đổi
                        </span>
                      </button>

                      {/* Detail (expand): bảng old → new */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 py-3 bg-surface-container/30 space-y-2">
                              {entry.changes.map((c, idx) => (
                                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 text-sm py-1.5 border-b border-outline-variant/10 last:border-0">
                                  <div className="md:col-span-3 text-xs font-bold text-on-surface-variant uppercase tracking-wide">
                                    {c.field}
                                  </div>
                                  <div className="md:col-span-4 text-red-500/80">
                                    <span className="text-xs text-on-surface-variant mr-1">Cũ:</span>
                                    <span className="line-through">{c.oldValue}</span>
                                  </div>
                                  <div className="md:col-span-5 text-green-600">
                                    <span className="text-xs text-on-surface-variant mr-1">Mới:</span>
                                    <span className="font-semibold">{c.newValue}</span>
                                  </div>
                                </div>
                              ))}

                              {/* Reason (nếu có) */}
                              {entry.reason && (
                                <div className="mt-3 pt-3 border-t border-outline-variant/20">
                                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1">Lý do</p>
                                  <p className="text-sm text-on-surface italic">"{entry.reason}"</p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

        </main>
      </div>

      {/* ═════════════════════════════════════════════════════════════
          CONFIRM DIALOG — Hiển thị overlay khi GV bấm "Lưu"
      ═════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}  // chặn click thoát khi click vào dialog
              className="bg-surface-container-lowest rounded-2xl shadow-2xl max-w-lg w-full p-6"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-on-surface text-lg">Xác nhận thay đổi TK</h3>
                  <p className="text-sm text-on-surface-variant mt-1">
                    Thay đổi sẽ được ghi vào audit log và TK sẽ chờ Admin xác minh lại.
                  </p>
                </div>
              </div>

              {/* Liệt kê các thay đổi */}
              <div className="bg-surface-container/50 rounded-xl p-4 mb-4 space-y-2 max-h-60 overflow-y-auto">
                {computeChanges().map((c, idx) => (
                  <div key={idx} className="text-sm">
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-0.5">{c.field}</p>
                    <p className="text-red-500/80 line-through text-xs">{c.oldValue}</p>
                    <p className="text-green-600 font-semibold">{c.newValue}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-5 py-2.5 text-sm font-bold text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={confirmSave}
                  className="px-5 py-2.5 bg-primary text-on-primary text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors"
                >
                  Xác nhận lưu
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

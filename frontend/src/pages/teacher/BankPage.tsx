import TeacherNotificationBell from '../../components/TeacherNotificationBell';
/**
 * TeacherBankPage — Trang "Tài khoản ngân hàng" cho Giáo viên (UC45 + UC46)
 *
 * Bối cảnh v6.5:
 *   - GV bắt buộc phải có TK ngân hàng đã NHẬP (UC45) trước khi Admin xuất Excel thanh toán (UC39).
 *   - Mọi thay đổi TK đều phải GHI AUDIT LOG (UC46) — vì tiền bạc nhạy cảm, cần evidence khi có tranh chấp.
 *   - Xác minh bằng MÃ GỬI VỀ EMAIL của chính GV, không còn chờ Admin duyệt.
 *
 * Luồng chính:
 *   1. Vào trang → thấy TK hiện tại ở chế độ READONLY (chỉ xem)
 *   2. Click "Cập nhật" → form chuyển sang chế độ EDIT, các field editable
 *   3. GV sửa thông tin + nhập "Lý do thay đổi" (tùy chọn)
 *   4. Click "Lưu thay đổi" → CONFIRM DIALOG liệt kê thay đổi (tiền bạc, cần xác nhận kép)
 *   5. Xác nhận → backend gửi mã 6 số về email GV. LÚC NÀY DB CHƯA ĐỔI GÌ.
 *   6. GV nhập mã → backend mới ghi TK + ghi audit log + đặt trạng thái 'verified'
 *
 * Vì sao chưa ghi DB ở bước 5: bỏ ngang giữa chừng (hoặc người khác mượn session)
 * thì TK đang dùng để nhận tiền vẫn nguyên vẹn, kỳ chi trả không bị treo oan.
 *
 * Bảng audit log ở dưới:
 *   - 1 row = 1 lần save (có thể chứa nhiều field đã đổi)
 *   - Click row → expand để xem chi tiết old → new từng trường
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import { isApiError } from '../../api/client';
import {
  getBankInfo, requestBankChange, verifyBankChange, getBankAuditLog,
  parseChanges, type BankVerifyStatus, type BankAuditLogResponse,
} from '../../api/bankService';
import {
  LayoutDashboard, BookOpen, FileText, HelpCircle,
  LogOut, Menu, X, Save, Pencil,
  PenSquare, Landmark, BarChart2, ClipboardList,
  GraduationCap, CheckCircle2, Clock, AlertTriangle,
  Eye, EyeOff, History, ChevronDown, ChevronRight,
  Megaphone, Database, UserCircle, Lock, Star,
  Mail, ShieldCheck, RefreshCw,
} from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';

/** Phải khớp RESEND_COOLDOWN_SECONDS ở TeacherBankOtpService, nếu không nút "Gửi lại" mở sớm và ăn lỗi 429. */
const RESEND_COOLDOWN_MS = 60_000;

/** Các mã lỗi khiến yêu cầu bị huỷ hẳn ở server — nhập tiếp cũng vô ích, phải làm lại từ đầu. */
const OTP_DEAD_CODES = ['BANK_OTP_EXPIRED', 'BANK_OTP_NOT_FOUND', 'BANK_OTP_TOO_MANY_ATTEMPTS'];

type VerifyStatus = 'pending' | 'verified' | 'rejected';

interface BankInfo {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  branch: string;
  verifyStatus: VerifyStatus;
}

interface FieldChange {
  field: string;
  oldValue: string;
  newValue: string;
}

interface AuditEntry {
  id: string;
  changedBy: string;
  changedAt: string;
  changes: FieldChange[];
  reason?: string;
}

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

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Tổng quan',         path: '/teacher',          },
  { icon: BookOpen,        label: 'Khóa học của tôi',  path: '/teacher/courses',  },
  { icon: Star,            label: 'Đánh giá khóa học', path: '/teacher/reviews',  },
  { icon: FileText,        label: 'Bài giảng',          path: '/teacher/content',  },
  { icon: PenSquare,       label: 'Quiz chương',        path: '/teacher/quiz',     },
  { icon: Database,        label: 'Ngân hàng câu hỏi',  path: '/teacher/questions',},
  { icon: GraduationCap,   label: 'Bài kiểm tra',       path: '/teacher/exam',     },
  { icon: ClipboardList,   label: 'Chấm điểm',          path: '/teacher/grades',   },
  { icon: HelpCircle,      label: 'Hỏi & Đáp',          path: '/teacher/qa',       },
  { icon: Megaphone,       label: 'Khiếu nại',          path: '/teacher/complaints',},
  { icon: BarChart2,       label: 'Doanh thu',          path: '/teacher/revenue',  },
  { icon: Landmark,        label: 'TK ngân hàng',       path: '/teacher/bank',     },
  { icon: UserCircle,      label: 'Hồ sơ',              path: '/teacher/profile',  },
  { icon: Lock,            label: 'Tài khoản',           path: '/teacher/account',  },
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
      label: 'Chưa xác minh',
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

const EMPTY_BANK: BankInfo = {
  bankName: VN_BANKS[0],
  accountNumber: '',
  accountHolder: '',
  branch: '',
  verifyStatus: 'pending',
};

function mapVerifyStatus(s: BankVerifyStatus): VerifyStatus {
  return s.toLowerCase() as VerifyStatus;
}

function mapAuditLog(entries: BankAuditLogResponse[]): AuditEntry[] {
  return entries.map(e => ({
    id: e.id,
    changedBy: e.changedByName ?? 'Giáo viên',
    changedAt: e.changedAt,
    changes: parseChanges(e.changesJson),
    reason: e.reason ?? undefined,
  }));
}

export default function TeacherBankPage() {
  const [bank, setBank] = useState<BankInfo | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [form, setForm] = useState<BankInfo>(EMPTY_BANK);
  const [reasonInput, setReasonInput] = useState('');
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // ── State của bước xác nhận bằng mã email ────────────────────────
  const [dialogStep, setDialogStep] = useState<'confirm' | 'otp'>('confirm');
  const [otpCode, setOtpCode] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [lastSentAt, setLastSentAt] = useState(0);
  const [verifying, setVerifying] = useState(false);
  // Nhịp 1 giây để đồng hồ đếm ngược và nút "Gửi lại" tự cập nhật.
  const [now, setNow] = useState(() => Date.now());

  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    Promise.all([getBankInfo(), getBankAuditLog()])
      .then(([info, logs]) => {
        if (info) {
          setBank({
            bankName: info.bankName,
            accountNumber: info.accountNumber,
            accountHolder: info.accountHolder,
            branch: info.branch ?? '',
            verifyStatus: mapVerifyStatus(info.verifyStatus),
          });
        }
        setAuditLog(mapAuditLog(logs));
      })
      .catch(() => notify.error('Không thể tải thông tin ngân hàng'))
      .finally(() => setLoading(false));
  }, []);

  // Chỉ chạy khi đang ở màn nhập mã — không để interval sống suốt vòng đời trang.
  useEffect(() => {
    if (!showConfirm || dialogStep !== 'otp') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [showConfirm, dialogStep]);

  const secondsLeft = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const resendIn = Math.max(0, Math.ceil((lastSentAt + RESEND_COOLDOWN_MS - now) / 1000));

  function startEdit() {
    setForm(bank ?? EMPTY_BANK);
    setReasonInput('');
    setMode('edit');
  }

  function cancelEdit() {
    setMode('view');
    closeDialog();
  }

  function computeChanges(): FieldChange[] {
    if (!bank) return [];
    const changes: FieldChange[] = [];
    if (form.bankName !== bank.bankName)
      changes.push({ field: 'Tên ngân hàng', oldValue: bank.bankName, newValue: form.bankName });
    if (form.accountNumber !== bank.accountNumber)
      changes.push({ field: 'Số tài khoản', oldValue: bank.accountNumber, newValue: form.accountNumber });
    if (form.accountHolder !== bank.accountHolder)
      changes.push({ field: 'Tên chủ tài khoản', oldValue: bank.accountHolder, newValue: form.accountHolder });
    if (form.branch !== bank.branch)
      changes.push({ field: 'Chi nhánh', oldValue: bank.branch, newValue: form.branch });
    return changes;
  }

  function attemptSave() {
    if (!form.bankName.trim() || !form.accountNumber.trim() || !form.accountHolder.trim() || !form.branch.trim()) {
      notify.error('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    if (!/^\d+$/.test(form.accountNumber.trim())) {
      notify.error('Số tài khoản chỉ được chứa chữ số');
      return;
    }
    // TK chưa xác minh vẫn được phép gửi mã dù không sửa gì — đó là đường để
    // xác minh lại TK cũ. Chỉ chặn khi TK đã verified mà không có thay đổi nào.
    if (bank && bank.verifyStatus === 'verified' && computeChanges().length === 0) {
      notify.info('Không có thay đổi nào để lưu');
      return;
    }
    setDialogStep('confirm');
    setShowConfirm(true);
  }

  function closeDialog() {
    setShowConfirm(false);
    setDialogStep('confirm');
    setOtpCode('');
  }

  /**
   * Gửi mã xác nhận về email. Nhận payload qua tham số thay vì đọc `form` để
   * luồng "xác minh TK hiện tại" không phải chờ setForm kịp cập nhật state.
   */
  async function sendOtp(payload: BankInfo, reason: string, isResend = false) {
    setSaving(true);
    try {
      const res = await requestBankChange({
        bankName: payload.bankName,
        accountNumber: payload.accountNumber,
        accountHolder: payload.accountHolder,
        branch: payload.branch,
        reason: reason.trim() || undefined,
      });
      setMaskedEmail(res.maskedEmail);
      setExpiresAt(new Date(res.expiresAt).getTime());
      setLastSentAt(Date.now());
      setNow(Date.now());
      setOtpCode('');
      setDialogStep('otp');
      setShowConfirm(true);
      notify.success(isResend ? 'Đã gửi lại mã xác nhận' : `Đã gửi mã xác nhận tới ${res.maskedEmail}`);
    } catch (err) {
      notify.error(isApiError(err) ? err.message : 'Không gửi được mã xác nhận. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  /** TK cũ đang ở trạng thái chưa xác minh — gửi mã mà không đổi thông tin gì. */
  function verifyExistingAccount() {
    if (!bank) return;
    setForm(bank);
    setReasonInput('');
    sendOtp(bank, '');
  }

  async function submitOtp() {
    if (!/^\d{6}$/.test(otpCode)) {
      notify.error('Mã xác nhận gồm 6 chữ số');
      return;
    }
    setVerifying(true);
    try {
      const result = await verifyBankChange(otpCode);
      setBank({
        bankName: result.bankName,
        accountNumber: result.accountNumber,
        accountHolder: result.accountHolder,
        branch: result.branch ?? '',
        verifyStatus: mapVerifyStatus(result.verifyStatus),
      });
      const logs = await getBankAuditLog();
      setAuditLog(mapAuditLog(logs));
      closeDialog();
      setMode('view');
      notify.success('Đã xác minh và lưu TK ngân hàng');
    } catch (err) {
      notify.error(isApiError(err) ? err.message : 'Không xác minh được mã. Vui lòng thử lại.');
      // Server đã huỷ yêu cầu → đóng dialog để GV bắt đầu lại, tránh gõ mã vào chỗ trống.
      if (isApiError(err) && OTP_DEAD_CODES.includes(err.code)) {
        closeDialog();
      }
    } finally {
      setVerifying(false);
    }
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
            <BrandLogo size="sm" />
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
            <TeacherNotificationBell />
            <img
              src={user?.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? 'Giao Vien')}&background=7c3aed&color=fff&bold=true&size=64`}
              alt="Teacher avatar"
              className="w-9 h-9 rounded-full object-cover border-2 border-primary/30"
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

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (

          <>
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
              {bank && <VerifyStatusBadge status={bank.verifyStatus} />}
            </div>

            {/* Cảnh báo chưa nhập TK */}
            {!bank && mode === 'view' && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700">
                  Bạn chưa nhập thông tin TK ngân hàng. Vui lòng thêm để Admin có thể chuyển khoản hoa hồng.
                </p>
              </div>
            )}

            {/* TK chưa xác minh — GV tự xác minh bằng mã gửi về email, không cần chờ Admin */}
            {bank && bank.verifyStatus !== 'verified' && mode === 'view' && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4 flex items-start gap-2 flex-wrap">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700 flex-1 min-w-[16rem]">
                  TK chưa được xác minh nên chưa dùng để nhận chuyển khoản cuối kỳ được.
                  Bấm xác minh để nhận mã qua email.
                </p>
                <button
                  onClick={verifyExistingAccount}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-60"
                >
                  {saving
                    ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <ShieldCheck className="w-3.5 h-3.5" />}
                  Xác minh qua email
                </button>
              </div>
            )}

            {/* ── MODE VIEW (readonly) ─────────────────────── */}
            {mode === 'view' && (
              <>
                {bank && (
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
                )}
                <button
                  onClick={startEdit}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
                >
                  <Pencil className="w-4 h-4" />
                  {bank ? 'Cập nhật TK' : 'Thêm TK ngân hàng'}
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
          </>
          )}

        </main>
      </div>

      {/* ═════════════════════════════════════════════════════════════
          DIALOG 2 BƯỚC — (1) soát lại thay đổi → (2) nhập mã gửi về email

          Bước 1 chỉ là rà soát phía client; DB chỉ đổi sau khi bước 2 thành công.
      ═════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            // Ở bước nhập mã, click ra ngoài KHÔNG đóng — lỡ tay là mất mã vừa gõ.
            onClick={dialogStep === 'confirm' ? closeDialog : undefined}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}  // chặn click thoát khi click vào dialog
              className="bg-surface-container-lowest rounded-2xl shadow-2xl max-w-lg w-full p-6"
            >
              {/* ── BƯỚC 1: soát lại thay đổi ───────────────────── */}
              {dialogStep === 'confirm' && (
                <>
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-on-surface text-lg">Xác nhận thay đổi TK</h3>
                      <p className="text-sm text-on-surface-variant mt-1">
                        Hệ thống sẽ gửi mã xác nhận về email của bạn. Thông tin chỉ được lưu sau khi bạn nhập đúng mã.
                      </p>
                    </div>
                  </div>

                  <div className="bg-surface-container/50 rounded-xl p-4 mb-4 space-y-2 max-h-60 overflow-y-auto">
                    {!bank ? (
                      <div className="text-sm space-y-1">
                        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">Thông tin sẽ được lưu</p>
                        <p className="text-on-surface font-semibold">{form.bankName}</p>
                        <p className="text-on-surface font-mono font-bold">{form.accountNumber}</p>
                        <p className="text-on-surface font-semibold uppercase">{form.accountHolder}</p>
                        <p className="text-on-surface-variant">{form.branch}</p>
                      </div>
                    ) : computeChanges().length === 0 ? (
                      <p className="text-sm text-on-surface-variant">
                        Không đổi thông tin nào — chỉ xác minh lại TK hiện tại.
                      </p>
                    ) : computeChanges().map((c, idx) => (
                      <div key={idx} className="text-sm">
                        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-0.5">{c.field}</p>
                        <p className="text-red-500/80 line-through text-xs">{c.oldValue}</p>
                        <p className="text-green-600 font-semibold">{c.newValue}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={closeDialog}
                      className="px-5 py-2.5 text-sm font-bold text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={() => sendOtp(form, reasonInput)}
                      disabled={saving}
                      className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60"
                    >
                      {saving
                        ? <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                        : <Mail className="w-4 h-4" />}
                      Gửi mã xác nhận
                    </button>
                  </div>
                </>
              )}

              {/* ── BƯỚC 2: nhập mã từ email ────────────────────── */}
              {dialogStep === 'otp' && (
                <>
                  <div className="flex items-start gap-3 mb-5">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-on-surface text-lg">Nhập mã xác nhận</h3>
                      <p className="text-sm text-on-surface-variant mt-1">
                        Mã gồm 6 chữ số đã gửi tới <span className="font-bold text-on-surface">{maskedEmail}</span>.
                      </p>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={e => { if (e.key === 'Enter') submitOtp(); }}
                    placeholder="000000"
                    inputMode="numeric"
                    autoFocus
                    className="w-full px-4 py-3 mb-3 text-center text-2xl font-mono font-bold tracking-[0.5em] bg-surface-container border border-outline-variant rounded-xl focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant/40"
                  />

                  <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
                    <p className="text-xs text-on-surface-variant">
                      {secondsLeft > 0
                        ? <>Mã hết hạn sau <span className="font-bold text-on-surface">
                            {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:
                            {String(secondsLeft % 60).padStart(2, '0')}
                          </span></>
                        : <span className="text-red-500 font-semibold">Mã đã hết hạn, vui lòng gửi lại.</span>}
                    </p>
                    <button
                      onClick={() => sendOtp(form, reasonInput, true)}
                      disabled={saving || resendIn > 0}
                      className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline disabled:text-on-surface-variant disabled:no-underline disabled:cursor-not-allowed"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
                      {resendIn > 0 ? `Gửi lại sau ${resendIn}s` : 'Gửi lại mã'}
                    </button>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={closeDialog}
                      className="px-5 py-2.5 text-sm font-bold text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={submitOtp}
                      disabled={verifying || otpCode.length !== 6 || secondsLeft === 0}
                      className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60"
                    >
                      {verifying
                        ? <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                        : <Save className="w-4 h-4" />}
                      Xác nhận & lưu
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

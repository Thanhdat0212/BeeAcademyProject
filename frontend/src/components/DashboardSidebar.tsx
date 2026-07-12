import { useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart2,
  Award,
  Bell,
  BookOpen,
  Camera,
  Coins,
  CreditCard,
  Database,
  DollarSign,
  Heart,
  Lock,
  LogOut,
  Megaphone,
  MessageSquare,
  Settings,
  ShoppingBag,
  Sparkles,
  Star,
  TrendingUp,
  UserCircle,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

const STUDENT_MENU_ITEMS = [
  { icon: Bell, label: 'Thông báo', path: '/notifications' },
  { icon: BookOpen, label: 'Khóa học và Bài tập', path: '/courses' },
  { icon: TrendingUp, label: 'Kết quả học tập', path: '/progress' },
  { icon: Coins, label: 'Điểm tích lũy', path: '/rewards' },
  { icon: Award, label: 'Chứng chỉ', path: '/certificates' },
  { icon: Sparkles, label: 'Trợ lý AI', path: '/ai-tutor' },
  { icon: CreditCard, label: 'Loại tài khoản', path: '/account/type' },
  { icon: Heart, label: 'Danh sách yêu thích', path: '/favorites' },
  { icon: MessageSquare, label: 'Tin nhắn', path: '/messages' },
  { icon: ShoppingBag, label: 'Lịch sử mua hàng', path: '/orders' },
  { icon: UserCircle, label: 'Hồ sơ', path: '/profile' },
  { icon: Lock, label: 'Tài khoản', path: '/account' },
  { icon: Megaphone, label: 'Khiếu nại', path: '/complaints' },
  { icon: Camera, label: 'Ảnh', path: '/account/photo' },
] as const;

const PARENT_MENU_ITEMS = [
  { icon: BarChart2, label: 'Tổng quan báo cáo', path: '/parent' },
  { icon: BookOpen, label: 'Khóa học của con', path: '/parent/courses' },
  { icon: TrendingUp, label: 'Tiến độ & Điểm số', path: '/parent/progress' },
  { icon: CreditCard, label: 'Lịch sử thanh toán', path: '/parent/payments' },
  { icon: MessageSquare, label: 'Tin nhắn giáo viên', path: '/parent/messages' },
  { icon: Settings, label: 'Liên kết tài khoản con', path: '/parent/link' },
  { icon: Camera, label: 'Ảnh đại diện phụ huynh', path: '/account/photo' },
] as const;

const TEACHER_MENU_ITEMS = [
  { icon: UserCircle, label: 'Dashboard tổng quan', path: '/teacher' },
  { icon: BookOpen, label: 'Khóa học của tôi', path: '/teacher/courses' },
  { icon: Star, label: 'Đánh giá khóa học', path: '/teacher/reviews' },
  { icon: BookOpen, label: 'Nội dung giảng dạy', path: '/teacher/content' },
  { icon: BookOpen, label: 'Quản lý Quiz', path: '/teacher/quiz' },
  { icon: Database, label: 'Ngân hàng câu hỏi', path: '/teacher/questions' },
  { icon: BookOpen, label: 'Quản lý Đề kiểm tra', path: '/teacher/exam' },
  { icon: BookOpen, label: 'Chấm bài tự luận', path: '/teacher/grades' },
  { icon: MessageSquare, label: 'Hỏi đáp (Q&A)', path: '/teacher/qa' },
  { icon: CreditCard, label: 'Báo cáo doanh thu', path: '/teacher/revenue' },
  { icon: CreditCard, label: 'Tài khoản nhận tiền', path: '/teacher/bank' },
  { icon: Megaphone, label: 'Khiếu nại/Hỗ trợ', path: '/teacher/complaints' },
  { icon: UserCircle, label: 'Hồ sơ', path: '/teacher/profile' },
  { icon: Lock, label: 'Tài khoản', path: '/teacher/account' },
  { icon: Camera, label: 'Ảnh đại diện', path: '/account/photo' },
] as const;

const ADMIN_MENU_ITEMS = [
  { icon: UserCircle, label: 'Dashboard Admin', path: '/admin' },
  { icon: UserCircle, label: 'Quản lý giáo viên', path: '/admin/teachers' },
  { icon: CreditCard, label: 'Kế toán & Thu chi', path: '/admin/accounting' },
  { icon: DollarSign, label: 'Lương & Thù lao', path: '/admin/salary' },
  { icon: BarChart2, label: 'Báo cáo hệ thống', path: '/admin/reports' },
  { icon: Settings, label: 'Cài đặt hệ thống', path: '/admin/settings' },
  { icon: Camera, label: 'Ảnh đại diện', path: '/account/photo' },
] as const;

interface DashboardSidebarProps {
  floating?: boolean;
  onClose?: () => void;
  onLogout?: () => void;
}

export default function DashboardSidebar({
  floating = false,
  onClose,
  onLogout,
}: DashboardSidebarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const user = useAuthStore(state => state.user);

  const avatarSrc =
    user?.avatar ??
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? 'User')}&background=e2e8f0&color=64748b&bold=true&size=128`;

  function handleItemClick(path: string) {
    navigate(path);
    onClose?.();
  }

  const asideClass = floating
    ? 'w-[264px] flex-shrink-0 bg-surface-container-lowest rounded-2xl shadow-2xl shadow-black/12 border border-outline-variant/30 overflow-hidden'
    : 'w-[264px] flex-shrink-0 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden sticky top-[calc(5rem+1px)] self-start';

  const menuItems = user?.role === 'teacher'
    ? TEACHER_MENU_ITEMS
    : user?.role === 'admin'
      ? ADMIN_MENU_ITEMS
      : user?.role === 'parent'
        ? PARENT_MENU_ITEMS
        : STUDENT_MENU_ITEMS;

  return (
    <aside className={asideClass}>
      <div className="flex flex-col items-center border-b border-outline-variant/20 px-4 pb-5 pt-7">
        <div className="mb-3 h-20 w-20 flex-shrink-0 overflow-hidden rounded-full border-2 border-outline-variant/40 bg-surface-container">
          <img
            src={avatarSrc}
            alt={user?.name ?? 'Người dùng'}
            className="h-full w-full object-cover"
          />
        </div>
        <p className="text-center text-sm font-bold leading-tight text-on-surface">
          {user?.name ?? '-'}
        </p>
        <p className="mt-1 w-full truncate px-2 text-center text-xs text-on-surface-variant">
          {user?.email ?? '-'}
        </p>
      </div>

      <nav className="space-y-0.5 p-2">
        {menuItems.map(item => {
          const isActive = pathname === item.path
            || (item.path === '/teacher/reviews'
              && pathname.startsWith('/teacher/courses/')
              && pathname.endsWith('/reviews'));

          return (
            <button
              key={item.path}
              onClick={() => handleItemClick(item.path)}
              className={`
                flex w-full items-center gap-3 rounded-xl px-3 py-2.5
                text-left text-sm font-medium transition-all duration-150
                ${isActive
                  ? 'bg-teal-500 text-white shadow-sm shadow-teal-500/25'
                  : 'text-on-surface hover:bg-surface-container'
                }
              `}
            >
              <item.icon
                className={`h-4 w-4 flex-shrink-0 ${
                  isActive ? 'text-white' : 'text-on-surface-variant'
                }`}
              />
              {item.label}
            </button>
          );
        })}
      </nav>

      {user?.role === 'parent' && (
        <div className="m-3 rounded-2xl border border-outline-variant/30 bg-gradient-to-br from-secondary-container/20 to-primary/10 p-4">
          <p className="mb-1 text-xs font-extrabold uppercase tracking-wider text-primary">
            Gói Premium Phụ huynh
          </p>
          <p className="mb-3 text-[11px] leading-normal text-on-surface-variant">
            Theo dõi phân tích học tập nâng cao bằng AI và nhận báo cáo tự động.
          </p>
          <button
            onClick={() => navigate('/account/type')}
            className="w-full rounded-xl bg-primary py-2 text-[11px] font-bold text-on-primary shadow-sm transition-colors hover:bg-primary/90"
          >
            Nâng cấp ngay
          </button>
        </div>
      )}

      {onLogout && (
        <div className="border-t border-outline-variant/20 p-2">
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-500 transition-colors hover:bg-red-50"
          >
            <LogOut className="h-4 w-4 flex-shrink-0 text-red-500" />
            Đăng xuất
          </button>
        </div>
      )}
    </aside>
  );
}

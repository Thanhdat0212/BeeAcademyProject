// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: DashboardSidebar
//
// Dùng được ở HAI chế độ:
//
//   1. floating={false} (mặc định) — cột trái cố định trong layout 2 cột
//      sticky top-[calc(5rem+1px)], shadow nhẹ, self-start
//
//   2. floating={true} — panel dropdown từ avatar header
//      Không sticky, shadow đậm hơn, z-index do parent motion.div quản lý
//      → onClose() gọi khi click menu item để đóng dropdown
//      → onLogout() gọi khi click "Đăng xuất" (chỉ hiện khi prop này được truyền)
//
// NỘI DUNG:
//   - Avatar + Tên + Email (từ useAuthStore)
//   - 8 mục menu điều hướng
//   - (floating) Nút "Đăng xuất" ở cuối
//
// TRẠNG THÁI MENU:
//   active  — pathname === item.path → nền teal, chữ trắng
//   hover   — nền xám nhạt
// ═══════════════════════════════════════════════════════════════════════════════

import { useNavigate, useLocation } from 'react-router-dom';
import {
  BookOpen, CreditCard, Heart, MessageSquare,
  ShoppingBag, UserCircle, Camera, LogOut, Lock, Megaphone,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

// ─── Cấu hình 8 mục menu ─────────────────────────────────────────────────────
const MENU_ITEMS = [
  { icon: BookOpen,      label: 'Khóa học và Bài tập', path: '/courses'       },
  { icon: CreditCard,    label: 'Loại tài khoản',       path: '/account/type'  },
  { icon: Heart,         label: 'Danh sách yêu thích',  path: '/favorites'     },
  { icon: MessageSquare, label: 'Tin nhắn',              path: '/messages'      },
  { icon: ShoppingBag,   label: 'Lịch sử mua hàng',     path: '/orders'        },
  { icon: UserCircle,    label: 'Hồ sơ',                 path: '/profile'       },
  { icon: Lock,          label: 'Tài khoản',             path: '/account'       },
  { icon: Megaphone,     label: 'Khiếu nại',              path: '/complaints'    },
  { icon: Camera,        label: 'Ảnh',                   path: '/account/photo' },
] as const;

// ─── Props ────────────────────────────────────────────────────────────────────
interface DashboardSidebarProps {
  // floating=true: dùng như dropdown panel từ avatar (không sticky)
  floating?: boolean;
  // Gọi sau khi user click menu item — dùng để đóng dropdown ở DashboardHeader
  onClose?: () => void;
  // Nếu được truyền → hiện nút "Đăng xuất" ở cuối sidebar
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

  // Avatar URL: dùng ảnh user nếu có, fallback sang ui-avatars xám
  const avatarSrc =
    user?.avatar ??
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? 'User')}&background=e2e8f0&color=64748b&bold=true&size=128`;

  // Click menu item: navigate + đóng dropdown nếu đang ở chế độ floating
  function handleItemClick(path: string) {
    navigate(path);
    onClose?.();
  }

  // className của <aside> thay đổi theo chế độ:
  // - floating: không sticky, shadow đậm (trông như card nổi)
  // - column:   sticky bên dưới header, shadow nhẹ (trông như sidebar tĩnh)
  const asideClass = floating
    ? 'w-[264px] flex-shrink-0 bg-surface-container-lowest rounded-2xl shadow-2xl shadow-black/12 border border-outline-variant/30 overflow-hidden'
    : 'w-[264px] flex-shrink-0 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden sticky top-[calc(5rem+1px)] self-start';

  return (
    <aside className={asideClass}>

      {/* ── Phần trên: Avatar + Tên + Email ─────────────────────────────────── */}
      <div className="flex flex-col items-center pt-7 pb-5 px-4 border-b border-outline-variant/20">
        <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-outline-variant/40 mb-3 flex-shrink-0 bg-surface-container">
          <img
            src={avatarSrc}
            alt={user?.name ?? 'Người dùng'}
            className="w-full h-full object-cover"
          />
        </div>
        <p className="font-bold text-on-surface text-sm text-center leading-tight">
          {user?.name ?? '—'}
        </p>
        <p className="text-xs text-on-surface-variant mt-1 text-center truncate w-full px-2">
          {user?.email ?? '—'}
        </p>
      </div>

      {/* ── Phần giữa: Danh sách menu ────────────────────────────────────────── */}
      <nav className="p-2 space-y-0.5">
        {MENU_ITEMS.map(item => {
          // exact match: '/account' không active khi ở '/account/type'
          const isActive = pathname === item.path;

          return (
            <button
              key={item.path}
              onClick={() => handleItemClick(item.path)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                text-sm font-medium text-left transition-all duration-150
                ${isActive
                  ? 'bg-teal-500 text-white shadow-sm shadow-teal-500/25'
                  : 'text-on-surface hover:bg-surface-container'
                }
              `}
            >
              <item.icon
                className={`w-4 h-4 flex-shrink-0 ${
                  isActive ? 'text-white' : 'text-on-surface-variant'
                }`}
              />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* ── Phần dưới: Nút Đăng xuất ─────────────────────────────────────────
          Chỉ hiển thị khi onLogout được truyền (chế độ floating dropdown)
          Không hiện khi dùng như cột sidebar tĩnh trên trang
      ─────────────────────────────────────────────────────────────────────── */}
      {onLogout && (
        <div className="border-t border-outline-variant/20 p-2">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors text-left"
          >
            <LogOut className="w-4 h-4 flex-shrink-0 text-red-500" />
            Đăng xuất
          </button>
        </div>
      )}

    </aside>
  );
}

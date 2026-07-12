import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useSystemStore } from '../store/useSystemStore';
import { getSystemStatus } from '../api/systemService';
import MaintenancePage from '../pages/common/MaintenancePage';

const POLL_INTERVAL_MS = 30_000;

// Trang phải luôn truy cập được kể cả khi đang bảo trì, để Admin còn đăng
// nhập lại và tắt chế độ bảo trì.
const ALWAYS_ALLOWED_PATHS = ['/login', '/auth/callback'];

interface Props {
  children: React.ReactNode;
}

/**
 * Bọc toàn bộ <Routes> trong App.tsx. Poll trạng thái bảo trì định kỳ và
 * chặn mọi role khác admin (kể cả khách chưa đăng nhập) bằng MaintenancePage.
 *
 * apiClient (client.ts) cũng tự set maintenanceMode=true ngay khi bất kỳ
 * request nào trả về 503 MAINTENANCE_MODE, nên user bị chặn ngay ở lần gọi
 * API tiếp theo thay vì phải chờ tới vòng poll kế tiếp.
 */
export default function MaintenanceGate({ children }: Props) {
  const maintenanceMode = useSystemStore((s) => s.maintenanceMode);
  const setMaintenanceMode = useSystemStore((s) => s.setMaintenanceMode);
  const setMaintenanceUntil = useSystemStore((s) => s.setMaintenanceUntil);
  const role = useAuthStore((s) => s.user?.role);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const status = await getSystemStatus();
        if (!cancelled) {
          setMaintenanceMode(status.maintenanceMode);
          setMaintenanceUntil(status.maintenanceUntil);
        }
      } catch {
        // Lỗi mạng khi poll status không nên tự ý khoá app - giữ nguyên state hiện tại.
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [setMaintenanceMode, setMaintenanceUntil]);

  const isAllowedPath = ALWAYS_ALLOWED_PATHS.includes(location.pathname);

  if (maintenanceMode && role !== 'admin' && !isAllowedPath) {
    return <MaintenancePage />;
  }

  return <>{children}</>;
}

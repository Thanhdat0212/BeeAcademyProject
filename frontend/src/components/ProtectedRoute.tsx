import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

interface Props {
  children: React.ReactNode;
  /** Nếu truyền vào, kiểm tra thêm role. Không truyền = chỉ cần đăng nhập. */
  role?: 'student' | 'parent' | 'teacher' | 'admin';
  /** Route redirect khi chưa đăng nhập (mặc định /login). */
  redirectTo?: string;
}

/**
 * Bọc bất kỳ route nào cần xác thực.
 *
 * Luồng:
 *   1. Chưa đăng nhập → redirect /login, ghi nhớ from để login xong quay lại.
 *   2. Đã đăng nhập nhưng sai role → redirect về trang chính của role đó.
 *   3. Đúng role → render children.
 *
 * Ví dụ dùng trong App.tsx:
 *   <Route path="/teacher/courses" element={
 *     <ProtectedRoute role="teacher"><TeacherCoursesPage /></ProtectedRoute>
 *   } />
 */
export default function ProtectedRoute({ children, role, redirectTo = '/login' }: Props) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const user       = useAuthStore((s) => s.user);
  const location   = useLocation();

  // Chưa đăng nhập → về login, lưu current path để login xong redirect lại
  if (!isLoggedIn) {
    return (
      <Navigate
        to={redirectTo}
        state={{ from: location.pathname + location.search }}
        replace
      />
    );
  }

  // Sai role → redirect về homepage của role hiện tại
  if (role && user?.role !== role) {
    const homepageByRole: Record<string, string> = {
      student: '/courses',
      teacher: '/teacher',
      admin:   '/admin',
      parent:  '/parent',
    };
    const home = user?.role ? homepageByRole[user.role] ?? '/' : '/';
    return <Navigate to={home} replace />;
  }

  return <>{children}</>;
}

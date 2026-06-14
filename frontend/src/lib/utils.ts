import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Trang chủ mặc định của từng role sau khi đăng nhập.
// Dùng chung cho Login (email/password) và OAuthCallbackPage (Google) để
// điều hướng nhất quán — tránh tình trạng GV/Admin/PH bị đưa nhầm về /courses.
const ROLE_HOME: Record<string, string> = {
  teacher: '/teacher',
  admin: '/admin',
  parent: '/parent',
  student: '/courses',
};

/**
 * Trả về đường dẫn trang chủ tương ứng với role.
 * So sánh không phân biệt hoa/thường để an toàn nếu BE đổi sang "TEACHER".
 * Mặc định /courses nếu role null hoặc không nhận diện được.
 */
export function resolveRoleHome(role?: string | null): string {
  if (!role) return '/courses';
  return ROLE_HOME[role.toLowerCase()] ?? '/courses';
}

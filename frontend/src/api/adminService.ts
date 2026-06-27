/**
 * adminService — API cho Admin Dashboard (UC34)
 *
 * GET /api/admin/dashboard/overview — toàn bộ số liệu tab Overview trong
 * 1 call: thẻ tài chính + đơn hàng gần đây + bảng xếp hạng khóa học.
 */

import { apiClient, unwrap } from './client';
import type { ApiResponse } from '../types/api';

/** Một đơn hàng PAID gần đây — courseTitles đã được backend gộp sẵn. */
export interface AdminRecentOrder {
  id: string;
  paymentRef: string;
  studentName: string;
  courseTitles: string;
  amount: number;
  paidAt: string; // ISO Instant — backend đảm bảo không null
}

/** Một dòng bảng xếp hạng — backend đã sort theo enrollmentCount giảm dần. */
export interface AdminTopCourse {
  id: string;
  title: string;
  teacherName: string;
  categoryName: string;
  enrollmentCount: number;
}

export interface AdminOverview {
  totalGmv: number;
  totalPlatformFee: number;
  totalPendingPayout: number;
  totalFundsHeld: number;
  overdueTeacherCount: number;
  recentOrders: AdminRecentOrder[];
  topCourses: AdminTopCourse[];
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const res = await apiClient.get<ApiResponse<AdminOverview>>(
    '/api/admin/dashboard/overview',
  );
  return unwrap(res.data);
}

export interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  targetPath: string | null;
  courseId: string | null;
  actorName: string | null;
  unread: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface AdminNotificationSummary {
  unreadCount: number;
  notifications: AdminNotification[];
}

export async function listAdminNotifications(unreadOnly = false):
    Promise<AdminNotificationSummary> {
  const res = await apiClient.get<ApiResponse<AdminNotificationSummary>>(
    '/api/admin/notifications',
    { params: { unreadOnly } },
  );
  return unwrap(res.data);
}

export async function markAdminNotificationRead(notificationId: string):
    Promise<AdminNotification> {
  const res = await apiClient.patch<ApiResponse<AdminNotification>>(
    `/api/admin/notifications/${notificationId}/read`,
  );
  return unwrap(res.data);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Kế toán & Lương (UC37 / UC39 / UC40)
//  GET   /api/admin/payouts          — danh sách kỳ đối soát theo GV/tháng
//  GET   /api/admin/payouts/stats    — 3 thẻ thống kê
//  PATCH /api/admin/payouts/:id/confirm — xác nhận đã chuyển khoản
// ─────────────────────────────────────────────────────────────────────────────

export type PayoutStatus = 'PENDING' | 'PROCESSING' | 'PAID';

/** Một dòng đối soát — mỗi GV trong 1 kỳ (tháng). */
export interface AdminPayoutRow {
  periodId: string;
  teacherId: string;
  teacherName: string;
  monthYear: string;
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  totalGross: number;
  platformFee: number;
  teacherAmount: number;
  transactionCount: number;
  status: PayoutStatus;
  /** Kỳ chưa PAID thuộc tháng đã qua → cảnh báo trễ hạn. */
  overdue: boolean;
  paidAt: string | null;
  transferRef: string | null;
  transferContent: string | null;
}

export interface AdminPayoutStats {
  currentMonthGross: number;
  pendingTeacherAmount: number;
  netPlatformFee: number;
}

export interface ConfirmPayoutPayload {
  transferRef: string;
  transferContent?: string;
}

export async function getAdminPayouts(): Promise<AdminPayoutRow[]> {
  const res = await apiClient.get<ApiResponse<AdminPayoutRow[]>>('/api/admin/payouts');
  return unwrap(res.data) ?? [];
}

export async function getAdminPayoutStats(): Promise<AdminPayoutStats> {
  const res = await apiClient.get<ApiResponse<AdminPayoutStats>>('/api/admin/payouts/stats');
  return unwrap(res.data);
}

export async function confirmPayout(
  periodId: string,
  payload: ConfirmPayoutPayload,
): Promise<AdminPayoutRow> {
  const res = await apiClient.patch<ApiResponse<AdminPayoutRow>>(
    `/api/admin/payouts/${periodId}/confirm`,
    payload,
  );
  return unwrap(res.data);
}

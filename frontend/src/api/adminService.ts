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

export type BroadcastTargetRole = 'ALL' | 'STUDENT' | 'TEACHER' | 'PARENT';

export interface BroadcastNotificationPayload {
  targetRole: BroadcastTargetRole;
  title: string;
  body: string;
  targetUrl?: string;
}

export interface BroadcastNotificationResult {
  recipientCount: number;
}

export async function broadcastNotification(
  payload: BroadcastNotificationPayload,
): Promise<BroadcastNotificationResult> {
  const res = await apiClient.post<ApiResponse<BroadcastNotificationResult>>(
    '/api/admin/notifications/broadcast',
    payload,
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
export type BankVerifyStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

/** Một dòng đối soát — mỗi GV trong 1 kỳ (tháng). */
export interface AdminPayoutRow {
  periodId: string;
  teacherId: string;
  teacherName: string;
  monthYear: string;
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  /** TK chưa VERIFIED thì kỳ chi trả bị hold (REQ-ADM-006 AC6). */
  bankVerifyStatus: BankVerifyStatus | null;
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

// ─────────────────────────────────────────────────────────────────────────────
// Duyệt TK ngân hàng GV — TK PENDING giữ (hold) chi trả cho tới khi Admin duyệt
//  GET   /api/admin/bank-accounts/pending
//  PATCH /api/admin/bank-accounts/:teacherId/review
// ─────────────────────────────────────────────────────────────────────────────

export interface AdminBankAccount {
  teacherId: string;
  teacherName: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  branch: string | null;
  verifyStatus: BankVerifyStatus;
  updatedAt: string;
}

export async function getPendingBankAccounts(): Promise<AdminBankAccount[]> {
  const res = await apiClient.get<ApiResponse<AdminBankAccount[]>>(
    '/api/admin/bank-accounts/pending',
  );
  return unwrap(res.data) ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
//  Báo cáo & Thống kê (UC37) — biểu đồ time-series + phân bố
//  GET /api/admin/analytics/{revenue-trend,enrollment-trend,user-growth,courses-by-category}
//  GET /api/admin/users/stats — phân bố vai trò người dùng
// ─────────────────────────────────────────────────────────────────────────────

/** Điểm doanh thu theo tháng (toàn hệ thống) — month định dạng "yyyy-MM". */
export interface RevenueTrendPoint {
  month: string;
  gross: number;
  teacherAmount: number;
  platformFee: number;
  count: number;
}

/** Điểm dạng (nhãn, số lượng) — trend đăng ký/người dùng, phân bố danh mục. */
export interface CountPoint {
  label: string;
  count: number;
}

/** Số lượng user theo vai trò — cho donut phân bố. */
export interface AdminUserStats {
  students: number;
  teachers: number;
  parents: number;
  total: number;
}

export async function getAdminRevenueTrend(): Promise<RevenueTrendPoint[]> {
  const res = await apiClient.get<ApiResponse<RevenueTrendPoint[]>>(
    '/api/admin/analytics/revenue-trend',
  );
  return unwrap(res.data) ?? [];
}

export async function getAdminEnrollmentTrend(): Promise<CountPoint[]> {
  const res = await apiClient.get<ApiResponse<CountPoint[]>>(
    '/api/admin/analytics/enrollment-trend',
  );
  return unwrap(res.data) ?? [];
}

export async function getUserGrowth(): Promise<CountPoint[]> {
  const res = await apiClient.get<ApiResponse<CountPoint[]>>(
    '/api/admin/analytics/user-growth',
  );
  return unwrap(res.data) ?? [];
}

export async function getCoursesByCategory(): Promise<CountPoint[]> {
  const res = await apiClient.get<ApiResponse<CountPoint[]>>(
    '/api/admin/analytics/courses-by-category',
  );
  return unwrap(res.data) ?? [];
}

export async function getAdminUserStats(): Promise<AdminUserStats> {
  const res = await apiClient.get<ApiResponse<AdminUserStats>>('/api/admin/users/stats');
  return unwrap(res.data);
}

export async function reviewBankAccount(
  teacherId: string,
  approve: boolean,
  note?: string,
): Promise<AdminBankAccount> {
  const res = await apiClient.patch<ApiResponse<AdminBankAccount>>(
    `/api/admin/bank-accounts/${teacherId}/review`,
    { approve, note },
  );
  return unwrap(res.data);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Duyệt khóa học (UC36) — admin xem thử tài liệu bài học trước khi duyệt
//  GET /api/admin/courses/{courseId}/documents/{documentId}/download
// ─────────────────────────────────────────────────────────────────────────────

/** Signed URL ngắn hạn (10 phút) — expiresAt null nếu là public URL legacy. */
export interface AdminDocumentUrl {
  url: string;
  expiresAt: string | null;
}

export async function getAdminDocumentUrl(
  courseId: string,
  documentId: string,
): Promise<AdminDocumentUrl> {
  const res = await apiClient.get<ApiResponse<AdminDocumentUrl>>(
    `/api/admin/courses/${courseId}/documents/${documentId}/download`,
  );
  return unwrap(res.data);
}

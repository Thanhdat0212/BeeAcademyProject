import { apiClient } from './client';

export type PayoutStatus = 'PENDING' | 'PROCESSING' | 'PAID';

export interface RevenueSplitResponse {
  id: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseTitle: string;
  grossAmount: number;
  platformFee: number;
  teacherAmount: number;
  teacherPercent: number;
  occurredAt: string;
  payoutPeriodId: string;
}

export interface PayoutPeriodResponse {
  id: string;
  monthYear: string;
  transactionCount: number;
  totalGross: number;
  totalPlatformFee: number;
  totalTeacherAmount: number;
  status: PayoutStatus;
  paidAt: string | null;
  transferRef: string | null;
  transferContent: string | null;
}

/**
 * Tổng hợp số liệu dashboard giáo viên — trả về từ GET /api/teacher/revenue/stats/overview.
 *
 * Thay thế việc gọi 3 API riêng lẻ (/splits, /periods, /courses) rồi tính client-side.
 * Server tổng hợp 1 lần, frontend chỉ cần render.
 */
export interface TeacherStatsResponse {
  // ── Doanh thu ────────────────────────────────────────────────────────────
  /** Tiền GV nhận tháng hiện tại (VND). */
  currentMonthRevenue: number;
  /** Tiền GV nhận tháng trước (để frontend tính % thay đổi). */
  previousMonthRevenue: number;

  // ── Học viên ─────────────────────────────────────────────────────────────
  /** Số học viên unique đã mua ít nhất 1 khóa của GV (không đếm trùng). */
  uniqueStudentsTotal: number;

  // ── Lượt bán ─────────────────────────────────────────────────────────────
  /** Số đơn thành công trong tháng hiện tại. */
  currentMonthSalesCount: number;
  /** Số đơn thành công tháng trước (để frontend tính % thay đổi). */
  previousMonthSalesCount: number;

  // ── Khóa học ─────────────────────────────────────────────────────────────
  /** Số khóa học đang PUBLISHED. */
  publishedCoursesCount: number;
  /**
   * Map courseId → số lượng enrollment.
   * Dùng để vẽ bar chart "X đơn" trên panel "Khóa học của tôi".
   */
  courseEnrollmentCounts: Record<string, number>;

  // ── Giao dịch gần đây ────────────────────────────────────────────────────
  /** 8 giao dịch gần nhất — hiển thị bảng "Doanh số gần đây". */
  recentSplits: RevenueSplitResponse[];
}

/** Lấy tổng hợp số liệu dashboard (1 call thay 3 call). */
export async function getTeacherStats(): Promise<TeacherStatsResponse> {
  const res = await apiClient.get('/api/teacher/revenue/stats/overview');
  return res.data.data;
}

/** Toàn bộ giao dịch — dùng cho trang /teacher/revenue tab Chi tiết. */
export async function getRevenueSplits(): Promise<RevenueSplitResponse[]> {
  const res = await apiClient.get('/api/teacher/revenue/splits');
  return res.data.data ?? [];
}

/** Danh sách kỳ thanh toán — dùng cho trang /teacher/revenue tab Kỳ thanh toán. */
export async function getPayoutPeriods(): Promise<PayoutPeriodResponse[]> {
  const res = await apiClient.get('/api/teacher/revenue/periods');
  return res.data.data ?? [];
}

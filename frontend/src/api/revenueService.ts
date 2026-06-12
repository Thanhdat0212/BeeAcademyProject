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

export async function getRevenueSplits(): Promise<RevenueSplitResponse[]> {
  const res = await apiClient.get('/api/teacher/revenue/splits');
  return res.data.data ?? [];
}

export async function getPayoutPeriods(): Promise<PayoutPeriodResponse[]> {
  const res = await apiClient.get('/api/teacher/revenue/periods');
  return res.data.data ?? [];
}

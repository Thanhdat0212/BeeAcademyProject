import { apiClient } from './client';

export type BankVerifyStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface BankInfoResponse {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  branch: string;
  verifyStatus: BankVerifyStatus;
  updatedAt: string;
}

export interface BankAuditLogResponse {
  id: string;
  changedAt: string;
  changedByName: string;
  reason: string | null;
  changesJson: string;
}

export interface FieldChange {
  field: string;
  oldValue: string;
  newValue: string;
}

export async function getBankInfo(): Promise<BankInfoResponse | null> {
  const res = await apiClient.get('/api/teacher/bank');
  return res.data.data ?? null;
}

export interface BankChangeRequestResponse {
  maskedEmail: string;
  expiresAt: string;
  changes: FieldChange[];
}

export interface BankInfoInput {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  branch: string;
  reason?: string;
}

/**
 * Bước 1 — xin mã xác nhận gửi về email GV. Backend CHƯA ghi gì vào DB ở bước
 * này, nên gọi xong mà bỏ ngang thì TK hiện tại vẫn nguyên vẹn.
 * Gọi lại chính hàm này để gửi lại mã (backend chặn spam bằng cooldown 60 giây).
 */
export async function requestBankChange(data: BankInfoInput): Promise<BankChangeRequestResponse> {
  const res = await apiClient.post('/api/teacher/bank/change-requests', data);
  return res.data.data;
}

/** Bước 2 — mã đúng thì TK được lưu và chuyển thẳng sang trạng thái đã xác minh. */
export async function verifyBankChange(otpCode: string): Promise<BankInfoResponse> {
  const res = await apiClient.post('/api/teacher/bank/change-requests/verify', { otpCode });
  return res.data.data;
}

export async function getBankAuditLog(): Promise<BankAuditLogResponse[]> {
  const res = await apiClient.get('/api/teacher/bank/audit-log');
  return res.data.data ?? [];
}

export function parseChanges(changesJson: string): FieldChange[] {
  try {
    return JSON.parse(changesJson) as FieldChange[];
  } catch {
    return [];
  }
}

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

export async function upsertBankInfo(data: {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  branch: string;
  reason?: string;
}): Promise<BankInfoResponse> {
  const res = await apiClient.put('/api/teacher/bank', data);
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

import { apiClient } from './client';

export type StudentRewardVoucherStatus = 'AVAILABLE' | 'RESERVED' | 'USED';

export interface RewardVoucher {
  id: string;
  code: string;
  displayName: string;
  requiredPoints: number;
  discountAmount: number;
  active: boolean;
}

export interface StudentRewardVoucher {
  id: string;
  voucherId: string;
  code: string;
  displayName: string;
  discountAmount: number;
  status: StudentRewardVoucherStatus;
  redeemedAt: string;
  usedAt: string | null;
}

export interface RewardWallet {
  availablePoints: number;
  lifetimePoints: number;
  catalog: RewardVoucher[];
  vouchers: StudentRewardVoucher[];
}

export async function getRewardWallet(): Promise<RewardWallet> {
  const res = await apiClient.get('/api/rewards/wallet');
  return res.data.data;
}

export async function redeemRewardVoucher(voucherId: string): Promise<RewardWallet> {
  const res = await apiClient.post(`/api/rewards/vouchers/${voucherId}/redeem`);
  return res.data.data;
}

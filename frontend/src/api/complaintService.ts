/**
 * complaintService — Khiếu nại (UC11 gửi / UC38 Admin xử lý)
 *
 * Hai nhóm endpoint:
 *  - Phía người gửi (HS/PH/GV): /api/complaints
 *  - Phía Admin:                /api/admin/complaints
 */

import { apiClient, unwrap } from './client';
import type { ApiResponse, PageResponse } from '../types/api';

// ── Kiểu dữ liệu (mirror backend) ───────────────────────────────────────────

export type ComplaintStatus = 'pending' | 'in_progress' | 'resolved' | 'rejected';
export type ComplaintPriority = 'low' | 'medium' | 'high';
export type ComplaintCategory =
  | 'payment'
  | 'course_review'
  | 'bank_verify'
  | 'student_report'
  | 'content'
  | 'technical'
  | 'other';

export interface ComplaintMessage {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: 'student' | 'parent' | 'teacher' | 'admin';
  content: string;
  sentAt: string;
}

/** Thread đầy đủ — màn chi tiết (panel phải / trang người gửi). */
export interface ComplaintDetail {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'student' | 'parent' | 'teacher' | 'admin';
  title: string;
  category: ComplaintCategory;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  createdAt: string;
  lastActivityAt: string;
  messages: ComplaintMessage[];
}

/** Tóm tắt — danh sách panel trái của Admin inbox (không kèm thread). */
export interface ComplaintSummary {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'student' | 'parent' | 'teacher' | 'admin';
  title: string;
  category: ComplaintCategory;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  createdAt: string;
  lastActivityAt: string;
}

export interface ComplaintStats {
  pending: number;
  inProgress: number;
  closed: number;
  total: number;
}

export interface CreateComplaintPayload {
  title: string;
  category: ComplaintCategory;
  priority: ComplaintPriority;
  content: string;
}

// ── Nhãn tiếng Việt dùng chung cho UI ───────────────────────────────────────

export const CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  payment: 'Thanh toán / Doanh thu',
  course_review: 'Duyệt khóa học',
  bank_verify: 'TK ngân hàng',
  student_report: 'Báo cáo học sinh',
  content: 'Chất lượng nội dung',
  technical: 'Lỗi kỹ thuật',
  other: 'Khác',
};

export const PRIORITY_LABELS: Record<ComplaintPriority, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
};

export const STATUS_LABELS: Record<ComplaintStatus, string> = {
  pending: 'Chờ xử lý',
  in_progress: 'Đang xử lý',
  resolved: 'Đã giải quyết',
  rejected: 'Đã từ chối',
};

// ── Phía người gửi (HS / PH / GV) ───────────────────────────────────────────

export async function createComplaint(payload: CreateComplaintPayload): Promise<ComplaintDetail> {
  const res = await apiClient.post<ApiResponse<ComplaintDetail>>('/api/complaints', payload);
  return unwrap(res.data);
}

export async function getMyComplaints(): Promise<ComplaintDetail[]> {
  const res = await apiClient.get<ApiResponse<ComplaintDetail[]>>('/api/complaints');
  return unwrap(res.data) ?? [];
}

export async function replyToMyComplaint(id: string, content: string): Promise<ComplaintDetail> {
  const res = await apiClient.post<ApiResponse<ComplaintDetail>>(
    `/api/complaints/${id}/messages`,
    { content },
  );
  return unwrap(res.data);
}

// ── Phía Admin (UC38) ───────────────────────────────────────────────────────

export interface AdminComplaintQuery {
  status?: ComplaintStatus | '';
  search?: string;
  page?: number;
  size?: number;
}

export async function getAdminComplaints(
  query: AdminComplaintQuery = {},
): Promise<PageResponse<ComplaintSummary>> {
  const params: Record<string, string | number> = {
    page: query.page ?? 0,
    size: query.size ?? 30,
  };
  if (query.status) params.status = query.status;
  if (query.search?.trim()) params.search = query.search.trim();
  const res = await apiClient.get<ApiResponse<PageResponse<ComplaintSummary>>>(
    '/api/admin/complaints',
    { params },
  );
  return unwrap(res.data);
}

export async function getAdminComplaint(id: string): Promise<ComplaintDetail> {
  const res = await apiClient.get<ApiResponse<ComplaintDetail>>(`/api/admin/complaints/${id}`);
  return unwrap(res.data);
}

export async function getAdminComplaintStats(): Promise<ComplaintStats> {
  const res = await apiClient.get<ApiResponse<ComplaintStats>>('/api/admin/complaints/stats');
  return unwrap(res.data);
}

export async function adminReplyComplaint(id: string, content: string): Promise<ComplaintDetail> {
  const res = await apiClient.post<ApiResponse<ComplaintDetail>>(
    `/api/admin/complaints/${id}/reply`,
    { content },
  );
  return unwrap(res.data);
}

export async function adminUpdateComplaintStatus(
  id: string,
  status: Exclude<ComplaintStatus, 'pending'>,
): Promise<ComplaintDetail> {
  const res = await apiClient.patch<ApiResponse<ComplaintDetail>>(
    `/api/admin/complaints/${id}/status`,
    { status },
  );
  return unwrap(res.data);
}

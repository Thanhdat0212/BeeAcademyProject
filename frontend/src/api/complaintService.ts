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
// Tất cả category hợp lệ ở DB — mỗi role dùng 1 subset khi tạo khiếu nại
export type ComplaintCategory =
  | 'payment'         // Thanh toán / Doanh thu
  | 'course_review'   // Duyệt khóa học (GV)
  | 'bank_verify'     // TK ngân hàng (GV)
  | 'student_report'  // Báo cáo học sinh (GV)
  | 'content'         // Nội dung (GV — alias)
  | 'course_content'  // Nội dung khóa học (HS)
  | 'teacher'         // Giáo viên (HS)
  | 'grading'         // Chấm điểm / Quiz (HS)
  | 'parent_link'     // Liên kết phụ huynh (HS)
  | 'technical'       // Lỗi kỹ thuật
  | 'system'          // Lỗi hệ thống (Admin)
  | 'other';

export interface ComplaintAttachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  url: string;
}

export interface ComplaintMessage {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: 'student' | 'parent' | 'teacher' | 'admin';
  content: string;
  sentAt: string;
  attachments: ComplaintAttachment[];
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
  payment:        'Thanh toán / Doanh thu',
  course_review:  'Duyệt khóa học',
  bank_verify:    'TK ngân hàng',
  student_report: 'Báo cáo học sinh',
  content:        'Chất lượng nội dung',
  course_content: 'Nội dung khóa học',
  teacher:        'Giáo viên',
  grading:        'Chấm điểm / Quiz',
  parent_link:    'Liên kết phụ huynh',
  technical:      'Lỗi kỹ thuật',
  system:         'Lỗi hệ thống',
  other:          'Khác',
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

// ── Giới hạn file đính kèm (mirror backend) ─────────────────────────────────
export const ATTACHMENT_MAX_FILES = 5;
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const ATTACHMENT_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

// Backend nhận multipart: phần JSON tên "data" + các file tên "files".
function buildComplaintForm(data: object, files?: File[]): FormData {
  const form = new FormData();
  form.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
  (files ?? []).forEach(file => form.append('files', file));
  return form;
}

// Upload có thể lớn (tối đa 5 file) → nới timeout so với mặc định 15s.
const UPLOAD_CONFIG = { timeout: 60000 };

// ── Phía người gửi (HS / PH / GV) ───────────────────────────────────────────

export async function createComplaint(
  payload: CreateComplaintPayload,
  files?: File[],
): Promise<ComplaintDetail> {
  const res = await apiClient.post<ApiResponse<ComplaintDetail>>(
    '/api/complaints',
    buildComplaintForm(payload, files),
    UPLOAD_CONFIG,
  );
  return unwrap(res.data);
}

export async function getMyComplaints(): Promise<ComplaintDetail[]> {
  const res = await apiClient.get<ApiResponse<ComplaintDetail[]>>('/api/complaints');
  return unwrap(res.data) ?? [];
}

export async function replyToMyComplaint(
  id: string,
  content: string,
  files?: File[],
): Promise<ComplaintDetail> {
  const res = await apiClient.post<ApiResponse<ComplaintDetail>>(
    `/api/complaints/${id}/messages`,
    buildComplaintForm({ content }, files),
    UPLOAD_CONFIG,
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

export async function adminReplyComplaint(
  id: string,
  content: string,
  files?: File[],
): Promise<ComplaintDetail> {
  const res = await apiClient.post<ApiResponse<ComplaintDetail>>(
    `/api/admin/complaints/${id}/reply`,
    buildComplaintForm({ content }, files),
    UPLOAD_CONFIG,
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

// ── Aliases theo role — tất cả gọi cùng endpoint /api/complaints ─────────────
// Đặt alias để teacher/student page import tên rõ nghĩa mà không tự định nghĩa lại type
export const listTeacherComplaints  = getMyComplaints;
export const createTeacherComplaint = createComplaint;
export const addTeacherComplaintMessage = (id: string, content: string, files?: File[]) => replyToMyComplaint(id, content, files);

export const listStudentComplaints  = getMyComplaints;
export const createStudentComplaint = createComplaint;
export const addStudentComplaintMessage = (id: string, content: string, files?: File[]) => replyToMyComplaint(id, content, files);

// Backward-compatible aliases for the all-in-one admin dashboard.
export type ComplaintThread = ComplaintDetail;

export async function listAdminComplaints(query: AdminComplaintQuery = {}): Promise<ComplaintThread[]> {
  const page = await getAdminComplaints(query);
  // Dùng summary với messages rỗng để tránh N+1 request. Detail fetch khi admin mở modal.
  return page.items.map(summary => ({ ...summary, messages: [] }));
}

export async function updateAdminComplaintStatus(
  id: string,
  status: Exclude<ComplaintStatus, 'pending'>,
  responseNote?: string,
  files?: File[],
): Promise<ComplaintThread> {
  const note = responseNote?.trim();
  if (note || (files && files.length > 0)) {
    await adminReplyComplaint(id, note ?? '', files);
  }
  return adminUpdateComplaintStatus(id, status);
}

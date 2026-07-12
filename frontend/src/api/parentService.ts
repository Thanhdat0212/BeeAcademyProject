/**
 * ============================================================================
 *  parentService - gọi các endpoint /api/parent/* của backend Spring Boot
 * ----------------------------------------------------------------------------
 *  Cung cấp các hàm giao tiếp HTTP cho phân hệ Phụ huynh (Parent Portal):
 *    - Lấy danh sách con đang liên kết.
 *    - Liên kết con mới bằng mã 6 ký tự.
 *    - Hủy liên kết con.
 *    - Xem báo cáo tổng quan học tập của con.
 * ============================================================================
 */
import { apiClient, unwrap } from './client';
import type {
  ApiResponse,
  LinkedStudentResponse,
  ChildOverviewResponse,
  ChildProgressReportResponse,
  ParentLinkInvitationResponse,
  ParentPaymentHistoryResponse,
  ParentTeacherConversationResponse,
  SendParentLinkInvitationPayload,
  UploadResponse
} from '../types/api';

/**
 * GET /api/parent/children
 * Lấy danh sách học sinh (con) đã được liên kết với tài khoản phụ huynh hiện tại.
 */
export async function getLinkedChildren(): Promise<LinkedStudentResponse[]> {
  const res = await apiClient.get<ApiResponse<LinkedStudentResponse[]>>(
    '/api/parent/children'
  );
  return unwrap(res.data);
}

/**
 * GET /api/parent/link-invitations
 * Lấy danh sách lời mời liên kết đang chờ học sinh xác nhận.
 */
export async function getLinkInvitations(): Promise<ParentLinkInvitationResponse[]> {
  const res = await apiClient.get<ApiResponse<ParentLinkInvitationResponse[]>>(
    '/api/parent/link-invitations'
  );
  return unwrap(res.data);
}

/**
 * POST /api/parent/link-invitations
 * Gửi lời mời liên kết tới email học sinh.
 */
export async function sendLinkInvitation(
  payload: SendParentLinkInvitationPayload | string,
): Promise<ParentLinkInvitationResponse> {
  const body = typeof payload === 'string'
    ? { studentEmail: payload, relationship: 'guardian' as const, note: null }
    : payload;
  const res = await apiClient.post<ApiResponse<ParentLinkInvitationResponse>>(
    '/api/parent/link-invitations',
    body
  );
  return unwrap(res.data);
}

export async function cancelLinkInvitation(studentId: string): Promise<void> {
  await apiClient.delete(`/api/parent/link-invitations/${encodeURIComponent(studentId)}`);
}



/**
 * DELETE /api/parent/children/{studentId}
 * Hủy liên kết giám sát tài khoản học sinh.
 */
export async function unlinkStudent(studentId: string): Promise<LinkedStudentResponse> {
  const res = await apiClient.delete<ApiResponse<LinkedStudentResponse>>(
    `/api/parent/children/${encodeURIComponent(studentId)}`
  );
  return unwrap(res.data);
}

export async function confirmUnlinkStudent(studentId: string): Promise<LinkedStudentResponse> {
  const res = await apiClient.post<ApiResponse<LinkedStudentResponse>>(
    `/api/parent/children/${encodeURIComponent(studentId)}/unlink-confirm`
  );
  return unwrap(res.data);
}

/**
 * GET /api/parent/children/{studentId}/overview
 * Lấy báo cáo chi tiết tổng quan tiến độ, điểm số và biểu đồ hoạt động tuần của con.
 */
export async function getChildOverview(studentId: string): Promise<ChildOverviewResponse> {
  const res = await apiClient.get<ApiResponse<ChildOverviewResponse>>(
    `/api/parent/children/${encodeURIComponent(studentId)}/overview`
  );
  return unwrap(res.data);
}

/**
 * GET /api/parent/children/{studentId}/progress-report
 * Lấy báo cáo chi tiết UC24 của con, gồm tiến độ theo khóa học và bảng điểm.
 */
export async function getChildProgressReport(studentId: string): Promise<ChildProgressReportResponse> {
  const res = await apiClient.get<ApiResponse<ChildProgressReportResponse>>(
    `/api/parent/children/${encodeURIComponent(studentId)}/progress-report`
  );
  return unwrap(res.data);
}

/**
 * GET /api/parent/children/{studentId}/payment-history
 * Lấy lịch sử thanh toán UC26 của con, gồm giao dịch của học sinh/phụ huynh và tiến độ hiện tại.
 */
export async function getChildPaymentHistory(studentId: string): Promise<ParentPaymentHistoryResponse> {
  const res = await apiClient.get<ApiResponse<ParentPaymentHistoryResponse>>(
    `/api/parent/children/${encodeURIComponent(studentId)}/payment-history`
  );
  return unwrap(res.data);
}

/**
 * GET /api/parent/children/{studentId}/teacher-conversations
 * Lấy danh sách giáo viên/khóa học mà phụ huynh có thể trao đổi cho con đang chọn.
 */
export async function getChildTeacherConversations(
  studentId: string,
): Promise<ParentTeacherConversationResponse[]> {
  const res = await apiClient.get<ApiResponse<ParentTeacherConversationResponse[]>>(
    `/api/parent/children/${encodeURIComponent(studentId)}/teacher-conversations`,
  );
  return unwrap(res.data);
}

/**
 * POST /api/parent/children/{studentId}/teacher-conversations
 * Gửi tin nhắn tới giáo viên phụ trách khóa học của con.
 */
export async function sendParentTeacherMessage(
  studentId: string,
  courseId: string,
  content: string,
  attachment?: {
    attachmentUrl: string;
    attachmentName: string;
    attachmentType: string;
    attachmentSizeBytes: number;
  } | null,
): Promise<ParentTeacherConversationResponse> {
  const res = await apiClient.post<ApiResponse<ParentTeacherConversationResponse>>(
    `/api/parent/children/${encodeURIComponent(studentId)}/teacher-conversations`,
    {
      courseId,
      content,
      attachmentUrl: attachment?.attachmentUrl ?? null,
      attachmentName: attachment?.attachmentName ?? null,
      attachmentType: attachment?.attachmentType ?? null,
      attachmentSizeBytes: attachment?.attachmentSizeBytes ?? null,
    },
  );
  return unwrap(res.data);
}

export async function uploadParentMessageAttachment(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiClient.post<ApiResponse<UploadResponse>>(
    '/api/parent/message-attachments',
    form,
    {
      timeout: 60000,
      headers: { 'Content-Type': 'multipart/form-data' },
    },
  );
  return unwrap(res.data);
}

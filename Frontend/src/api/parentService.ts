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
  ChildOverviewResponse
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
 * DELETE /api/parent/children/{studentId}
 * Hủy liên kết giám sát tài khoản học sinh.
 */
export async function unlinkStudent(studentId: string): Promise<void> {
  await apiClient.delete(`/api/parent/children/${encodeURIComponent(studentId)}`);
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

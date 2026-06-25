import { apiClient, unwrap } from './client';
import type {
  ApiResponse,
  StudentParentLinkInvitationResponse
} from '../types/api';

export async function getStudentParentLinkInvitations(): Promise<StudentParentLinkInvitationResponse[]> {
  const res = await apiClient.get<ApiResponse<StudentParentLinkInvitationResponse[]>>(
    '/api/student/parent-link-invitations'
  );
  return unwrap(res.data);
}

export async function acceptStudentParentLinkInvitation(
  parentId: string
): Promise<StudentParentLinkInvitationResponse> {
  const res = await apiClient.post<ApiResponse<StudentParentLinkInvitationResponse>>(
    `/api/student/parent-link-invitations/${encodeURIComponent(parentId)}/accept`
  );
  return unwrap(res.data);
}

export async function rejectStudentParentLinkInvitation(
  parentId: string
): Promise<StudentParentLinkInvitationResponse> {
  const res = await apiClient.post<ApiResponse<StudentParentLinkInvitationResponse>>(
    `/api/student/parent-link-invitations/${encodeURIComponent(parentId)}/reject`
  );
  return unwrap(res.data);
}

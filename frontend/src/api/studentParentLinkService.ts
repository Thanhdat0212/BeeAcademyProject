import { apiClient, unwrap } from './client';
import type { AxiosRequestConfig } from 'axios';
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

export async function getStudentLinkedParents(): Promise<StudentParentLinkInvitationResponse[]> {
  const res = await apiClient.get<ApiResponse<StudentParentLinkInvitationResponse[]>>(
    '/api/student/parent-link-invitations/linked-parents'
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

export async function unlinkStudentParent(
  parentId: string,
  reason?: string,
): Promise<StudentParentLinkInvitationResponse> {
  const operationId = crypto.randomUUID();
  const retryConfig: AxiosRequestConfig & { networkRetryCount: number } = {
    networkRetryCount: 2,
  };
  const res = await apiClient.post<ApiResponse<StudentParentLinkInvitationResponse>>(
    `/api/student/parent-link-invitations/${encodeURIComponent(parentId)}/unlink`,
    { operationId, reason: reason?.trim() || null },
    retryConfig,
  );
  return unwrap(res.data);
}

export async function updateSensitiveDataConsent(
  parentId: string,
  consentGranted: boolean
): Promise<StudentParentLinkInvitationResponse> {
  const res = await apiClient.post<ApiResponse<StudentParentLinkInvitationResponse>>(
    `/api/student/parent-link-invitations/${encodeURIComponent(parentId)}/sensitive-data-consent`,
    { consentGranted }
  );
  return unwrap(res.data);
}

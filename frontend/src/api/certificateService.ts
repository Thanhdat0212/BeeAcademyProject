import { apiClient } from './client';
import type { ApiResponse } from '../types/api';

export type CertificateStatus = 'NOT_ISSUED' | 'ISSUED' | 'NEEDS_REVIEW' | 'REISSUED' | 'REVOKED';

export interface CertificateResponse {
  id: string;
  courseId: string;
  courseTitle: string;
  teacherName: string | null;
  status: CertificateStatus;
  certificateNo: string;
  verificationCode: string;
  versionNo: number;
  issuedAt: string | null;
  revokedAt: string | null;
  reviewNote: string | null;
  viewUrl: string | null;
  downloadFileName: string | null;
  downloadUrl: string | null;
}

export interface CertificateVerificationResponse {
  valid: boolean;
  status: CertificateStatus;
  certificateNo: string;
  studentName: string | null;
  courseTitle: string;
  teacherName: string | null;
  versionNo: number;
  issuedAt: string | null;
  revokedAt: string | null;
}

export async function listMyCertificates(): Promise<CertificateResponse[]> {
  const res = await apiClient.get<ApiResponse<CertificateResponse[]>>('/api/student/certificates');
  return res.data.data;
}

export async function requestCourseCertificate(courseId: string): Promise<CertificateResponse> {
  const res = await apiClient.post<ApiResponse<CertificateResponse>>(
    `/api/student/courses/${encodeURIComponent(courseId)}/certificate`,
  );
  return res.data.data;
}

export async function getCertificate(certificateId: string): Promise<CertificateResponse> {
  const res = await apiClient.get<ApiResponse<CertificateResponse>>(
    `/api/student/certificates/${encodeURIComponent(certificateId)}`,
  );
  return res.data.data;
}

export async function verifyCertificate(verificationCode: string): Promise<CertificateVerificationResponse> {
  const res = await apiClient.get<ApiResponse<CertificateVerificationResponse>>(
    `/api/certificates/verify/${encodeURIComponent(verificationCode)}`,
  );
  return res.data.data;
}

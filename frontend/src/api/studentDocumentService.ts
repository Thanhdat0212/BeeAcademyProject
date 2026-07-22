import { apiClient } from './client';
import type { ApiResponse } from '../types/api';

export interface DocumentDownloadResponse {
  downloadUrl: string;
  expiresAt: string;
  watermarked: boolean;
  oneTime: boolean;
}

/** UC15: yêu cầu signed URL tải tài liệu của bài học đã mua. */
export async function getStudentDocumentDownload(
  courseId: string,
  lessonId: string,
  documentId: string,
): Promise<DocumentDownloadResponse> {
  const response = await apiClient.get<ApiResponse<DocumentDownloadResponse>>(
    `/api/student/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/documents/${encodeURIComponent(documentId)}/download`,
  );
  return response.data.data;
}

import { apiClient, unwrap } from './client';
import type { ApiResponse } from '../types/api';

export type QaThreadStatus = 'pending' | 'answered' | 'resolved';
export type QaAuthorRole = 'student' | 'teacher' | 'parent' | 'admin';
export type QaVisibility = 'public' | 'private';

export interface QaMessage {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: QaAuthorRole;
  content: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  attachmentSizeBytes: number | null;
  editedAt?: string | null;
  sentAt: string;
}

export interface QaAttachment {
  attachmentUrl: string;
  attachmentName: string;
  attachmentType: string;
  attachmentSizeBytes: number;
}

export interface QaThread {
  id: string;
  title: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseTitle: string;
  lessonId: string | null;
  lessonTitle: string | null;
  status: QaThreadStatus;
  visibility: QaVisibility;
  duplicateOfThreadId?: string | null;
  duplicateMarkedAt?: string | null;
  createdAt: string;
  lastActivityAt: string;
  messages: QaMessage[];
}

export interface QaKpiReportResponse {
  totalAnswered: number;
  answeredWithin48Hours: number;
  answeredWithin7Days: number;
  within48HoursRate: number;
  within7DaysRate: number;
}

export interface CreateQaThreadPayload {
  courseId: string;
  lessonId?: string | null;
  title: string;
  content: string;
  visibility?: QaVisibility;
  attachment?: QaAttachment;
}

export async function listStudentQaThreads(): Promise<QaThread[]> {
  const res = await apiClient.get<ApiResponse<QaThread[]>>('/api/student/qa');
  return unwrap(res.data);
}

export async function createStudentQaThread(payload: CreateQaThreadPayload): Promise<QaThread> {
  const res = await apiClient.post<ApiResponse<QaThread>>('/api/student/qa', {
    courseId: payload.courseId,
    lessonId: payload.lessonId,
    title: payload.title,
    content: payload.content,
    visibility: payload.visibility ?? 'public',
    ...payload.attachment,
  });
  return unwrap(res.data);
}

export async function listCoursePublicQaThreads(courseId: string): Promise<QaThread[]> {
  const res = await apiClient.get<ApiResponse<QaThread[]>>(
    `/api/student/courses/${encodeURIComponent(courseId)}/qa/public`,
  );
  return unwrap(res.data);
}

export async function getStudentQaThread(threadId: string): Promise<QaThread> {
  const res = await apiClient.get<ApiResponse<QaThread>>(
    `/api/student/qa/${encodeURIComponent(threadId)}`,
  );
  return unwrap(res.data);
}

export async function addStudentQaMessage(threadId: string, content: string,
                                           attachment?: QaAttachment): Promise<QaThread> {
  const res = await apiClient.post<ApiResponse<QaThread>>(
    `/api/student/qa/${encodeURIComponent(threadId)}/messages`,
    { content, ...attachment },
  );
  return unwrap(res.data);
}

export async function listTeacherQaThreads(): Promise<QaThread[]> {
  const res = await apiClient.get<ApiResponse<QaThread[]>>('/api/teacher/qa');
  return unwrap(res.data);
}

export async function listAdminQaThreads(courseId?: string): Promise<QaThread[]> {
  const res = await apiClient.get<ApiResponse<QaThread[]>>('/api/admin/qa', {
    params: courseId ? { courseId } : undefined,
  });
  return unwrap(res.data);
}

export async function getAdminQaThread(threadId: string): Promise<QaThread> {
  const res = await apiClient.get<ApiResponse<QaThread>>(
    `/api/admin/qa/${encodeURIComponent(threadId)}`,
  );
  return unwrap(res.data);
}

export async function addTeacherQaMessage(threadId: string, content: string,
                                           attachment?: QaAttachment): Promise<QaThread> {
  const res = await apiClient.post<ApiResponse<QaThread>>(
    `/api/teacher/qa/${encodeURIComponent(threadId)}/messages`,
    { content, ...attachment },
  );
  return unwrap(res.data);
}

export async function editTeacherQaMessage(
  threadId: string,
  messageId: string,
  content: string,
): Promise<QaThread> {
  const res = await apiClient.put<ApiResponse<QaThread>>(
    `/api/teacher/qa/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(messageId)}`,
    { content },
  );
  return unwrap(res.data);
}

export async function markTeacherQaDuplicate(
  threadId: string,
  duplicateOfThreadId: string,
): Promise<QaThread> {
  const res = await apiClient.post<ApiResponse<QaThread>>(
    `/api/teacher/qa/${encodeURIComponent(threadId)}/duplicate`,
    { duplicateOfThreadId },
  );
  return unwrap(res.data);
}

export async function getTeacherQaReport(): Promise<QaKpiReportResponse> {
  const res = await apiClient.get<ApiResponse<QaKpiReportResponse>>('/api/teacher/qa/report');
  return unwrap(res.data);
}

export async function uploadQaImage(file: File): Promise<QaAttachment> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiClient.post<ApiResponse<{
    publicUrl: string;
    fileType: string;
    fileSizeBytes: number;
  }>>('/api/qa/attachments', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const uploaded = unwrap(res.data);
  return {
    attachmentUrl: uploaded.publicUrl,
    attachmentName: file.name,
    attachmentType: uploaded.fileType,
    attachmentSizeBytes: uploaded.fileSizeBytes,
  };
}

export async function updateTeacherQaStatus(threadId: string, resolved: boolean): Promise<QaThread> {
  const res = await apiClient.put<ApiResponse<QaThread>>(
    `/api/teacher/qa/${encodeURIComponent(threadId)}/status`,
    { resolved },
  );
  return unwrap(res.data);
}

import { apiClient, unwrap } from './client';
import type { ApiResponse } from '../types/api';

export type QaThreadStatus = 'pending' | 'answered' | 'resolved';
export type QaAuthorRole = 'student' | 'teacher' | 'parent' | 'admin';

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
  studentId: string;
  studentName: string;
  courseId: string;
  courseTitle: string;
  lessonId: string | null;
  lessonTitle: string | null;
  status: QaThreadStatus;
  createdAt: string;
  lastActivityAt: string;
  messages: QaMessage[];
}

export interface CreateQaThreadPayload {
  courseId: string;
  lessonId?: string | null;
  content: string;
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
    content: payload.content,
    ...payload.attachment,
  });
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

export async function addTeacherQaMessage(threadId: string, content: string,
                                           attachment?: QaAttachment): Promise<QaThread> {
  const res = await apiClient.post<ApiResponse<QaThread>>(
    `/api/teacher/qa/${encodeURIComponent(threadId)}/messages`,
    { content, ...attachment },
  );
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

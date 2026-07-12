import { apiClient, unwrap } from './client';
import type { ApiResponse } from '../types/api';
import type { QaAttachment } from './qaService';

export interface CourseDiscussionReply {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: 'student' | 'teacher' | 'parent' | 'admin';
  authorAvatarUrl: string | null;
  content: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  attachmentSizeBytes: number | null;
  createdAt: string;
}

export interface CourseDiscussionThread {
  id: string;
  courseId: string;
  lessonId: string | null;
  lessonTitle: string | null;
  authorId: string;
  authorName: string;
  authorRole: 'student' | 'teacher' | 'parent' | 'admin';
  authorAvatarUrl: string | null;
  content: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  attachmentSizeBytes: number | null;
  createdAt: string;
  lastActivityAt: string;
  replies: CourseDiscussionReply[];
}

export interface CreateCourseDiscussionThreadPayload {
  lessonId?: string | null;
  content: string;
  attachment?: QaAttachment;
}

export async function listCourseDiscussionThreads(courseId: string): Promise<CourseDiscussionThread[]> {
  const res = await apiClient.get<ApiResponse<CourseDiscussionThread[]>>(
    `/api/courses/${encodeURIComponent(courseId)}/discussion`,
  );
  return unwrap(res.data) ?? [];
}

export async function createCourseDiscussionThread(
  courseId: string,
  payload: CreateCourseDiscussionThreadPayload,
): Promise<CourseDiscussionThread> {
  const res = await apiClient.post<ApiResponse<CourseDiscussionThread>>(
    `/api/courses/${encodeURIComponent(courseId)}/discussion`,
    {
      lessonId: payload.lessonId,
      content: payload.content,
      ...payload.attachment,
    },
  );
  return unwrap(res.data);
}

export async function addCourseDiscussionReply(
  courseId: string,
  threadId: string,
  content: string,
  attachment?: QaAttachment,
): Promise<CourseDiscussionThread> {
  const res = await apiClient.post<ApiResponse<CourseDiscussionThread>>(
    `/api/courses/${encodeURIComponent(courseId)}/discussion/${encodeURIComponent(threadId)}/replies`,
    { content, ...attachment },
  );
  return unwrap(res.data);
}

export async function updateCourseDiscussionThread(
  courseId: string,
  threadId: string,
  content: string,
): Promise<CourseDiscussionThread> {
  const res = await apiClient.put<ApiResponse<CourseDiscussionThread>>(
    `/api/courses/${encodeURIComponent(courseId)}/discussion/${encodeURIComponent(threadId)}`,
    { content },
  );
  return unwrap(res.data);
}

export async function deleteCourseDiscussionThread(
  courseId: string,
  threadId: string,
): Promise<void> {
  await apiClient.delete<ApiResponse<null>>(
    `/api/courses/${encodeURIComponent(courseId)}/discussion/${encodeURIComponent(threadId)}`,
  );
}

export async function updateCourseDiscussionReply(
  courseId: string,
  threadId: string,
  replyId: string,
  content: string,
): Promise<CourseDiscussionThread> {
  const res = await apiClient.put<ApiResponse<CourseDiscussionThread>>(
    `/api/courses/${encodeURIComponent(courseId)}/discussion/${encodeURIComponent(threadId)}/replies/${encodeURIComponent(replyId)}`,
    { content },
  );
  return unwrap(res.data);
}

export async function deleteCourseDiscussionReply(
  courseId: string,
  threadId: string,
  replyId: string,
): Promise<CourseDiscussionThread> {
  const res = await apiClient.delete<ApiResponse<CourseDiscussionThread>>(
    `/api/courses/${encodeURIComponent(courseId)}/discussion/${encodeURIComponent(threadId)}/replies/${encodeURIComponent(replyId)}`,
  );
  return unwrap(res.data);
}

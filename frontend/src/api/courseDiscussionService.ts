import { apiClient, unwrap } from './client';
import type { ApiResponse } from '../types/api';

export interface CourseDiscussionReply {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: 'student' | 'teacher' | 'parent' | 'admin';
  authorAvatarUrl: string | null;
  content: string;
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
  createdAt: string;
  lastActivityAt: string;
  replies: CourseDiscussionReply[];
}

export interface CreateCourseDiscussionThreadPayload {
  lessonId?: string | null;
  content: string;
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
    payload,
  );
  return unwrap(res.data);
}

export async function addCourseDiscussionReply(
  courseId: string,
  threadId: string,
  content: string,
): Promise<CourseDiscussionThread> {
  const res = await apiClient.post<ApiResponse<CourseDiscussionThread>>(
    `/api/courses/${encodeURIComponent(courseId)}/discussion/${encodeURIComponent(threadId)}/replies`,
    { content },
  );
  return unwrap(res.data);
}

/**
 * Teacher Course Portal API service
 * Gọi các endpoint /api/teacher/** của backend Spring Boot.
 * Tất cả request tự gắn Bearer token qua apiClient interceptor.
 */
import { apiClient, unwrap } from './client';
import type { ApiResponse, PageResponse } from '../types/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TeacherCourseResponse {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  introVideoUrl: string | null;
  /** UUID danh mục — thêm mới để form edit không cần gọi getCourseDetail() thêm lần nữa. */
  categoryId: string | null;
  categoryName: string | null;
  grades: number[];
  priceVnd: number;
  salePriceVnd: number | null;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'needs_revision' | 'published';
  totalChapters: number;
  totalLessons: number;
  salesCount: number;
  versionNo: number;
  submittedVersionNo: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherLessonResponse {
  id: string;
  title: string;
  description: string | null;
  position: number;
  isFree: boolean;
  videoEmbedUrl: string | null;
  videoStoragePath: string | null;
  videoUrl: string | null;
  durationSec: number;
  hasVideo: boolean;
}

export interface TeacherChapterResponse {
  id: string;
  title: string;
  description: string | null;
  position: number;
  lessons: TeacherLessonResponse[];
}

export interface TeacherCourseDetailResponse extends TeacherCourseResponse {
  description: string | null;
  objective: string | null;
  audience: string | null;
  categoryId: string | null;
  chapters: TeacherChapterResponse[];
  approvalHistory: ApprovalHistoryResponse[];
  versions: CourseVersionResponse[];
}

export interface ApprovalHistoryResponse {
  id: string;
  action: 'approved' | 'rejected' | 'needs_revision';
  comment: string | null;
  adminName: string;
  createdAt: string;
}

export interface CourseVersionResponse {
  id: string;
  versionNo: number;
  title: string;
  submittedByName: string | null;
  submittedAt: string;
}

export interface CreateCourseRequest {
  title: string;
  description?: string;
  objective?: string;
  audience?: string;
  thumbnailUrl?: string;
  introVideoUrl?: string;
  categoryId: string;
  grades: number[];
  priceVnd: number;
  salePriceVnd?: number;
}

export interface CreateChapterRequest {
  title: string;
  description?: string;
  position?: number;
}

export interface CreateLessonRequest {
  title: string;
  description?: string;
  position?: number;
  isFree: boolean;
  videoEmbedUrl?: string;
  videoSource?: 'upload' | 'embed' | 'none';
}

// ─── Course CRUD ─────────────────────────────────────────────────────────────

export async function createCourse(req: CreateCourseRequest): Promise<TeacherCourseResponse> {
  const res = await apiClient.post<ApiResponse<TeacherCourseResponse>>(
    '/api/teacher/courses', req);
  return unwrap(res.data);
}

export async function listMyCourses(page = 0, size = 10):
    Promise<PageResponse<TeacherCourseResponse>> {
  const res = await apiClient.get<ApiResponse<PageResponse<TeacherCourseResponse>>>(
    '/api/teacher/courses', { params: { page, size, sort: 'updatedAt,desc' } });
  return unwrap(res.data);
}

export async function getCourseDetail(courseId: string):
    Promise<TeacherCourseDetailResponse> {
  const res = await apiClient.get<ApiResponse<TeacherCourseDetailResponse>>(
    `/api/teacher/courses/${courseId}`);
  return unwrap(res.data);
}

export async function updateCourse(courseId: string, req: Partial<CreateCourseRequest>):
    Promise<TeacherCourseResponse> {
  const res = await apiClient.put<ApiResponse<TeacherCourseResponse>>(
    `/api/teacher/courses/${courseId}`, req);
  return unwrap(res.data);
}

export async function deleteCourse(courseId: string): Promise<void> {
  await apiClient.delete(`/api/teacher/courses/${courseId}`);
}

export async function submitForReview(courseId: string): Promise<TeacherCourseResponse> {
  const res = await apiClient.post<ApiResponse<TeacherCourseResponse>>(
    `/api/teacher/courses/${courseId}/submit`);
  return unwrap(res.data);
}

// ─── Chapter CRUD ─────────────────────────────────────────────────────────────

export async function addChapter(courseId: string, req: CreateChapterRequest):
    Promise<TeacherChapterResponse> {
  const res = await apiClient.post<ApiResponse<TeacherChapterResponse>>(
    `/api/teacher/courses/${courseId}/chapters`, req);
  return unwrap(res.data);
}

export async function updateChapter(courseId: string, chapterId: string,
                                     req: Partial<CreateChapterRequest>):
    Promise<TeacherChapterResponse> {
  const res = await apiClient.put<ApiResponse<TeacherChapterResponse>>(
    `/api/teacher/courses/${courseId}/chapters/${chapterId}`, req);
  return unwrap(res.data);
}

export async function deleteChapter(courseId: string, chapterId: string): Promise<void> {
  await apiClient.delete(`/api/teacher/courses/${courseId}/chapters/${chapterId}`);
}

export async function reorderChapters(
    courseId: string,
    chapterIds: string[]): Promise<TeacherCourseDetailResponse> {
  const res = await apiClient.put<ApiResponse<TeacherCourseDetailResponse>>(
    `/api/teacher/courses/${courseId}/chapters/reorder`,
    { chapters: chapterIds.map((id, idx) => ({ id, position: idx + 1 })) },
  );
  return unwrap(res.data);
}

// ─── Lesson CRUD ─────────────────────────────────────────────────────────────

export async function addLesson(courseId: string, chapterId: string,
                                  req: CreateLessonRequest): Promise<TeacherLessonResponse> {
  const res = await apiClient.post<ApiResponse<TeacherLessonResponse>>(
    `/api/teacher/courses/${courseId}/chapters/${chapterId}/lessons`, req);
  return unwrap(res.data);
}

export async function updateLesson(courseId: string, chapterId: string,
                                    lessonId: string,
                                    req: Partial<CreateLessonRequest>):
    Promise<TeacherLessonResponse> {
  const res = await apiClient.put<ApiResponse<TeacherLessonResponse>>(
    `/api/teacher/courses/${courseId}/chapters/${chapterId}/lessons/${lessonId}`, req);
  return unwrap(res.data);
}

export async function deleteLesson(courseId: string, chapterId: string,
                                    lessonId: string): Promise<void> {
  await apiClient.delete(
    `/api/teacher/courses/${courseId}/chapters/${chapterId}/lessons/${lessonId}`);
}

export async function reorderLessons(
    courseId: string,
    chapterId: string,
    lessonIds: string[]): Promise<TeacherCourseDetailResponse> {
  const res = await apiClient.put<ApiResponse<TeacherCourseDetailResponse>>(
    `/api/teacher/courses/${courseId}/chapters/${chapterId}/lessons/reorder`,
    { lessons: lessonIds.map((id, idx) => ({ id, position: idx + 1 })) },
  );
  return unwrap(res.data);
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export interface UploadResponse {
  storagePath: string;
  publicUrl: string | null;
  fileType: string;
  fileSizeBytes: number;
}

export async function uploadVideo(
    courseId: string, chapterId: string, lessonId: string,
    file: File,
    onProgress?: (pct: number) => void): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiClient.post<ApiResponse<UploadResponse>>(
    `/api/upload/video/${courseId}/${chapterId}/${lessonId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round(e.loaded / e.total * 100));
      },
    });
  return unwrap(res.data);
}

export async function uploadDocument(lessonId: string, file: File,
                                      displayName?: string): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  if (displayName) form.append('name', displayName);
  const res = await apiClient.post<ApiResponse<UploadResponse>>(
    `/api/upload/document/${lessonId}`, form,
    { headers: { 'Content-Type': 'multipart/form-data' } });
  return unwrap(res.data);
}

export async function uploadCourseThumbnail(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiClient.post<ApiResponse<UploadResponse>>(
    '/api/upload/course-thumbnail', form,
    { headers: { 'Content-Type': 'multipart/form-data' } });
  return unwrap(res.data);
}

export async function uploadCourseIntroVideo(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiClient.post<ApiResponse<UploadResponse>>(
    '/api/upload/course-intro-video', form,
    { headers: { 'Content-Type': 'multipart/form-data' } });
  return unwrap(res.data);
}

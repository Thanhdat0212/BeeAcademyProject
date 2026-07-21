/**
 * Teacher Course Portal API service
 * Gọi các endpoint /api/teacher/** của backend Spring Boot.
 * Tất cả request tự gắn Bearer token qua apiClient interceptor.
 */
import { apiClient, unwrap } from './client';
import type { ApiResponse, PageResponse } from '../types/api';
import type { CourseReviewSummary } from '../types/api';

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
  videoFallbackUrl: string | null;
  hlsPlaylistUrl: string | null;
  videoProcessingStatus: 'NOT_REQUIRED' | 'EMBED' | 'HLS_QUEUED' | 'HLS_READY' | 'HLS_FAILED';
  originalVideoRetentionUntil: string | null;
  durationSec: number;
  hasVideo: boolean;
  completionRule: 'DOCUMENT_OPENED' | 'MARK_AS_COMPLETE' | 'ASSIGNMENT_SUBMITTED' | 'ASSIGNMENT_PASSED' | null;
  transcript: string | null;
  subtitleUrl: string | null;
  slideCueSeconds: string | null;
  documents: Array<{
    id: string;
    name: string;
    fileType: string;
    position: number;
  }>;
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
  approved: boolean;
  approvedAt: string | null;
}

export interface CourseVersionMigrationRequest {
  targetCourseVersionId: string;
  studentIds: string[];
  progressItemMapping: Record<string, string>;
  finalExamMapping: Record<string, string>;
  certificateMapping: 'MARK_NEEDS_REVIEW' | string;
  reason: string;
}

export interface CourseVersionMigrationResponse {
  courseId: string;
  targetCourseVersionId: string;
  targetVersionNo: number;
  migratedEnrollmentCount: number;
  migratedStudentIds: string[];
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
  completionRule?: 'DOCUMENT_OPENED' | 'MARK_AS_COMPLETE' | 'ASSIGNMENT_SUBMITTED' | 'ASSIGNMENT_PASSED';
  transcript?: string;
  subtitleUrl?: string;
  slideCueSeconds?: string;
  videoFallbackUrl?: string;
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

export async function migrateCourseEnrollments(
  courseId: string,
  req: CourseVersionMigrationRequest,
): Promise<CourseVersionMigrationResponse> {
  const res = await apiClient.post<ApiResponse<CourseVersionMigrationResponse>>(
    `/api/teacher/courses/${courseId}/versions/migrate-enrollments`, req);
  return unwrap(res.data);
}

export async function getCourseDetail(courseId: string):
    Promise<TeacherCourseDetailResponse> {
  const res = await apiClient.get<ApiResponse<TeacherCourseDetailResponse>>(
    `/api/teacher/courses/${courseId}`);
  return unwrap(res.data);
}

export async function getTeacherCourseReviews(courseId: string):
    Promise<CourseReviewSummary> {
  const res = await apiClient.get<ApiResponse<CourseReviewSummary>>(
    `/api/teacher/courses/${encodeURIComponent(courseId)}/reviews`);
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

// Đổi riêng ảnh bìa — cho phép kể cả khi khóa đã xuất bản (ảnh bìa là cosmetic).
export async function updateCourseThumbnail(courseId: string, file: File):
    Promise<TeacherCourseResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiClient.put<ApiResponse<TeacherCourseResponse>>(
    `/api/teacher/courses/${courseId}/thumbnail`, form,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 });
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

export interface UploadVideoOptions {
  durationSec?: number;
  onProgress?: (pct: number) => void;
}

interface SignedUpload {
  uploadUrl: string;
  storagePath: string;
}

// Backend chỉ ký một URL dùng một lần rồi đứng ngoài: byte của file đi thẳng từ
// máy giáo viên lên Supabase Storage. Trước đây video 2GB đi xuyên qua Spring nên
// một lượt upload là đủ làm cả site đứng.
async function requestSignedUpload(signUrl: string, file: File): Promise<SignedUpload> {
  const res = await apiClient.post<ApiResponse<SignedUpload>>(signUrl, {
    filename: file.name,
    contentType: file.type,
    sizeBytes: file.size,
  });
  return unwrap(res.data);
}

// Dùng XHR thay vì fetch vì chỉ XHR báo được tiến độ upload — thanh % là thứ duy
// nhất giữ giáo viên khỏi đóng tab giữa chừng khi đẩy file cả GB.
function putFileToSignedUrl(uploadUrl: string, file: File,
                            onProgress?: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable && e.total > 0) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      let message = `Tải tệp lên thất bại (mã ${xhr.status})`;
      try {
        const body = JSON.parse(xhr.responseText) as { message?: string };
        if (body.message) message = body.message;
      } catch {
        // Storage trả HTML/empty khi lỗi hạ tầng — giữ message mặc định
      }
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error('Mất kết nối khi tải tệp lên. Kiểm tra mạng rồi thử lại.'));
    xhr.onabort = () => reject(new Error('Đã hủy tải tệp lên.'));

    xhr.send(file);
  });
}

export async function uploadVideo(
    courseId: string, chapterId: string, lessonId: string,
    file: File,
    options?: UploadVideoOptions): Promise<UploadResponse> {
  const base = `/api/upload/video/${courseId}/${chapterId}/${lessonId}`;
  const ticket = await requestSignedUpload(`${base}/sign`, file);
  await putFileToSignedUrl(ticket.uploadUrl, file, options?.onProgress);

  const res = await apiClient.post<ApiResponse<UploadResponse>>(`${base}/confirm`, {
    storagePath: ticket.storagePath,
    durationSec: options?.durationSec && options.durationSec > 0
      ? Math.floor(options.durationSec)
      : null,
  });
  return unwrap(res.data);
}

export async function uploadDocument(lessonId: string, file: File,
                                      slot: 'pdf' | 'slide',
                                      displayName?: string): Promise<UploadResponse> {
  const base = `/api/upload/document/${lessonId}`;
  const ticket = await requestSignedUpload(`${base}/sign`, file);
  await putFileToSignedUrl(ticket.uploadUrl, file);

  const res = await apiClient.post<ApiResponse<UploadResponse>>(`${base}/confirm`, {
    storagePath: ticket.storagePath,
    name: displayName ?? file.name,
    slot,
  });
  return unwrap(res.data);
}

export async function deleteDocument(lessonId: string, documentId: string): Promise<void> {
  await apiClient.delete(`/api/upload/document/${lessonId}/${documentId}`);
}

export async function uploadCourseThumbnail(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiClient.post<ApiResponse<UploadResponse>>(
    '/api/upload/course-thumbnail', form,
    { headers: { 'Content-Type': 'multipart/form-data' } });
  return unwrap(res.data);
}

export async function uploadCourseIntroVideo(
    file: File,
    onProgress?: (pct: number) => void): Promise<UploadResponse> {
  const ticket = await requestSignedUpload('/api/upload/course-intro-video/sign', file);
  await putFileToSignedUrl(ticket.uploadUrl, file, onProgress);

  const res = await apiClient.post<ApiResponse<UploadResponse>>(
    '/api/upload/course-intro-video/confirm', { storagePath: ticket.storagePath });
  return unwrap(res.data);
}

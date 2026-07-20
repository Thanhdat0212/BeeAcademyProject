import { apiClient, unwrap } from './client';
import type { ApiResponse, CourseReview } from '../types/api';

export async function listPendingCourseReviews(): Promise<CourseReview[]> {
  const response = await apiClient.get<ApiResponse<CourseReview[]>>(
    '/api/admin/course-reviews/pending',
  );
  return unwrap(response.data);
}

export async function moderateCourseReview(
  reviewId: string,
  decision: 'APPROVE' | 'REJECT',
  reason?: string,
): Promise<CourseReview> {
  const response = await apiClient.put<ApiResponse<CourseReview>>(
    `/api/admin/course-reviews/${reviewId}/moderation`,
    { decision, reason: reason?.trim() || null },
  );
  return unwrap(response.data);
}

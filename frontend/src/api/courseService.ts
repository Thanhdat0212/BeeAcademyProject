/**
 * ============================================================================
 *  courseService - gọi /api/courses, /api/categories
 * ----------------------------------------------------------------------------
 *  Tất cả endpoint public - không bắt buộc JWT (interceptor vẫn gửi token
 *  nếu có, BE bỏ qua).
 * ============================================================================
 */
import { apiClient, unwrap } from './client';
import type {
  ApiResponse,
  Category,
  CourseDetail,
  CourseReview,
  CourseReviewSummary,
  CourseSummary,
  PageResponse,
  SearchCoursesParams,
} from '../types/api';

/**
 * Query nhanh dạng "6", "7", "8", "9" được hiểu là tìm theo lớp tương ứng.
 * Header autocomplete và trang /courses dùng chung để kết quả không lệch nhau.
 */
export function inferGradeFromSearchQuery(query: string): number | undefined {
  const normalized = query
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
  const match = normalized.match(/(?:^|\D)([6-9])(?:\D|$)/);
  return match ? Number(match[1]) : undefined;
}

// ---------------------------------------------------------------------------
//  UC06 - Tìm kiếm & lọc khoá học có phân trang
// ---------------------------------------------------------------------------

/**
 * GET /api/courses
 *
 * Truyền undefined/null cho field nào không filter - service tự bỏ qua khi
 * build query string (axios `params` skip undefined).
 */
export async function searchCourses(
  params: SearchCoursesParams = {},
): Promise<PageResponse<CourseSummary>> {
  // Axios tự omit field undefined ở params, không gửi `?subject=undefined`
  const res = await apiClient.get<ApiResponse<PageResponse<CourseSummary>>>(
    '/api/courses',
    { params },
  );
  return unwrap(res.data);
}

// ---------------------------------------------------------------------------
//  UC07 + UC08 - Chi tiết khoá học theo UUID
// ---------------------------------------------------------------------------

/**
 * GET /api/courses/{id} - chi tiết kèm chapters + lessons.
 *
 * Backend tự quyết định có expose `videoUrl` không dựa vào quyền:
 *   - Guest / chưa mua: chỉ lesson `isFree=true` có URL.
 *   - Đã mua / teacher / admin: thấy URL tất cả lesson.
 */
export async function getCourseDetail(id: string): Promise<CourseDetail> {
  const res = await apiClient.get<ApiResponse<CourseDetail>>(
    `/api/courses/${encodeURIComponent(id)}`,
  );
  return unwrap(res.data);
}

/** Variant theo slug (URL SEO-friendly). */
export async function getCourseDetailBySlug(slug: string): Promise<CourseDetail> {
  const res = await apiClient.get<ApiResponse<CourseDetail>>(
    `/api/courses/by-slug/${encodeURIComponent(slug)}`,
  );
  return unwrap(res.data);
}

export async function getCourseReviews(courseId: string): Promise<CourseReviewSummary> {
  const res = await apiClient.get<ApiResponse<CourseReviewSummary>>(
    `/api/courses/${encodeURIComponent(courseId)}/reviews`,
  );
  return unwrap(res.data);
}

export async function upsertCourseReview(
  courseId: string,
  payload: { rating: number; comment: string },
): Promise<CourseReview> {
  const res = await apiClient.post<ApiResponse<CourseReview>>(
    `/api/courses/${encodeURIComponent(courseId)}/reviews`,
    payload,
  );
  return unwrap(res.data);
}

// ---------------------------------------------------------------------------
//  Categories - cho dropdown filter
// ---------------------------------------------------------------------------

/** GET /api/categories - 8 danh mục, đã sort theo display_order. */
export async function listCategories(): Promise<Category[]> {
  const res = await apiClient.get<ApiResponse<Category[]>>('/api/categories');
  return unwrap(res.data);
}

// ---------------------------------------------------------------------------
//  My Courses - khoá học đã enroll (cần JWT)
// ---------------------------------------------------------------------------

/**
 * GET /api/me/courses — danh sách khoá học user đã mua/được gán.
 * Trả CourseSummary[] nên adapter cần set isEnrolled=true cho tất cả.
 */
export async function getEnrolledCourses(): Promise<CourseSummary[]> {
  const res = await apiClient.get<ApiResponse<CourseSummary[]>>('/api/me/courses');
  return unwrap(res.data);
}

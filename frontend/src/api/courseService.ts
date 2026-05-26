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
  CourseSummary,
  PageResponse,
  SearchCoursesParams,
} from '../types/api';

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

// ---------------------------------------------------------------------------
//  Categories - cho dropdown filter
// ---------------------------------------------------------------------------

/** GET /api/categories - 8 danh mục, đã sort theo display_order. */
export async function listCategories(): Promise<Category[]> {
  const res = await apiClient.get<ApiResponse<Category[]>>('/api/categories');
  return unwrap(res.data);
}

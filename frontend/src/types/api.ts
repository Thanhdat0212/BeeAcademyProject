/**
 * ============================================================================
 *  Bee Academy - API Types
 * ----------------------------------------------------------------------------
 *  Mirror các DTO mà backend Spring Boot trả về. Đặt ở 1 chỗ duy nhất để
 *  service / component / store import chung - tránh lệch định nghĩa giữa
 *  các module.
 *
 *  Convention:
 *    - Camel case (BE đã serialize sang camel).
 *    - Field có thể null thì mark `| null`.
 *    - Không thêm field FE-only ở đây (đặt trong adapter.ts).
 * ============================================================================
 */

/** Wrapper chung của mọi response thành công từ backend. */
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

/** Response lỗi từ GlobalExceptionHandler. */
export interface ApiErrorResponse {
  success: false;
  code: string;
  message: string;
  fieldErrors?: Array<{ field: string; message: string }>;
  timestamp: string;
}

/** Phân trang chuẩn (mirror PageResponse.java). */
export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
}

// ============================================================================
//  Auth & User
// ============================================================================

export interface UserSummary {
  id: string;
  email: string;
  role: 'student' | 'parent' | 'teacher' | 'admin' | null;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface AuthTokenPayload {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: UserSummary | null;
}

export interface ProfileDetail {
  id: string;
  email: string;
  role: string | null;
  fullName: string | null;
  phone: string | null;
  bio: string | null;
  avatarUrl: string | null;
  twitterUrl: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
  createdAt: string;
  updatedAt: string;
  parentLinkCode?: string | null;
}

// ============================================================================
//  Categories
// ============================================================================

export interface Category {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  displayOrder: number;
}

// ============================================================================
//  Courses
// ============================================================================

/** Shape gọn cho list/grid (GET /api/courses). */
export interface CourseSummary {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  teacherName: string | null;
  grades: number[];
  priceVnd: number;
  salePriceVnd: number | null;
  effectivePriceVnd: number;
  isOnSale: boolean;
  isFeatured: boolean;
  hasFreePreview: boolean;
  totalChapters: number;
  totalLessons: number;
  totalDurationSec: number;
}

export interface LessonDocumentDto {
  name: string;
  fileUrl: string;
  fileType: string;
  fileSizeBytes: number;
}

export interface LessonDetail {
  id: string;
  title: string;
  videoUrl: string | null;
  videoEmbedUrl: string | null;
  durationSec: number;
  position: number;
  isFree: boolean;
  documents: LessonDocumentDto[];
}

export interface ChapterDetail {
  id: string;
  title: string;
  description: string | null;
  position: number;
  lessons: LessonDetail[];
  /** true nếu GV đã cấu hình quiz cho chương này — dùng để ẩn/hiện nút "Làm quiz". */
  hasQuizConfig: boolean;
}

/** Shape đầy đủ cho detail page (GET /api/courses/{id}). */
export interface CourseDetail extends Omit<CourseSummary, 'isFeatured'> {
  publishedAt: string | null;
  chapters: ChapterDetail[];
  enrolled: boolean; // true nếu đã mua / là GV sở hữu / là Admin
}

// ============================================================================
//  Request payloads (FE → BE)
// ============================================================================

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  role: 'student' | 'parent' | 'teacher';
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RequestOtpPayload {
  email: string;
  fullName: string;
  role: 'student' | 'parent' | 'teacher';
}

export interface VerifyOtpPayload {
  email: string;
  otp: string;
  password: string;
}

export interface OAuthSyncPayload {
  fullName?: string | null;
  avatarUrl?: string | null;
}

export interface RequestResetPasswordOtpPayload {
  email: string;
}

export interface VerifyResetPasswordOtpPayload {
  email: string;
  otp: string;
  newPassword: string;
}


export interface SearchCoursesParams {
  /** Slug danh mục (vd: "toan-hoc"). */
  subject?: string;
  /** Số lớp (6-9). */
  grade?: number;
  /** Từ khoá tìm trong title/description. */
  q?: string;
  page?: number;
  size?: number;
  /** Cú pháp Spring: "field,asc" | "field,desc". */
  sort?: string;
}

// ============================================================================
//  Parent Portal
// ============================================================================

export interface LinkedStudentResponse {
  id: string;
  name: string;
  avatarUrl: string | null;
  code: string;
  grade: string;
}

export interface LinkStudentRequest {
  code: string;
}

export interface ChildOverviewResponse {
  studentName: string;
  grade: string;
  avgProgress: number;
  activeCourses: number;
  completedCourses: number;
  latestQuizScore: number;
  latestExamScore: number;
  weeklyActivityHours: number[];
}


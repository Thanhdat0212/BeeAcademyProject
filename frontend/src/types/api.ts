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
  objective: string | null;
  audience: string | null;
  thumbnailUrl: string | null;
  introVideoUrl: string | null;
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
  averageRating: number;
  reviewCount: number;
  // studentCount: số học viên đã ghi danh — feature riêng của local, giữ khi gộp team3.
  studentCount: number;
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
  versionNo: number;
  submittedVersionNo: number;
  publishedAt: string | null;
  chapters: ChapterDetail[];
  enrolled: boolean; // true nếu đã mua / là GV sở hữu / là Admin
}

export interface CourseReview {
  id: string;
  courseId: string;
  studentId: string;
  studentName: string | null;
  studentAvatarUrl: string | null;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CourseReviewSummary {
  averageRating: number;
  reviewCount: number;
  myReview: CourseReview | null;
  reviews: CourseReview[];
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
  /** Chỉ lấy khoá nổi bật (is_featured=true) cho trang chủ. */
  featured?: boolean;
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
  linkStatus?: ParentLinkStatus;
  unlinkRequestedById?: string | null;
  unlinkRequestedByRole?: ParentLinkParticipantRole | null;
  unlinkRequestedAt?: string | null;
}

export interface LinkStudentRequest {
  code: string;
}

export type ParentLinkStatus = 'pending' | 'accepted' | 'rejected';
export type ParentLinkParticipantRole = 'parent' | 'student';

export interface SendParentLinkInvitationPayload {
  studentEmail: string;
  relationship: ParentLinkRelationship;
  note?: string | null;
}

export interface ParentLinkInvitationResponse {
  studentId: string;
  studentName: string;
  studentEmail: string;
  avatarUrl: string | null;
  grade: string;
  relationship: ParentLinkRelationship;
  note: string | null;
  status: ParentLinkStatus;
  invitedAt: string;
  expiresAt: string | null;
  expired: boolean;
  respondedAt: string | null;
  unlinkRequestedById: string | null;
  unlinkRequestedByRole: ParentLinkParticipantRole | null;
  unlinkRequestedAt: string | null;
}

export interface StudentParentLinkInvitationResponse {
  parentId: string;
  parentName: string;
  parentEmail: string;
  avatarUrl: string | null;
  relationship: ParentLinkRelationship;
  note: string | null;
  status: ParentLinkStatus;
  invitedAt: string;
  expiresAt: string | null;
  expired: boolean;
  respondedAt: string | null;
  unlinkRequestedById: string | null;
  unlinkRequestedByRole: ParentLinkParticipantRole | null;
  unlinkRequestedAt: string | null;
}

export type ParentLinkRelationship = 'father' | 'mother' | 'guardian';

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

export interface ParentCourseProgressItem {
  courseId: string;
  courseTitle: string;
  teacherName: string | null;
  status: 'active' | 'completed';
  progressPct: number;
  enrolledAt: string | null;
  grades: number[];
  quizCompletedCount: number;
  quizTotalCount: number;
  averageQuizScore: number | null;
  latestQuizScore: number | null;
  latestExamScore: number | null;
  latestAssignmentScore: number | null;
}

export interface ParentAssessmentRecord {
  id: string;
  courseId: string;
  courseTitle: string;
  courseStatus: 'active' | 'completed';
  assessmentName: string;
  assessmentType: 'quiz' | 'exam' | 'assignment';
  chapterTitle: string | null;
  rawScore: number | null;
  maxScore: number | null;
  normalizedScore: number | null;
  feedback: string | null;
  submittedAt: string | null;
}

export interface ChildProgressReportResponse {
  studentId: string;
  studentName: string;
  gradeLabel: string;
  generatedAt: string;
  courses: ParentCourseProgressItem[];
  assessments: ParentAssessmentRecord[];
}

export type ParentPaymentStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';
export type ParentPaymentPayerRole = 'parent' | 'student';

export interface ParentPaymentTransaction {
  orderId: string;
  orderCode: number;
  paymentRef: string;
  payerId: string;
  payerName: string;
  payerRole: ParentPaymentPayerRole;
  courseId: string;
  courseTitle: string;
  teacherName: string | null;
  categoryName: string | null;
  thumbnailUrl: string | null;
  grades: number[];
  amountVnd: number;
  status: ParentPaymentStatus;
  createdAt: string;
  paidAt: string | null;
  currentProgressPct: number;
  invoiceCode: string;
}

export interface ParentPaymentHistoryResponse {
  studentId: string;
  studentName: string;
  gradeLabel: string;
  generatedAt: string;
  totalPaidAmount: number;
  transactionCount: number;
  pendingCount: number;
  averageProgress: number;
  transactions: ParentPaymentTransaction[];
}

export type ParentTeacherConversationStatus = 'pending' | 'answered' | 'resolved';
export type ParentTeacherMessageAuthorRole = 'student' | 'teacher' | 'parent' | 'admin';

export interface ParentTeacherMessageResponse {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: ParentTeacherMessageAuthorRole;
  content: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  attachmentSizeBytes: number | null;
  sentAt: string;
}

export interface ParentTeacherConversationResponse {
  threadId: string | null;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  teacherAvatarUrl: string | null;
  courseId: string;
  courseTitle: string;
  categoryName: string | null;
  gradeLabel: string;
  status: ParentTeacherConversationStatus | null;
  startedAt: string | null;
  lastActivityAt: string | null;
  lastMessage: string | null;
  messageCount: number;
  messages: ParentTeacherMessageResponse[];
}

export interface UploadResponse {
  storagePath: string;
  publicUrl: string | null;
  fileType: string;
  fileSizeBytes: number;
}

export interface UserNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  targetUrl: string | null;
  read: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface UserNotificationSummary {
  unreadCount: number;
  notifications: UserNotification[];
}


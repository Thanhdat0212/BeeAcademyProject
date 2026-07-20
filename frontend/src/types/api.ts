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
  /** Chỉ có khi code = MAINTENANCE_MODE - mốc dự kiến hoàn tất bảo trì. */
  maintenanceUntil?: string | null;
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
  progressPct?: number | null;
  /** Các field UC13, chỉ có giá trị với GET /api/me/courses. */
  purchasedAt?: string | null;
  lastAccessedAt?: string | null;
  learningStatus?: 'not_started' | 'in_progress' | 'completed' | null;
  finalExamPassed?: boolean | null;
  allRequiredExamsPassed?: boolean | null;
}

export interface CourseProgress {
  courseId: string;
  progressPct: number;
  completedLessonIds: string[];
  completedQuizIds: string[];
}

export interface CompleteCourseProgressItemPayload {
  itemId: string;
  itemType: 'lesson' | 'quiz';
}

export interface SystemStatus {
  maintenanceMode: boolean;
  /** Mốc dự kiến hoàn tất bảo trì - do BE tính từ lúc Admin bật, null khi tắt. */
  maintenanceUntil: string | null;
}

export interface SystemSettings {
  maintenanceMode: boolean;
  platformFeePercent: number;
  updatedAt: string;
  maintenanceUntil: string | null;
}

export interface UpdateSystemSettingsPayload {
  maintenanceMode: boolean;
  platformFeePercent: number;
}

export interface LessonDocumentDto {
  id: string;
  name: string;
  fileUrl: string | null;
  fileType: string;
  fileSizeBytes: number;
  position: number;
}

export interface LessonDetail {
  id: string;
  title: string;
  videoUrl: string | null;
  videoEmbedUrl: string | null;
  videoFallbackUrl: string | null;
  hlsPlaylistUrl: string | null;
  videoProcessingStatus: 'NOT_REQUIRED' | 'EMBED' | 'HLS_QUEUED' | 'HLS_READY' | 'HLS_FAILED';
  durationSec: number;
  position: number;
  isFree: boolean;
  completionRule: 'DOCUMENT_OPENED' | 'MARK_AS_COMPLETE' | 'ASSIGNMENT_SUBMITTED' | 'ASSIGNMENT_PASSED' | null;
  transcript: string | null;
  subtitleUrl: string | null;
  slideCueSeconds: string | null;
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
  courseTitle?: string | null;
  studentId: string;
  studentName: string | null;
  studentAvatarUrl: string | null;
  rating: number;
  comment: string | null;
  moderationStatus: 'PUBLISHED' | 'PENDING_MODERATION' | 'REJECTED';
  moderationReason?: string | null;
  moderatedBy?: string | null;
  moderatedAt?: string | null;
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
  /** Giá thực tế tối thiểu/tối đa (VND). */
  minPrice?: number;
  maxPrice?: number;
  /** Điểm đánh giá trung bình tối thiểu (0-5). */
  minRating?: number;
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

/** UC28 parent-link API contract: PENDING -> ACTIVE/REJECTED/EXPIRED, ACTIVE -> REVOKED. */
export type ParentLinkStatus = 'pending' | 'active' | 'rejected' | 'expired' | 'revoked';
export type ParentLinkParticipantRole = 'parent' | 'student';

export interface SendParentLinkInvitationPayload {
  studentEmail: string;
  relationship: ParentLinkRelationship;
  note?: string | null;
}

export interface ParentLinkInvitationResponse {
  studentId: string | null;
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
  acceptedForProcessing: boolean;
  neutralMessage: string | null;
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
  sensitiveDataConsentGranted: boolean;
  sensitiveDataConsentUpdatedAt: string | null;
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
  detailAccessAllowed: boolean;
  sensitiveDataMasked: boolean;
  detailAccessReason: string | null;
}

export type ParentRequiredExamStatus =
  | 'not_configured'
  | 'not_submitted'
  | 'in_progress'
  | 'pending_grading'
  | 'passed'
  | 'failed';

export interface ParentRequiredExamResult {
  slotIndex: number;
  label: string;
  examName: string | null;
  examType: 'chapter_test' | 'final_exam' | 'quiz' | string | null;
  status: ParentRequiredExamStatus;
  examConfigId: string | null;
  courseVersionId: string | null;
  scorePercent: number | null;
  normalizedScore: number | null;
  passed: boolean | null;
  submittedAt: string | null;
}

export interface ParentLessonProgressItem {
  lessonId: string;
  chapterId: string;
  chapterTitle: string;
  chapterPosition: number | null;
  lessonTitle: string;
  lessonPosition: number | null;
  durationSec: number | null;
  completedAt: string | null;
}

export interface ParentCourseProgressItem {
  courseId: string;
  courseVersionId: string | null;
  courseTitle: string;
  teacherName: string | null;
  status: 'active' | 'completed';
  progressPct: number;
  enrolledAt: string | null;
  progressUpdatedAt: string | null;
  grades: number[];
  lessonCompletedCount: number;
  lessonTotalCount: number;
  quizCompletedCount: number;
  quizTotalCount: number;
  averageQuizScore: number | null;
  latestQuizScore: number | null;
  latestExamScore: number | null;
  latestAssignmentScore: number | null;
  completedLessons: ParentLessonProgressItem[];
  requiredExams: ParentRequiredExamResult[];
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

export type ParentCertificateStatus =
  | 'NOT_ISSUED'
  | 'ISSUED'
  | 'REISSUED'
  | 'NEEDS_REVIEW'
  | 'REVOKED'
  | string;

export interface ParentCertificateRecord {
  certificateId: string;
  courseId: string | null;
  courseTitle: string;
  teacherName: string | null;
  status: ParentCertificateStatus;
  certificateNo: string;
  verificationCode: string;
  versionNo: number;
  issuedAt: string | null;
  revokedAt: string | null;
  reviewNote: string | null;
}

export interface ParentWeeklySummary {
  periodStart: string;
  periodEnd: string;
  progressTrend: 'no_data' | 'increasing' | 'decreasing' | 'stable' | string;
  currentWeekCompletedItems: number;
  previousWeekCompletedItems: number;
  averageScore: number | null;
  completedAssessments: number;
  incompleteCourses: number;
  incompleteLearningItems: number;
  inactiveDays: number;
  actionRule: 'no_data' | 'inactive' | 'needs_support' | 'decreasing' | 'on_track' | string;
  actionSuggestion: string;
}

export interface ChildProgressReportResponse {
  studentId: string;
  studentName: string;
  gradeLabel: string;
  generatedAt: string;
  detailAccessAllowed: boolean;
  sensitiveDataMasked: boolean;
  detailAccessReason: string | null;
  weeklySummary: ParentWeeklySummary;
  courses: ParentCourseProgressItem[];
  assessments: ParentAssessmentRecord[];
  certificates: ParentCertificateRecord[];
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
  courseVersionId: string | null;
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
  invoiceInfo: ParentPaymentInvoiceInfo | null;
}

export interface ParentPaymentInvoiceInfo {
  sellerName: string;
  sellerTaxCode: string;
  buyerName: string;
  legalDescription: string;
  currency: string;
  issuedAt: string | null;
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
  moderationStatus: 'approved' | 'pending_review' | string;
  moderationReason: string | null;
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
  pendingModerationCount: number;
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


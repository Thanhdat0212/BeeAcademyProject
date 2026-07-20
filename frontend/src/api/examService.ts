import { apiClient, unwrap } from './client';
import type { ApiResponse } from '../types/api';
import type { QuestionMetadata, QuestionType } from './questionService';

export type ExamQuestionType = QuestionType;
export type ExamDifficulty = 'easy' | 'medium' | 'hard';
export type ExamType = 'quiz' | 'chapter_test' | 'final_exam';

export interface ExamQuestionPayload {
  id: string;
  questionVersionId?: string | null;
  text: string;
  type: ExamQuestionType;
  options: string[];
  correctIndices: number[];
  metadata?: QuestionMetadata | null;
  explanation?: string | null;
  points: number;
  difficulty: ExamDifficulty;
}

export interface ExamConfigRequest {
  name: string;
  scopeStartChapterId: string;
  placementChapterId: string;
  examType: ExamType;
  description?: string | null;
  durationMinutes: number;
  passScorePercent: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showAnswerAfterSubmit: boolean;
  requireFullscreen: boolean;
  blockCopyPaste: boolean;
  confirmUnderTenQuestions?: boolean;
  questions: ExamQuestionPayload[];
}

export interface ExamConfigResponse extends ExamConfigRequest {
  id: string;
  courseId: string;
  slotIndex: number;
  scopeStartChapterTitle?: string | null;
  placementChapterTitle?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExamQuestionStatsResponse {
  easyCount: number;
  mediumCount: number;
  hardCount: number;
  totalActive: number;
}

export interface ExamQuestionRandomRequest {
  easyCount: number;
  mediumCount: number;
  hardCount: number;
  pointsPerQuestion: number;
  objectivePoints?: number;
  essayPoints?: number;
  chapterConfigs?: Array<{
    chapterId: string;
    totalCount: number;
    objectiveCount?: number;
    essayCount?: number;
    multipleChoiceCount?: number;
    trueFalseCount?: number;
    fillInBlankCount?: number;
  }>;
}

export interface ExamAiDraftRequest {
  chapterId?: string;
  prompt: string;
  material?: string;
  questionCount: number;
  questionType: 'multiple_choice' | 'true_false' | 'fill_in_blank' | 'essay';
  difficulty: ExamDifficulty;
}

export interface ExamAiDraftQuestion {
  status: 'draft' | 'approved' | 'rejected';
  text: string;
  type: ExamQuestionType;
  options: string[];
  correctIndices: number[];
  metadata?: QuestionMetadata | null;
  explanation?: string | null;
  difficulty: ExamDifficulty;
  sourceRefs: string[];
  rejectionReason?: string | null;
}

export interface ExamAiDraftResponse {
  promptId: string;
  questions: ExamAiDraftQuestion[];
  createdAt: string;
}

export interface ExamAiReviewRequest {
  promptId: string;
  action: 'APPROVED_AI_QUESTION' | 'REJECTED_AI_QUESTION';
  questionText: string;
  sourceRefs?: string[];
}

export interface TeacherExamQuestionReview {
  id: string;
  text: string;
  type: ExamQuestionType;
  options: string[];
  metadata?: QuestionMetadata | null;
  studentAnswers: number[];
  textAnswer: string | null;
  imageUrls: string[];
  answerData?: Record<string, unknown> | null;
  correctAnswers: number[];
  correct: boolean | null;
  points: number;
  earnedPoints: number;
  explanation: string | null;
}

export interface AiExamQuestionGrade {
  questionId: string;
  questionText: string;
  type: string;
  earnedPoints: number;
  maxPoints: number;
  studentAnswer: string | null;
  imageUrls: string[];
  comment: string;
  suggestions: string[];
}

export interface AiExamFeedback {
  overallComment: string;
  strengths: string[];
  improvements: string[];
  questions: AiExamQuestionGrade[];
}

export interface TeacherExamAttemptResponse {
  id: string;
  studentId: string;
  studentName: string | null;
  courseId: string;
  courseTitle: string;
  examId: string;
  examName: string;
  slotIndex: number;
  attemptNumber: number;
  startedAt: string;
  submittedAt: string;
  autoScorePercent: number | null;
  manualScorePercent: number | null;
  effectiveScorePercent: number | null;
  passScorePercent: number;
  passed: boolean | null;
  feedback: string | null;
  gradedAt: string | null;
  aiScorePercent: number | null;
  aiFeedback: AiExamFeedback | null;
  aiGradedAt: string | null;
  status: 'pending' | 'graded';
  questions: TeacherExamQuestionReview[];
}

export async function listCourseExams(courseId: string): Promise<ExamConfigResponse[]> {
  const res = await apiClient.get<ApiResponse<ExamConfigResponse[]>>(
    `/api/teacher/courses/${courseId}/exams`,
  );
  return unwrap(res.data);
}

export async function getCourseExam(courseId: string, slotIndex: number):
    Promise<ExamConfigResponse> {
  const res = await apiClient.get<ApiResponse<ExamConfigResponse>>(
    `/api/teacher/courses/${courseId}/exams/${slotIndex}`,
  );
  return unwrap(res.data);
}

export async function getCourseExamQuestionStats(
    courseId: string,
): Promise<ExamQuestionStatsResponse> {
  const res = await apiClient.get<ApiResponse<ExamQuestionStatsResponse>>(
    `/api/teacher/courses/${courseId}/exams/question-bank-stats`,
  );
  return unwrap(res.data);
}

export async function randomizeCourseExamQuestions(
    courseId: string,
    req: ExamQuestionRandomRequest,
): Promise<ExamQuestionPayload[]> {
  const res = await apiClient.post<ApiResponse<ExamQuestionPayload[]>>(
    `/api/teacher/courses/${courseId}/exams/random-questions`,
    req,
  );
  return unwrap(res.data);
}

export async function generateCourseExamAiDraft(
    courseId: string,
    req: ExamAiDraftRequest,
): Promise<ExamAiDraftResponse> {
  const res = await apiClient.post<ApiResponse<ExamAiDraftResponse>>(
    `/api/teacher/courses/${courseId}/exams/ai-draft`,
    req,
  );
  return unwrap(res.data);
}

export async function recordCourseExamAiReview(
    courseId: string,
    req: ExamAiReviewRequest,
): Promise<void> {
  await apiClient.post<ApiResponse<void>>(
    `/api/teacher/courses/${courseId}/exams/ai-review`,
    req,
  );
}

export async function saveCourseExam(
    courseId: string,
    slotIndex: number,
    req: ExamConfigRequest,
): Promise<ExamConfigResponse> {
  const res = await apiClient.put<ApiResponse<ExamConfigResponse>>(
    `/api/teacher/courses/${courseId}/exams/${slotIndex}`,
    req,
  );
  return unwrap(res.data);
}

export async function deleteCourseExam(courseId: string, slotIndex: number): Promise<void> {
  await apiClient.delete(`/api/teacher/courses/${courseId}/exams/${slotIndex}`);
}

export async function listTeacherExamAttempts(): Promise<TeacherExamAttemptResponse[]> {
  const res = await apiClient.get<ApiResponse<TeacherExamAttemptResponse[]>>(
    '/api/teacher/exam-attempts',
  );
  return unwrap(res.data);
}

export async function gradeTeacherExamAttempt(
  attemptId: string,
  scorePercent: number,
  feedback: string,
  revisionReason?: string,
): Promise<TeacherExamAttemptResponse> {
  const res = await apiClient.put<ApiResponse<TeacherExamAttemptResponse>>(
    `/api/teacher/exam-attempts/${attemptId}/grade`,
    { scorePercent, feedback, revisionReason },
  );
  return unwrap(res.data);
}

export interface TeacherRetakeRequest {
  id: string;
  examConfigId: string;
  courseId: string;
  courseTitle: string;
  slotIndex: number;
  examName: string;
  studentId: string;
  studentName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  examEnrollmentStatus: 'AVAILABLE' | 'RETAKE_LOCKED' | 'RETAKE_APPROVED';
  requestedReason: string;
  extraAttempts: number | null;
  decidedReason: string | null;
  retakeExpireAt: string | null;
  requestCount: number;
  approvalCount: number;
  rejectedAt: string | null;
  cooldownUntil: string | null;
  createdAt: string;
  decidedAt: string | null;
  attemptsUsed: number;
  maxAttempts: number;
}

export async function listRetakeRequests(): Promise<TeacherRetakeRequest[]> {
  const res = await apiClient.get<ApiResponse<TeacherRetakeRequest[]>>(
    '/api/teacher/retake-requests',
  );
  return unwrap(res.data) ?? [];
}

export async function decideRetakeRequest(
  requestId: string,
  approve: boolean,
  reason: string,
  extraAttempts?: number,
): Promise<TeacherRetakeRequest> {
  const res = await apiClient.patch<ApiResponse<TeacherRetakeRequest>>(
    `/api/teacher/retake-requests/${requestId}/decide`,
    { approve, reason, extraAttempts },
  );
  return unwrap(res.data);
}

import { apiClient, unwrap } from './client';
import type { ApiResponse } from '../types/api';

export type ExamQuestionType = 'single' | 'multiple';
export type ExamDifficulty = 'easy' | 'medium' | 'hard';

export interface ExamQuestionPayload {
  id: string;
  text: string;
  type: ExamQuestionType;
  options: string[];
  correctIndices: number[];
  explanation?: string | null;
  points: number;
  difficulty: ExamDifficulty;
}

export interface ExamConfigRequest {
  name: string;
  description?: string | null;
  durationMinutes: number;
  passScorePercent: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showAnswerAfterSubmit: boolean;
  questions: ExamQuestionPayload[];
}

export interface ExamConfigResponse extends ExamConfigRequest {
  id: string;
  courseId: string;
  slotIndex: number;
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
  chapterConfigs?: Array<{
    chapterId: string;
    totalCount: number;
  }>;
}

export interface StudentExamRequiredChapter {
  chapterId: string;
  title: string;
  hasQuiz: boolean;
  quizPassed: boolean;
}

export interface StudentExamSummaryResponse {
  examId: string | null;
  slotIndex: number;
  name: string;
  description: string | null;
  durationMinutes: number | null;
  passScorePercent: number | null;
  maxAttempts: number | null;
  configured: boolean;
  unlocked: boolean;
  passed: boolean;
  latestScorePercent: number | null;
  attemptsUsed: number;
  requiredQuizCount: number;
  passedQuizCount: number;
  lockedReason: string | null;
  requiredChapters: StudentExamRequiredChapter[];
}

export interface StudentExamQuestion {
  id: string;
  text: string;
  type: ExamQuestionType;
  options: string[];
  points: number;
}

export interface StudentExamStartResponse {
  attemptId: string;
  examId: string;
  slotIndex: number;
  name: string;
  description: string | null;
  durationMinutes: number;
  totalQuestions: number;
  attemptNumber: number;
  questions: StudentExamQuestion[];
}

export interface StudentExamResultDetail {
  questionId: string;
  text: string;
  studentAnswers: number[];
  correctAnswers: number[];
  isCorrect: boolean;
  explanation: string | null;
  points: number;
}

export interface StudentExamResultResponse {
  attemptId: string;
  examId: string;
  slotIndex: number;
  scorePercent: number;
  passed: boolean;
  earnedPoints: number;
  totalPoints: number;
  attemptNumber: number;
  details: StudentExamResultDetail[];
}

export interface TeacherExamQuestionReview {
  id: string;
  text: string;
  type: ExamQuestionType;
  options: string[];
  studentAnswers: number[];
  correctAnswers: number[];
  correct: boolean;
  points: number;
  earnedPoints: number;
  explanation: string | null;
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
  passed: boolean;
  feedback: string | null;
  gradedAt: string | null;
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

export async function listStudentCourseExams(courseId: string): Promise<StudentExamSummaryResponse[]> {
  const res = await apiClient.get<ApiResponse<StudentExamSummaryResponse[]>>(
    `/api/student/courses/${courseId}/exams`,
  );
  return unwrap(res.data);
}

export async function startStudentExam(
    courseId: string,
    slotIndex: number,
): Promise<StudentExamStartResponse> {
  const res = await apiClient.post<ApiResponse<StudentExamStartResponse>>(
    `/api/student/courses/${courseId}/exams/${slotIndex}/start`,
  );
  return unwrap(res.data);
}

export async function submitStudentExam(
    attemptId: string,
    answers: Record<string, number[]>,
): Promise<StudentExamResultResponse> {
  const res = await apiClient.post<ApiResponse<StudentExamResultResponse>>(
    `/api/student/exam-attempts/${attemptId}/submit`,
    { answers },
  );
  return unwrap(res.data);
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
): Promise<TeacherExamAttemptResponse> {
  const res = await apiClient.put<ApiResponse<TeacherExamAttemptResponse>>(
    `/api/teacher/exam-attempts/${attemptId}/grade`,
    { scorePercent, feedback },
  );
  return unwrap(res.data);
}

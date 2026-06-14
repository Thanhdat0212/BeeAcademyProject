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

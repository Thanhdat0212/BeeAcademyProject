/**
 * Quiz API service
 * GV: cấu hình quiz — /api/teacher/chapters/:id/quiz-config
 * Student: làm quiz — /api/student/chapters/:id/quiz/*
 */
import { apiClient, unwrap } from './client';
import type { ApiResponse } from '../types/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QuizConfigResponse {
  id: string;
  chapterId: string;
  totalQuestions: number;
  easyCount: number;
  mediumCount: number;
  hardCount: number;
  timeLimitMinutes: number | null;
  passingScore: number;
  shuffleQuestions: boolean;
  shuffleChoices: boolean;
  maxAttempts: number | null;
  selectionMode: 'random' | 'manual';
  selectedQuestionIds: string[] | null;
}

export interface QuizConfigRequest {
  totalQuestions: number;
  easyCount: number;
  mediumCount: number;
  hardCount: number;
  timeLimitMinutes?: number;
  passingScore: number;
  shuffleQuestions: boolean;
  shuffleChoices: boolean;
  maxAttempts?: number;
  selectionMode?: 'random' | 'manual';
  selectedQuestionIds?: string[];
}

export interface ChoiceForStudent {
  id: string;
  content: string;
  position: number;
}

export interface QuestionForStudent {
  id: string;
  content: string;
  type: string;
  choices: ChoiceForStudent[];
}

export interface QuizAttemptStartResponse {
  attemptId: string;
  timeLimitMinutes: number | null;
  totalQuestions: number;
  attemptNumber: number;
  questions: QuestionForStudent[];
}

export interface QuizResultDetail {
  questionId: string;
  content: string;
  studentAnswer: string | null;
  correctAnswer: string | null;
  isCorrect: boolean;
  explanation: string | null;
}

export interface QuizResultResponse {
  attemptId: string;
  score: number;
  passed: boolean;
  correctCount: number;
  totalCount: number;
  attemptNumber: number;
  details: QuizResultDetail[];
}

// ─── Teacher: config ──────────────────────────────────────────────────────────

export async function getQuizConfig(chapterId: string): Promise<QuizConfigResponse> {
  const res = await apiClient.get<ApiResponse<QuizConfigResponse>>(
    `/api/teacher/chapters/${chapterId}/quiz-config`);
  return unwrap(res.data);
}

export async function saveQuizConfig(chapterId: string,
                                      req: QuizConfigRequest): Promise<QuizConfigResponse> {
  const res = await apiClient.put<ApiResponse<QuizConfigResponse>>(
    `/api/teacher/chapters/${chapterId}/quiz-config`, req);
  return unwrap(res.data);
}

// ─── Student: làm bài ─────────────────────────────────────────────────────────

export async function startQuiz(chapterId: string): Promise<QuizAttemptStartResponse> {
  const res = await apiClient.post<ApiResponse<QuizAttemptStartResponse>>(
    `/api/student/chapters/${chapterId}/quiz/start`);
  return unwrap(res.data);
}

export async function submitQuiz(
    attemptId: string,
    answers: Record<string, string | null>): Promise<QuizResultResponse> {
  const res = await apiClient.post<ApiResponse<QuizResultResponse>>(
    `/api/student/quiz/${attemptId}/submit`, { answers });
  return unwrap(res.data);
}

export async function getQuizResult(attemptId: string): Promise<QuizResultResponse> {
  const res = await apiClient.get<ApiResponse<QuizResultResponse>>(
    `/api/student/quiz/${attemptId}/result`);
  return unwrap(res.data);
}

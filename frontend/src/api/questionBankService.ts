import { apiClient, unwrap } from './client';
import type { ApiResponse } from '../types/api';

export type QuestionBankStatus = 'active' | 'inactive';

export interface QuestionBankResponse {
  id: string;
  title: string;
  description: string | null;
  status: QuestionBankStatus;
  categoryId: string;
  categoryName: string;
  grade: number;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuestionBankRequest {
  title: string;
  categoryId: string;
  grade: number;
  description?: string;
}

export async function listQuestionBanks(): Promise<QuestionBankResponse[]> {
  const res = await apiClient.get<ApiResponse<QuestionBankResponse[]>>('/api/teacher/question-banks');
  return unwrap(res.data);
}

export async function createQuestionBank(req: CreateQuestionBankRequest): Promise<QuestionBankResponse> {
  const res = await apiClient.post<ApiResponse<QuestionBankResponse>>('/api/teacher/question-banks', req);
  return unwrap(res.data);
}

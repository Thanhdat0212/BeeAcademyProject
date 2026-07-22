/**
 * Question Bank API service
 * Gọi các endpoint /api/teacher/questions của backend.
 */
import { apiClient, unwrap } from './client';
import type { ApiResponse, PageResponse, UploadResponse } from '../types/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'fill_in_blank'
  | 'matching'
  | 'essay'
  | 'essay_short'
  | 'essay_long'
  | 'image_question'
  | 'formula_question'
  | 'audio_question'
  | 'file_upload';
export type QuestionStatus = 'active' | 'inactive';

export interface MatchingPair {
  left: string;
  right: string;
}

export interface QuestionMetadata {
  acceptedAnswers?: string[];
  matchingPairs?: MatchingPair[];
  sampleAnswer?: string;
  wordLimit?: number | null;
  gradingRubric?: string;
  promptAssetUrl?: string;
  transcript?: string;
  formulaLatex?: string;
  allowedUploadTypes?: string[];
  maxFiles?: number | null;
  readingSetId?: string;
  sharedPromptTitle?: string;
  sharedPrompt?: string;
  questionOrderInSet?: number | null;
  aiPromptId?: string;
  aiStatus?: 'draft' | 'approved' | 'rejected';
  sourceRefs?: string[];
  rejectionReason?: string;
  optionIndexMap?: number[];
  optionImages?: string[];
  sourceType?: 'direct_exam' | 'question_bank' | 'ai';
  createdInExam?: boolean;
}

export interface ChoiceResponse {
  id: string;
  content: string;
  isCorrect: boolean | null;  // null khi trả cho student đang làm bài
  position: number;
  imageUrl?: string | null;
}

export interface QuestionResponse {
  id: string;
  content: string;
  explanation: string | null;
  defaultPoints: number | null;
  tags: string[];
  metadata: QuestionMetadata | null;
  difficulty: Difficulty;
  type: QuestionType;
  status: QuestionStatus;
  usageCount: number;
  questionBankId: string | null;
  questionBankTitle: string | null;
  categoryId: string | null;
  categoryName: string | null;
  grade: number | null;
  chapterId: string | null;
  chapterTitle: string | null;
  createdAt: string;
  duplicateWarning?: string | null;
  choices: ChoiceResponse[];
}

export interface QuestionVersionResponse {
  id: string;
  versionNo: number;
  questionBankId: string | null;
  categoryId: string | null;
  grade: number | null;
  chapterId: string | null;
  content: string;
  explanation: string | null;
  defaultPoints: number | null;
  tags: string[];
  metadata: QuestionMetadata | null;
  difficulty: Difficulty;
  type: QuestionType;
  status: QuestionStatus;
  choices: ChoiceResponse[] | null;
  changeReason: string | null;
  createdAt: string;
}

export interface QuestionAuditLogResponse {
  id: string;
  teacherId: string;
  questionId: string;
  oldVersion: number | null;
  newVersion: number | null;
  action: 'CREATE' | 'UPDATE' | 'ARCHIVE' | 'DELETE';
  oldState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  createdAt: string;
}

export interface QuestionStatsResponse {
  easyCount: number;
  mediumCount: number;
  hardCount: number;
  totalActive: number;
  multipleChoiceCount?: number;
  trueFalseCount?: number;
  fillInBlankCount?: number;
  imageQuestionCount?: number;
  essayCount?: number;
  totalExamSupported?: number;
}

export interface ExamSupportedQuestionStats {
  totalActive: number;
  multipleChoiceCount: number;
  trueFalseCount: number;
  fillInBlankCount: number;
  imageQuestionCount: number;
  essayCount: number;
}

export interface CreateQuestionRequest {
  categoryId: string;
  grade: number;
  questionBankId?: string;
  chapterId?: string;
  content: string;
  explanation?: string;
  difficulty: Difficulty;
  type: QuestionType;
  choices: Array<{ content: string; isCorrect: boolean; imageUrl?: string }>;
  defaultPoints?: number | null;
  tags?: string[];
  metadata?: QuestionMetadata | null;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createQuestion(req: CreateQuestionRequest): Promise<QuestionResponse> {
  const res = await apiClient.post<ApiResponse<QuestionResponse>>(
    '/api/teacher/questions', req);
  return unwrap(res.data);
}

export interface ListQuestionsParams {
  categoryId?: string;
  grade?: number;
  questionBankId?: string;
  chapterId?: string;
  difficulty?: Difficulty;
  status?: QuestionStatus;
  page?: number;
  size?: number;
}

export async function listQuestions(params: ListQuestionsParams = {}):
    Promise<PageResponse<QuestionResponse>> {
  const res = await apiClient.get<ApiResponse<PageResponse<QuestionResponse>>>(
    '/api/teacher/questions', {
      params: { ...params, page: params.page ?? 0, size: params.size ?? 20 },
    });
  return unwrap(res.data);
}

export async function getQuestion(questionId: string): Promise<QuestionResponse> {
  const res = await apiClient.get<ApiResponse<QuestionResponse>>(
    `/api/teacher/questions/${questionId}`);
  return unwrap(res.data);
}

export async function updateQuestion(questionId: string,
                                      req: CreateQuestionRequest): Promise<QuestionResponse> {
  const res = await apiClient.put<ApiResponse<QuestionResponse>>(
    `/api/teacher/questions/${questionId}`, req);
  return unwrap(res.data);
}

export async function deleteQuestion(questionId: string): Promise<void> {
  await apiClient.delete(`/api/teacher/questions/${questionId}`);
}

export async function listQuestionVersions(questionId: string): Promise<QuestionVersionResponse[]> {
  const res = await apiClient.get<ApiResponse<QuestionVersionResponse[]>>(
    `/api/teacher/questions/${questionId}/versions`,
  );
  return unwrap(res.data);
}

export async function listQuestionAuditLogs(questionId: string): Promise<QuestionAuditLogResponse[]> {
  const res = await apiClient.get<ApiResponse<QuestionAuditLogResponse[]>>(
    `/api/teacher/questions/${questionId}/audit-logs`,
  );
  return unwrap(res.data);
}

export async function getQuestionStats(chapterId: string): Promise<QuestionStatsResponse> {
  const res = await apiClient.get<ApiResponse<QuestionStatsResponse>>(
    `/api/teacher/questions/stats/${chapterId}`);
  return unwrap(res.data);
}

export async function getExamSupportedQuestionStats(
  chapterId: string,
): Promise<ExamSupportedQuestionStats> {
  const items: QuestionResponse[] = [];
  let page = 0;

  while (true) {
    const response = await listQuestions({
      chapterId,
      status: 'active',
      page,
      size: 200,
    });
    items.push(...response.items);
    if (!response.hasNext) break;
    page += 1;
  }

  let multipleChoiceCount = 0;
  let trueFalseCount = 0;
  let fillInBlankCount = 0;
  let imageQuestionCount = 0;
  let essayCount = 0;

  items.forEach(question => {
    switch (question.type) {
      case 'multiple_choice':
        multipleChoiceCount += 1;
        break;
      case 'true_false':
        trueFalseCount += 1;
        break;
      case 'fill_in_blank':
        fillInBlankCount += 1;
        break;
      case 'image_question':
        imageQuestionCount += 1;
        break;
      case 'essay':
      case 'essay_short':
      case 'essay_long':
        essayCount += 1;
        break;
      default:
        break;
    }
  });

  return {
    totalActive: multipleChoiceCount + trueFalseCount + fillInBlankCount
      + imageQuestionCount + essayCount,
    multipleChoiceCount,
    trueFalseCount,
    fillInBlankCount,
    imageQuestionCount,
    essayCount,
  };
}

export async function countActiveQuestionsByChapter(chapterId: string): Promise<number> {
  const page = await listQuestions({
    chapterId,
    status: 'active',
    page: 0,
    size: 1,
  });
  return page.totalItems;
}

export interface BulkImportResult {
  created: number;
  failed: number;
  errors?: Array<{ row: number; message: string }>;
}

export async function bulkCreateQuestions(
  requests: CreateQuestionRequest[],
): Promise<BulkImportResult> {
  const res = await apiClient.post<ApiResponse<BulkImportResult>>(
    '/api/teacher/questions/bulk',
    requests,
    { timeout: 120000 },
  );
  return unwrap(res.data);
}

export async function uploadQuestionImage(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiClient.post<ApiResponse<UploadResponse>>(
    '/api/upload/question-image',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 },
  );
  return unwrap(res.data);
}

export async function uploadQuestionAudio(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiClient.post<ApiResponse<UploadResponse>>(
    '/api/upload/question-audio',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 },
  );
  return unwrap(res.data);
}

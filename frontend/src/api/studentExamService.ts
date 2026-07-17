import { apiClient, unwrap } from './client';
import type { ApiResponse } from '../types/api';
import type { QuestionMetadata, QuestionType } from './questionService';

export type StudentExamQuestionType = QuestionType;
export type StudentExamDifficulty = 'easy' | 'medium' | 'hard';

export interface StudentExamQuestion {
  id: string;
  text: string;
  type: StudentExamQuestionType;
  options: string[];
  metadata?: QuestionMetadata | null;
  points: number | null;
  difficulty: StudentExamDifficulty | null;
}

export interface StudentExam {
  id: string;
  courseId: string;
  slotIndex: number;
  scopeStartChapterId: string | null;
  scopeStartChapterTitle: string | null;
  placementChapterId: string | null;
  placementChapterTitle: string | null;
  name: string;
  description: string | null;
  durationMinutes: number;
  passScorePercent: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showAnswerAfterSubmit: boolean;
  requireFullscreen: boolean;
  blockCopyPaste: boolean;
  questionCount: number;
  totalPoints: number;
  questions: StudentExamQuestion[];
  updatedAt: string;
}

export interface SubmitExamAnswer {
  selectedIndices?: number[];
  textAnswer?: string;
  imageUrls?: string[];
  answerData?: Record<string, unknown> | null;
}

export interface StudentExamAnswerImageUpload {
  url: string;
  name: string;
  type: string;
  sizeBytes: number;
}

export interface StudentExamSubmissionResponse {
  attemptId: string;
  examId: string;
  examName: string;
  slotIndex: number;
  attemptNumber: number;
  autoScorePercent: number;
  passed: boolean | null;
  status: 'pending' | 'graded';
  correctObjectiveCount: number;
  totalObjectiveCount: number;
  submittedAt: string;
  manualScorePercent: number | null;
  effectiveScorePercent: number | null;
  teacherFeedback: string | null;
  gradedAt: string | null;
}

export async function listStudentExams(courseId: string): Promise<StudentExam[]> {
  const res = await apiClient.get<ApiResponse<StudentExam[]>>(
    `/api/student/courses/${encodeURIComponent(courseId)}/exams`,
  );
  return unwrap(res.data);
}

export async function submitStudentExam(
  courseId: string,
  slotIndex: number,
  answers: Record<string, SubmitExamAnswer>,
): Promise<StudentExamSubmissionResponse> {
  const res = await apiClient.post<ApiResponse<StudentExamSubmissionResponse>>(
    `/api/student/courses/${encodeURIComponent(courseId)}/exams/${slotIndex}/submit`,
    { answers },
  );
  return unwrap(res.data);
}

export async function getStudentExamResult(
  courseId: string,
  slotIndex: number,
): Promise<StudentExamSubmissionResponse | null> {
  const res = await apiClient.get<ApiResponse<StudentExamSubmissionResponse | null>>(
    `/api/student/courses/${encodeURIComponent(courseId)}/exams/${slotIndex}/result`,
  );
  return unwrap(res.data) ?? null;
}

export async function saveStudentExamDraft(
  courseId: string,
  slotIndex: number,
  answers: Record<string, SubmitExamAnswer>,
): Promise<void> {
  await apiClient.post<ApiResponse<void>>(
    `/api/student/courses/${encodeURIComponent(courseId)}/exams/${slotIndex}/draft`,
    { answers },
  );
}

export async function uploadStudentExamAnswerImage(
  courseId: string,
  file: File,
): Promise<StudentExamAnswerImageUpload> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiClient.post<ApiResponse<{
    publicUrl: string;
    fileType: string;
    fileSizeBytes: number;
  }>>(
    `/api/student/courses/${encodeURIComponent(courseId)}/exams/answer-images`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  const uploaded = unwrap(res.data);
  return {
    url: uploaded.publicUrl,
    name: file.name,
    type: uploaded.fileType,
    sizeBytes: uploaded.fileSizeBytes,
  };
}

export async function getStudentExam(
  courseId: string,
  slotIndex: number,
): Promise<StudentExam> {
  const res = await apiClient.get<ApiResponse<StudentExam>>(
    `/api/student/courses/${encodeURIComponent(courseId)}/exams/${slotIndex}`,
  );
  return unwrap(res.data);
}

export type ExamRetakeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ExamRetakeRequest {
  id: string;
  examConfigId: string;
  courseId: string;
  courseTitle: string;
  slotIndex: number;
  examName: string;
  studentId: string;
  studentName: string;
  status: ExamRetakeRequestStatus;
  requestedReason: string;
  extraAttempts: number | null;
  decidedReason: string | null;
  retakeExpireAt: string | null;
  createdAt: string;
  decidedAt: string | null;
  attemptsUsed: number;
  maxAttempts: number;
}

export async function requestExamRetake(
  courseId: string,
  slotIndex: number,
  reason: string,
): Promise<ExamRetakeRequest> {
  const res = await apiClient.post<ApiResponse<ExamRetakeRequest>>(
    `/api/student/courses/${encodeURIComponent(courseId)}/exams/${slotIndex}/retake-requests`,
    { reason },
  );
  return unwrap(res.data);
}

export async function getLatestExamRetakeRequest(
  courseId: string,
  slotIndex: number,
): Promise<ExamRetakeRequest | null> {
  const res = await apiClient.get<ApiResponse<ExamRetakeRequest | null>>(
    `/api/student/courses/${encodeURIComponent(courseId)}/exams/${slotIndex}/retake-requests/latest`,
  );
  return unwrap(res.data) ?? null;
}

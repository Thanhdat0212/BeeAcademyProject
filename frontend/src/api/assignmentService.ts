import { apiClient, unwrap } from './client';
import type { ApiResponse } from '../types/api';

export type AssignmentSubmissionStatus = 'pending' | 'graded' | 'resubmit';

export interface AssignmentSubmissionResponse {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  assignmentInstructions: string | null;
  courseId: string;
  courseTitle: string;
  studentId: string;
  studentName: string | null;
  answerText: string | null;
  files: Array<{
    name: string | null;
    url: string;
    previewUrl: string | null;
    previewSupported: boolean;
    type: string | null;
    sizeBytes: number | null;
  }>;
  attemptNumber: number;
  status: AssignmentSubmissionStatus;
  score: number | null;
  maxScore: number;
  feedback: string | null;
  submittedAt: string;
  expectedGradedBy: string;
  gradedAt: string | null;
  dueAt: string | null;
  late: boolean;
  appliedLatePenaltyPercent: number;
  rawScore: number | null;
}

export async function listTeacherAssignmentSubmissions():
    Promise<AssignmentSubmissionResponse[]> {
  const response = await apiClient.get<ApiResponse<AssignmentSubmissionResponse[]>>(
    '/api/teacher/assignment-submissions',
  );
  return unwrap(response.data);
}

export async function gradeAssignmentSubmission(
  submissionId: string,
  score: number,
  feedback: string,
  revisionReason?: string,
): Promise<AssignmentSubmissionResponse> {
  const response = await apiClient.put<ApiResponse<AssignmentSubmissionResponse>>(
    `/api/teacher/assignment-submissions/${submissionId}/grade`,
    { score, feedback, revisionReason },
  );
  return unwrap(response.data);
}

export interface SubmissionFile {
  name: string | null;
  url: string;
  previewUrl?: string | null;
  previewSupported?: boolean;
  type: string | null;
  sizeBytes: number | null;
}

export interface TeacherAssignmentResponse {
  id: string;
  title: string;
  description: string | null;
  maxScore: number;
  dueAt: string | null;
  maxAttempts: number;
  allowLateSubmission: boolean;
  latePenaltyPercent: number;
  acceptingSubmissions: boolean;
  courseId: string | null;
  courseTitle: string | null;
  chapterId: string | null;
  chapterTitle: string | null;
  lessonId: string | null;
  lessonTitle: string | null;
  createdAt: string;
}

export interface CreateAssignmentPayload {
  chapterId?: string;
  lessonId?: string;
  title: string;
  description?: string;
  maxScore: number;
  dueAt?: string;
  maxAttempts?: number;
  allowLateSubmission?: boolean;
  latePenaltyPercent?: number;
  acceptingSubmissions?: boolean;
}

export interface UpdateAssignmentPolicyPayload {
  dueAt?: string;
  maxAttempts?: number;
  allowLateSubmission?: boolean;
  latePenaltyPercent?: number;
  acceptingSubmissions?: boolean;
}

export type SubmissionAvailability =
  | 'open'
  | 'late_allowed'
  | 'overdue'
  | 'closed'
  | 'attempts_exhausted'
  | 'graded';

export interface StudentAssignmentResponse {
  id: string;
  title: string;
  description: string | null;
  maxScore: number;
  dueAt: string | null;
  maxAttempts: number;
  allowLateSubmission: boolean;
  latePenaltyPercent: number;
  acceptingSubmissions: boolean;
  submissionAvailability: SubmissionAvailability;
  canSubmit: boolean;
  remainingAttempts: number;
  chapterId: string | null;
  chapterTitle: string | null;
  lessonId: string | null;
  lessonTitle: string | null;
  mySubmission: {
    id: string;
    status: AssignmentSubmissionStatus;
    content: string | null;
    files: SubmissionFile[];
    score: number | null;
    feedback: string | null;
    submittedAt: string;
    expectedGradedBy: string;
    gradedAt: string | null;
    late: boolean;
    attemptNumber: number;
    appliedLatePenaltyPercent: number;
    rawScore: number | null;
  } | null;
}

export interface UploadedSubmissionFile {
  storagePath: string;
  publicUrl: string | null;
  fileType: string | null;
  fileSizeBytes: number | null;
}

export async function listTeacherAssignments(): Promise<TeacherAssignmentResponse[]> {
  const response = await apiClient.get<ApiResponse<TeacherAssignmentResponse[]>>(
    '/api/teacher/assignments',
  );
  return unwrap(response.data);
}

export async function createAssignment(
  payload: CreateAssignmentPayload,
): Promise<TeacherAssignmentResponse> {
  const response = await apiClient.post<ApiResponse<TeacherAssignmentResponse>>(
    '/api/teacher/assignments',
    payload,
  );
  return unwrap(response.data);
}

export async function deleteAssignment(assignmentId: string): Promise<void> {
  await apiClient.delete(`/api/teacher/assignments/${assignmentId}`);
}

export async function updateAssignmentSubmissionPolicy(
  assignmentId: string,
  payload: UpdateAssignmentPolicyPayload,
): Promise<TeacherAssignmentResponse> {
  const response = await apiClient.patch<ApiResponse<TeacherAssignmentResponse>>(
    `/api/teacher/assignments/${assignmentId}/submission-policy`,
    payload,
  );
  return unwrap(response.data);
}

export async function listCourseAssignments(
  courseId: string,
): Promise<StudentAssignmentResponse[]> {
  const response = await apiClient.get<ApiResponse<StudentAssignmentResponse[]>>(
    `/api/student/courses/${courseId}/assignments`,
  );
  return unwrap(response.data);
}

export async function submitAssignment(
  assignmentId: string,
  content: string,
  files: SubmissionFile[],
): Promise<StudentAssignmentResponse> {
  const response = await apiClient.post<ApiResponse<StudentAssignmentResponse>>(
    `/api/student/assignments/${assignmentId}/submissions`,
    { content, files },
  );
  return unwrap(response.data);
}

export async function uploadSubmissionFile(
  assignmentId: string,
  file: File,
): Promise<UploadedSubmissionFile> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post<ApiResponse<UploadedSubmissionFile>>(
    `/api/student/assignments/${assignmentId}/files`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return unwrap(response.data);
}

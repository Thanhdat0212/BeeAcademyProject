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
    type: string | null;
    sizeBytes: number | null;
  }>;
  attemptNumber: number;
  status: AssignmentSubmissionStatus;
  score: number | null;
  maxScore: number;
  feedback: string | null;
  submittedAt: string;
  gradedAt: string | null;
  dueAt: string | null;
  late: boolean;
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
): Promise<AssignmentSubmissionResponse> {
  const response = await apiClient.put<ApiResponse<AssignmentSubmissionResponse>>(
    `/api/teacher/assignment-submissions/${submissionId}/grade`,
    { score, feedback },
  );
  return unwrap(response.data);
}

import { apiClient, unwrap } from './client';
import type { ApiResponse } from '../types/api';

export interface StudentLessonNote {
  id: string;
  lessonId: string;
  timeSec: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaveStudentLessonNotePayload {
  timeSec: number;
  content: string;
}

function notesPath(courseId: string, lessonId: string): string {
  return `/api/student/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/notes`;
}

export async function listStudentLessonNotes(
  courseId: string,
  lessonId: string,
): Promise<StudentLessonNote[]> {
  const response = await apiClient.get<ApiResponse<StudentLessonNote[]>>(
    notesPath(courseId, lessonId),
  );
  return unwrap(response.data) ?? [];
}

export async function createStudentLessonNote(
  courseId: string,
  lessonId: string,
  payload: SaveStudentLessonNotePayload,
): Promise<StudentLessonNote> {
  const response = await apiClient.post<ApiResponse<StudentLessonNote>>(
    notesPath(courseId, lessonId),
    payload,
  );
  return unwrap(response.data);
}

export async function updateStudentLessonNote(
  courseId: string,
  lessonId: string,
  noteId: string,
  payload: SaveStudentLessonNotePayload,
): Promise<StudentLessonNote> {
  const response = await apiClient.put<ApiResponse<StudentLessonNote>>(
    `${notesPath(courseId, lessonId)}/${encodeURIComponent(noteId)}`,
    payload,
  );
  return unwrap(response.data);
}

export async function deleteStudentLessonNote(
  courseId: string,
  lessonId: string,
  noteId: string,
): Promise<void> {
  await apiClient.delete<ApiResponse<null>>(
    `${notesPath(courseId, lessonId)}/${encodeURIComponent(noteId)}`,
  );
}

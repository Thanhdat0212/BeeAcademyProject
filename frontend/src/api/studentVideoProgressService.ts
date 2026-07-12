import { apiClient, unwrap } from './client';
import type { ApiResponse } from '../types/api';

export interface StudentVideoProgress {
  lessonId: string;
  positionSec: number;
  durationSec: number;
  updatedAt: string | null;
  watchedSegments: VideoWatchedSegment[];
  watchedDurationSec: number;
  completed: boolean;
}

export interface VideoWatchedSegment {
  startSec: number;
  endSec: number;
}

export interface SaveStudentVideoProgressPayload {
  positionSec: number;
  durationSec: number;
  watchedSegments: VideoWatchedSegment[];
}

function progressPath(courseId: string, lessonId: string): string {
  return `/api/student/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/video-progress`;
}

export async function getStudentVideoProgress(
  courseId: string,
  lessonId: string,
): Promise<StudentVideoProgress> {
  const response = await apiClient.get<ApiResponse<StudentVideoProgress>>(
    progressPath(courseId, lessonId),
  );
  return unwrap(response.data);
}

export async function getLatestStudentVideoProgress(
  courseId: string,
): Promise<StudentVideoProgress | null> {
  const response = await apiClient.get<ApiResponse<StudentVideoProgress | null>>(
    `/api/student/courses/${encodeURIComponent(courseId)}/video-progress/latest`,
  );
  return unwrap(response.data);
}

export async function saveStudentVideoProgress(
  courseId: string,
  lessonId: string,
  payload: SaveStudentVideoProgressPayload,
): Promise<StudentVideoProgress> {
  const response = await apiClient.put<ApiResponse<StudentVideoProgress>>(
    progressPath(courseId, lessonId),
    payload,
  );
  return unwrap(response.data);
}

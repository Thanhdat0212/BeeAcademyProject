import { apiClient, unwrap } from './client';
import type { ApiResponse, CourseProgress } from '../types/api';
import type { StudentExam } from './studentExamService';
import type { StudentVideoProgress } from './studentVideoProgressService';

/**
 * Gói dữ liệu học tập của trang chi tiết khóa học, trả về trong MỘT call
 * thay cho 3 call riêng (progress + exams + video-progress/latest).
 * Chỉ dùng cho học sinh đã enroll — backend trả 403 nếu không đủ quyền.
 */
export interface StudentLearningContext {
  progress: CourseProgress;
  exams: StudentExam[];
  latestVideoProgress: StudentVideoProgress | null;
}

export async function getStudentLearningContext(
  courseId: string,
): Promise<StudentLearningContext> {
  const response = await apiClient.get<ApiResponse<StudentLearningContext>>(
    `/api/student/courses/${encodeURIComponent(courseId)}/learning-context`,
  );
  return unwrap(response.data);
}

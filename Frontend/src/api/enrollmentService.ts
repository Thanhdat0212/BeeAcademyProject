/**
 * Enrollment API — ghi danh khóa học sau khi thanh toán.
 *
 * Sau khi gọi thành công, backend sẽ nhận ra student là enrolled:
 *   - GET /api/courses/{id} trả enrolled=true
 *   - Backend trả đầy đủ videoUrl (signed URL) cho các lesson
 *
 * Tất cả hàm đều idempotent — gọi nhiều lần an toàn.
 */
import { apiClient } from './client';

/**
 * Ghi danh học sinh vào một khóa học.
 * Gọi sau khi thanh toán thành công (mock hoặc thật).
 *
 * @param courseId UUID khóa học
 */
export async function enrollCourse(courseId: string): Promise<void> {
  await apiClient.post(`/api/courses/${courseId}/enroll`);
}

/**
 * Ghi danh nhiều khóa học cùng lúc (sau batch checkout).
 * Dùng Promise.allSettled để một khóa lỗi không làm fail cả batch.
 *
 * @param courseIds Mảng UUID khóa học
 */
export async function enrollCourses(courseIds: string[]): Promise<void> {
  if (courseIds.length === 0) return;
  await Promise.allSettled(courseIds.map(id => enrollCourse(id)));
}

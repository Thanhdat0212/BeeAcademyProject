import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ─── Cấu trúc Q&A hỏi đáp trong phòng học ─────────────────────────────────────
export interface QAReply {
  id: string;
  authorName: string;
  content: string;
  date: string;
}

export interface QAItem {
  id: string;
  authorName: string;
  content: string;
  date: string;
  replies: QAReply[];
}

interface CourseState {
  purchasedIds: string[];
  enrollCourses: (courseIds: string[]) => void;

  // Danh sách ID khóa học được đánh dấu yêu thích
  favoritedIds: string[];
  // Toggle: nếu đã yêu thích → bỏ, chưa → thêm
  toggleFavorite: (courseId: string) => void;

  // Tiến độ học tập: mapping từ courseId -> danh sách các lessonId đã học xong
  completedLessons: Record<string, string[]>;
  toggleLessonCompleted: (courseId: string, lessonId: string) => void;

  // Điểm số kiểm tra: mapping từ courseId -> lessonId -> điểm số cao nhất (%)
  quizScores: Record<string, Record<string, number>>;
  saveQuizScore: (courseId: string, lessonId: string, score: number) => void;

  // Ghi chú bài học: mapping từ courseId -> lessonId -> nội dung ghi chú text
  lessonNotes: Record<string, Record<string, string>>;
  saveLessonNote: (courseId: string, lessonId: string, note: string) => void;

  // Hỏi đáp Q&A: mapping từ courseId -> danh sách các câu hỏi thảo luận
  courseQA: Record<string, QAItem[]>;
  addQAQuestion: (courseId: string, authorName: string, content: string) => void;
  addQAReply: (courseId: string, questionId: string, authorName: string, content: string) => void;
}

export const useCourseStore = create<CourseState>()(
  persist(
    (set) => ({
      purchasedIds: [],
      enrollCourses: (courseIds) => set((state) => {
        const newIds = courseIds.filter(id => !state.purchasedIds.includes(id));
        return { purchasedIds: [...state.purchasedIds, ...newIds] };
      }),

      favoritedIds: [],
      toggleFavorite: (courseId) => set((state) => {
        const isFav = state.favoritedIds.includes(courseId);
        return {
          favoritedIds: isFav
            ? state.favoritedIds.filter(id => id !== courseId) // bỏ yêu thích
            : [...state.favoritedIds, courseId],               // thêm yêu thích
        };
      }),

      completedLessons: {},
      toggleLessonCompleted: (courseId, lessonId) => set((state) => {
        const currentList = state.completedLessons[courseId] ?? [];
        const isCompleted = currentList.includes(lessonId);
        // Nếu đã hoàn thành thì bỏ đi (toggle), chưa thì thêm vào
        const newList = isCompleted
          ? currentList.filter(id => id !== lessonId)
          : [...currentList, lessonId];
        return {
          completedLessons: {
            ...state.completedLessons,
            [courseId]: newList
          }
        };
      }),

      quizScores: {},
      saveQuizScore: (courseId, lessonId, score) => set((state) => {
        const courseScores = state.quizScores[courseId] ?? {};
        const oldScore = courseScores[lessonId] ?? 0;
        // Chỉ lưu điểm số cao nhất của học viên
        const newScore = Math.max(oldScore, score);
        return {
          quizScores: {
            ...state.quizScores,
            [courseId]: {
              ...courseScores,
              [lessonId]: newScore
            }
          }
        };
      }),

      lessonNotes: {},
      saveLessonNote: (courseId, lessonId, note) => set((state) => {
        const courseNotes = state.lessonNotes[courseId] ?? {};
        return {
          lessonNotes: {
            ...state.lessonNotes,
            [courseId]: {
              ...courseNotes,
              [lessonId]: note
            }
          }
        };
      }),

      courseQA: {},
      addQAQuestion: (courseId, authorName, content) => set((state) => {
        const list = state.courseQA[courseId] ?? [];
        const newQuestion: QAItem = {
          id: `qa-${Date.now()}`,
          authorName,
          content,
          date: new Date().toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }),
          replies: []
        };
        return {
          courseQA: {
            ...state.courseQA,
            [courseId]: [newQuestion, ...list] // câu hỏi mới lên đầu
          }
        };
      }),

      addQAReply: (courseId, questionId, authorName, content) => set((state) => {
        const list = state.courseQA[courseId] ?? [];
        const updatedList = list.map((qa) => {
          if (qa.id === questionId) {
            const newReply: QAReply = {
              id: `reply-${Date.now()}`,
              authorName,
              content,
              date: new Date().toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }),
            };
            return {
              ...qa,
              replies: [...qa.replies, newReply] // append reply xuống cuối câu hỏi
            };
          }
          return qa;
        });
        return {
          courseQA: {
            ...state.courseQA,
            [courseId]: updatedList
          }
        };
      }),
    }),
    {
      name: 'bee-academy-course',
      storage: createJSONStorage(() => localStorage),
    }
  )
);



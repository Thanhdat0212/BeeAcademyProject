export type Subject = 'Toán' | 'Lý' | 'Hóa' | 'Văn' | 'Sử' | 'Địa' | 'Công nghệ' | 'Tất cả';
export type Grade = 'Lớp 6' | 'Lớp 7' | 'Lớp 8' | 'Lớp 9' | 'Tất cả';

export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface LessonDocument {
  id?: string;
  name: string;
  fileUrl: string | null;
  fileType: string;
  fileSizeBytes: number;
  position?: number;
}

export interface Lesson {
  id: string;
  title: string;
  duration: string;
  type: 'video' | 'pdf' | 'quiz';
  url: string;
  isFree?: boolean;
  isCompleted?: boolean;
  completionRule?: 'DOCUMENT_OPENED' | 'MARK_AS_COMPLETE' | 'ASSIGNMENT_SUBMITTED' | 'ASSIGNMENT_PASSED' | null;
  transcript?: string | null;
  subtitleUrl?: string | null;
  videoFallbackUrl?: string | null;
  slideCueSeconds?: string | null;
  questions?: QuizQuestion[];
  documents?: LessonDocument[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  detailedDescription?: string;
  objective?: string;
  audience?: string;
  price?: string;
  originalPrice?: string;
  isOnSale?: boolean;
  categorySlug?: string;
  totalDurationSec?: number;
  totalChapters?: number;
  subject: Subject;
  grade: Grade;
  image: string;
  introVideoUrl?: string;
  rating: number;
  reviewCount?: number;
  students: number;
  instructor: string;
  isEnrolled: boolean;
  hasFreePreview?: boolean;
  progress?: number;
  purchasedAt?: string | null;
  lastAccessedAt?: string | null;
  learningStatus?: 'not_started' | 'in_progress' | 'completed' | null;
  finalExamPassed?: boolean | null;
  allRequiredExamsPassed?: boolean | null;
  lessons?: Lesson[];
}

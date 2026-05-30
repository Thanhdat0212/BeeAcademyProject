export type Subject = 'Toán' | 'Lý' | 'Hóa' | 'Văn' | 'Sử' | 'Địa' | 'Tất cả';
export type Grade = 'Lớp 6' | 'Lớp 7' | 'Lớp 8' | 'Lớp 9' | 'Tất cả';

export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Lesson {
  id: string;
  title: string;
  duration: string;
  type: 'video' | 'pdf' | 'quiz';
  url: string;
  isCompleted?: boolean;
  questions?: QuizQuestion[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  detailedDescription?: string;
  price?: string;
  subject: Subject;
  grade: Grade;
  image: string;
  rating: number;
  students: number;
  instructor: string;
  isEnrolled: boolean;
  progress?: number;
  lessons?: Lesson[];
}

// ─── Quiz: Toán Đại Số – Chương 1 (Hằng đẳng thức) ──────────────────────────
export const QUIZ_TOAN_C1: QuizQuestion[] = [
  {
    id: 'tc1q1',
    text: 'Hằng đẳng thức (a + b)² bằng biểu thức nào sau đây?',
    options: ['a² + b²', 'a² + 2ab + b²', 'a² − 2ab + b²', '2a² + 2b²'],
    correctIndex: 1,
    explanation: '(a + b)² = a² + 2ab + b² — bình phương của một tổng.',
  },
  {
    id: 'tc1q2',
    text: 'Hằng đẳng thức (a − b)² cho kết quả nào?',
    options: ['a² + 2ab + b²', 'a² − b²', 'a² − 2ab + b²', '−(a + b)²'],
    correctIndex: 2,
    explanation: '(a − b)² = a² − 2ab + b² — bình phương của một hiệu.',
  },
  {
    id: 'tc1q3',
    text: 'Tích (a + b)(a − b) bằng bao nhiêu?',
    options: ['a² + b²', 'a² − 2ab − b²', '2a²', 'a² − b²'],
    correctIndex: 3,
    explanation: '(a + b)(a − b) = a² − b² — hằng đẳng thức hiệu hai bình phương.',
  },
  {
    id: 'tc1q4',
    text: 'Tính giá trị (x + 3)² khi x = 2.',
    options: ['10', '13', '25', '7'],
    correctIndex: 2,
    explanation: 'x = 2 → (2 + 3)² = 5² = 25.',
  },
  {
    id: 'tc1q5',
    text: 'Khai triển (2x + 1)² cho kết quả nào?',
    options: ['4x² + 1', '2x² + 4x + 1', '4x² − 4x + 1', '4x² + 4x + 1'],
    correctIndex: 3,
    explanation: '(2x + 1)² = (2x)² + 2·(2x)·1 + 1² = 4x² + 4x + 1.',
  },
];

// ─── Quiz: Toán Đại Số – Chương 2 (Phương trình bậc nhất) ────────────────────
const QUIZ_TOAN_C2: QuizQuestion[] = [
  {
    id: 'tc2q1',
    text: 'Phương trình bậc nhất một ẩn có dạng chuẩn là?',
    options: ['ax² + b = 0', 'ax + b = 0  (a ≠ 0)', 'ax + by = 0', 'a + b = 0'],
    correctIndex: 1,
    explanation: 'Dạng chuẩn: ax + b = 0 với điều kiện a ≠ 0.',
  },
  {
    id: 'tc2q2',
    text: 'Nghiệm của phương trình 2x + 6 = 0 là?',
    options: ['x = 3', 'x = −3', 'x = 6', 'x = −6'],
    correctIndex: 1,
    explanation: '2x = −6 → x = −3.',
  },
  {
    id: 'tc2q3',
    text: 'Phương trình 3(x − 2) = x + 4 có nghiệm là?',
    options: ['x = 4', 'x = 3', 'x = 5', 'x = 2'],
    correctIndex: 2,
    explanation: '3x − 6 = x + 4 → 2x = 10 → x = 5.',
  },
  {
    id: 'tc2q4',
    text: 'Điều kiện để ax + b = 0 có nghiệm duy nhất là?',
    options: ['a = 0', 'b = 0', 'a ≠ 0', 'a = b'],
    correctIndex: 2,
    explanation: 'Khi a ≠ 0, nghiệm duy nhất x = −b/a.',
  },
  {
    id: 'tc2q5',
    text: 'Tập nghiệm của bất phương trình x − 5 > 0 là?',
    options: ['x < 5', 'x ≤ 5', 'x > 5', 'x ≥ 5'],
    correctIndex: 2,
    explanation: 'x − 5 > 0 → x > 5.',
  },
];

// ─── Quiz: Văn học dân gian – Chương 1 ───────────────────────────────────────
export const QUIZ_VAN_C1: QuizQuestion[] = [
  {
    id: 'vc1q1',
    text: 'Ca dao thuộc thể loại nào của văn học dân gian?',
    options: ['Truyện cổ tích', 'Thơ trữ tình dân gian', 'Truyền thuyết', 'Tục ngữ'],
    correctIndex: 1,
    explanation: 'Ca dao là thơ trữ tình dân gian, diễn đạt tâm tư tình cảm của người lao động.',
  },
  {
    id: 'vc1q2',
    text: '"Con Rồng cháu Tiên" thuộc thể loại văn học dân gian nào?',
    options: ['Cổ tích', 'Ngụ ngôn', 'Truyền thuyết', 'Thần thoại'],
    correctIndex: 2,
    explanation: 'Đây là truyền thuyết về nguồn gốc dân tộc Việt Nam.',
  },
  {
    id: 'vc1q3',
    text: 'Câu tục ngữ nào thể hiện tinh thần đoàn kết?',
    options: [
      'Uống nước nhớ nguồn',
      'Một cây làm chẳng nên non, ba cây chụm lại nên hòn núi cao',
      'Công cha như núi Thái Sơn',
      'Học thầy không tày học bạn',
    ],
    correctIndex: 1,
    explanation: '"Một cây làm chẳng nên non..." nhấn mạnh sức mạnh khi đoàn kết.',
  },
  {
    id: 'vc1q4',
    text: 'Nhân vật Thánh Gióng đại diện cho điều gì?',
    options: [
      'Sự thông minh của người Việt',
      'Tinh thần bất khuất chống giặc ngoại xâm',
      'Lòng hiếu thảo với cha mẹ',
      'Sự cần cù lao động',
    ],
    correctIndex: 1,
    explanation: 'Thánh Gióng là biểu tượng tinh thần đấu tranh chống ngoại xâm của dân tộc.',
  },
  {
    id: 'vc1q5',
    text: 'Thần thoại khác truyền thuyết ở điểm chính nào?',
    options: [
      'Thần thoại có nhân vật thần linh',
      'Thần thoại giải thích nguồn gốc thế giới và con người',
      'Thần thoại ngắn hơn truyền thuyết',
      'Thần thoại không có yếu tố kỳ ảo',
    ],
    correctIndex: 1,
    explanation: 'Thần thoại chủ yếu giải thích nguồn gốc vũ trụ và con người; truyền thuyết gắn với nhân vật lịch sử.',
  },
];

// ─── Quiz: Vật lý Điện từ – Chương 1 (Từ trường) ─────────────────────────────
export const QUIZ_LY_C1: QuizQuestion[] = [
  {
    id: 'lc1q1',
    text: 'Nam châm tự nhiên có bao nhiêu cực từ?',
    options: ['1 cực', '2 cực', '3 cực', '4 cực'],
    correctIndex: 1,
    explanation: 'Nam châm luôn có 2 cực: cực Bắc (N) và cực Nam (S).',
  },
  {
    id: 'lc1q2',
    text: 'Đơn vị đo cường độ dòng điện là?',
    options: ['Vôn (V)', 'Ôm (Ω)', 'Ampe (A)', 'Oát (W)'],
    correctIndex: 2,
    explanation: 'Cường độ dòng điện đo bằng Ampe (A), dụng cụ là ampe kế.',
  },
  {
    id: 'lc1q3',
    text: 'Theo định luật Ôm, cường độ dòng điện I được tính bằng?',
    options: ['I = U × R', 'I = U / R', 'I = R / U', 'I = U + R'],
    correctIndex: 1,
    explanation: 'I = U/R  (U: hiệu điện thế tính bằng V, R: điện trở tính bằng Ω).',
  },
  {
    id: 'lc1q4',
    text: 'Từ trường tồn tại ở đâu?',
    options: [
      'Chỉ gần nam châm',
      'Chỉ gần dây dẫn có dòng điện',
      'Xung quanh nam châm và dây dẫn mang dòng điện',
      'Chỉ trong chân không',
    ],
    correctIndex: 2,
    explanation: 'Từ trường tồn tại xung quanh nam châm và xung quanh dây dẫn mang dòng điện.',
  },
  {
    id: 'lc1q5',
    text: 'Quy tắc bàn tay trái dùng để xác định điều gì?',
    options: [
      'Chiều dòng điện cảm ứng',
      'Chiều lực từ tác dụng lên dây dẫn mang dòng điện trong từ trường',
      'Cực của nam châm điện',
      'Chiều đường sức từ',
    ],
    correctIndex: 1,
    explanation: 'Quy tắc bàn tay trái xác định chiều lực từ (lực Lorentz) tác dụng lên dây dẫn có dòng điện.',
  },
];

// ─── Quiz chung cho các khóa chưa mua (demo) ─────────────────────────────────
const QUIZ_DEMO: QuizQuestion[] = [
  {
    id: 'dq1',
    text: 'Phương pháp học tập nào giúp ghi nhớ lâu dài nhất?',
    options: [
      'Đọc đi đọc lại nhiều lần',
      'Ôn tập có khoảng cách (spaced repetition)',
      'Học liên tục không nghỉ',
      'Chép lại toàn bộ vào vở',
    ],
    correctIndex: 1,
    explanation: 'Ôn tập có khoảng cách (spaced repetition) là kỹ thuật được khoa học chứng minh hiệu quả nhất.',
  },
  {
    id: 'dq2',
    text: 'Khi gặp bài tập khó, chiến lược tốt nhất là?',
    options: [
      'Bỏ qua và làm bài khác',
      'Xem đáp án ngay lập tức',
      'Thử nhiều cách rồi mới tham khảo gợi ý',
      'Nhờ người khác làm hộ',
    ],
    correctIndex: 2,
    explanation: 'Tự suy nghĩ nhiều cách trước khi xem gợi ý giúp phát triển tư duy giải quyết vấn đề.',
  },
  {
    id: 'dq3',
    text: 'Thời gian học tập hiệu quả nhất trong ngày thường là?',
    options: [
      'Ngay sau bữa ăn no',
      'Buổi sáng và đầu buổi chiều khi tỉnh táo',
      'Nửa đêm khi yên tĩnh',
      'Bất kỳ lúc nào cũng như nhau',
    ],
    correctIndex: 1,
    explanation: 'Não bộ hoạt động tốt nhất vào buổi sáng và đầu chiều — lúc tỉnh táo và năng lượng cao.',
  },
  {
    id: 'dq4',
    text: 'Bee Academy phục vụ chủ yếu học sinh ở cấp học nào?',
    options: ['Tiểu học (lớp 1–5)', 'THCS (lớp 6–9)', 'THPT (lớp 10–12)', 'Đại học'],
    correctIndex: 1,
    explanation: 'Bee Academy chuyên cung cấp khóa học cho học sinh Trung học cơ sở lớp 6 đến lớp 9.',
  },
  {
    id: 'dq5',
    text: 'Sau khi mua khóa học trên Bee Academy, bạn có thể học trong bao lâu?',
    options: ['1 tháng', '1 năm', 'Trọn đời', '3 tháng'],
    correctIndex: 2,
    explanation: 'Bee Academy cung cấp quyền truy cập trọn đời sau khi mua — học bất cứ lúc nào.',
  },
];

// ─── Bài học theo khóa ────────────────────────────────────────────────────────

const LESSONS_TOAN: Lesson[] = [
  { id: 'c1-v1', title: 'Chương 1: Giới thiệu hằng đẳng thức đáng nhớ', duration: '12:45', type: 'video', url: '#', isCompleted: true },
  { id: 'c1-v2', title: 'Bài tập áp dụng hằng đẳng thức', duration: '18:20', type: 'video', url: '#', isCompleted: true },
  { id: 'c1-p1', title: 'Tài liệu lý thuyết Chương 1', duration: 'PDF', type: 'pdf', url: '#', isCompleted: true },
  { id: 'c1-q1', title: 'Kiểm tra Chương 1: Hằng đẳng thức', duration: '5 câu', type: 'quiz', url: '#', isCompleted: false, questions: QUIZ_TOAN_C1 },
  { id: 'c1-v3', title: 'Chương 2: Phương trình bậc nhất một ẩn', duration: '25:10', type: 'video', url: '#', isCompleted: false },
  { id: 'c1-v4', title: 'Bài tập phương trình và bất phương trình', duration: '30:00', type: 'video', url: '#', isCompleted: false },
  { id: 'c1-p2', title: 'Tài liệu ôn tập Chương 2', duration: 'PDF', type: 'pdf', url: '#', isCompleted: false },
  { id: 'c1-q2', title: 'Kiểm tra Chương 2: Phương trình', duration: '5 câu', type: 'quiz', url: '#', isCompleted: false, questions: QUIZ_TOAN_C2 },
];

const LESSONS_VAN: Lesson[] = [
  { id: 'c2-v1', title: 'Chương 1: Tổng quan văn học dân gian Việt Nam', duration: '15:00', type: 'video', url: '#', isCompleted: true },
  { id: 'c2-v2', title: 'Phân tích truyền thuyết "Con Rồng cháu Tiên"', duration: '20:30', type: 'video', url: '#', isCompleted: false },
  { id: 'c2-p1', title: 'Tài liệu: Phân loại thể loại dân gian', duration: 'PDF', type: 'pdf', url: '#', isCompleted: false },
  { id: 'c2-q1', title: 'Kiểm tra Chương 1: Văn học dân gian', duration: '5 câu', type: 'quiz', url: '#', isCompleted: false, questions: QUIZ_VAN_C1 },
  { id: 'c2-v3', title: 'Chương 2: Ca dao – Tục ngữ trong đời sống', duration: '22:00', type: 'video', url: '#', isCompleted: false },
  { id: 'c2-p2', title: 'Tổng hợp ca dao, tục ngữ tiêu biểu', duration: 'PDF', type: 'pdf', url: '#', isCompleted: false },
];

const LESSONS_LY: Lesson[] = [
  { id: 'c3-v1', title: 'Chương 1: Nam châm và từ trường', duration: '14:00', type: 'video', url: '#', isCompleted: true },
  { id: 'c3-v2', title: 'Tương tác từ và đường sức từ', duration: '19:45', type: 'video', url: '#', isCompleted: true },
  { id: 'c3-p1', title: 'Tài liệu lý thuyết Chương 1', duration: 'PDF', type: 'pdf', url: '#', isCompleted: true },
  { id: 'c3-q1', title: 'Kiểm tra Chương 1: Từ trường', duration: '5 câu', type: 'quiz', url: '#', isCompleted: false, questions: QUIZ_LY_C1 },
  { id: 'c3-v3', title: 'Chương 2: Dòng điện – Định luật Ôm', duration: '28:15', type: 'video', url: '#', isCompleted: true },
  { id: 'c3-v4', title: 'Bài tập mạch điện thực hành', duration: '35:00', type: 'video', url: '#', isCompleted: false },
  { id: 'c3-p2', title: 'Tài liệu ôn tập Chương 2', duration: 'PDF', type: 'pdf', url: '#', isCompleted: false },
];

const LESSONS_AVAILABLE: Lesson[] = [
  { id: 'av1', title: 'Chương 1: Giới thiệu tổng quan', duration: '12:45', type: 'video', url: '#' },
  { id: 'av2', title: 'Tài liệu lý thuyết Chương 1', duration: 'PDF', type: 'pdf', url: '#' },
  { id: 'aq1', title: 'Kiểm tra thử Chương 1', duration: '5 câu', type: 'quiz', url: '#', questions: QUIZ_DEMO },
  { id: 'av3', title: 'Chương 2: Bài tập cơ bản', duration: '25:10', type: 'video', url: '#' },
  { id: 'ap2', title: 'Tài liệu ôn tập tổng hợp', duration: 'PDF', type: 'pdf', url: '#' },
];

// ─── Danh sách khóa học ───────────────────────────────────────────────────────

export const MOCK_COURSES: Course[] = [
  {
    id: 'c1',
    title: 'Toán Đại Số Nâng Cao',
    description: 'Nắm vững các hằng đẳng thức và phương trình bậc nhất.',
    detailedDescription: 'Khóa học Toán Đại Số Nâng Cao cung cấp kiến thức nền tảng vững chắc và các phương pháp giải quyết vấn đề phức tạp. Học viên sẽ được tiếp cận với hàng trăm bài tập từ cơ bản đến nâng cao.',
    price: '499.000đ',
    subject: 'Toán',
    grade: 'Lớp 8',
    image: 'https://images.unsplash.com/photo-1632516643720-e7f5d7d6eca9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    rating: 4.8,
    students: 1250,
    instructor: 'Thầy Nguyễn Minh',
    isEnrolled: true,
    progress: 65,
    lessons: LESSONS_TOAN,
  },
  {
    id: 'c2',
    title: 'Văn Học Dân Gian Việt Nam',
    description: 'Khám phá ca dao, tục ngữ và truyền thuyết lịch sử.',
    detailedDescription: 'Hòa mình vào thế giới của Văn Học Dân Gian Việt Nam. Bạn sẽ hiểu sâu hơn về cội nguồn văn hóa dân tộc thông qua các tác phẩm kinh điển.',
    price: '350.000đ',
    subject: 'Văn',
    grade: 'Lớp 6',
    image: 'https://images.unsplash.com/photo-1544928147-79a2dbc1f389?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    rating: 4.9,
    students: 3200,
    instructor: 'Cô Trần Lan',
    isEnrolled: true,
    progress: 30,
    lessons: LESSONS_VAN,
  },
  {
    id: 'c3',
    title: 'Vật Lý Khám Phá Điện Từ',
    description: 'Thực hành ảo với nam châm và dòng điện.',
    detailedDescription: 'Một khóa học Vật Lý đầy thực tế, ứng dụng cao. Học viên sẽ được hướng dẫn thực hành ảo mô phỏng các hiện tượng vật lý thú vị về Điện và Từ trường.',
    price: '550.000đ',
    subject: 'Lý',
    grade: 'Lớp 9',
    image: 'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    rating: 4.7,
    students: 850,
    instructor: 'Thầy Lê Cường',
    isEnrolled: true,
    progress: 85,
    lessons: LESSONS_LY,
  },
  {
    id: 'c4',
    title: 'Toán Hình Học Không Gian',
    description: 'Làm quen với hình chóp, hình lăng trụ và tính thể tích.',
    detailedDescription: 'Hình học không gian không còn là nỗi sợ với các công cụ hình ảnh 3D trực quan. Giúp bạn đạt điểm tuyệt đối bài kiểm tra.',
    price: '450.000đ',
    subject: 'Toán',
    grade: 'Lớp 9',
    image: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    rating: 4.6,
    students: 2100,
    instructor: 'Cô Phạm Mai',
    isEnrolled: false,
    lessons: LESSONS_AVAILABLE,
  },
  {
    id: 'c5',
    title: 'Hóa Học Cơ Bản: Phản Ứng Oxi Hóa',
    description: 'Cân bằng phương trình hóa học cơ bản nhất.',
    detailedDescription: 'Khóa học giúp bạn vượt qua nỗi sợ hóa học. Học cách cân bằng phương trình siêu tốc bằng những mẹo mà sách giáo khoa không dạy.',
    price: '400.000đ',
    subject: 'Hóa',
    grade: 'Lớp 8',
    image: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    rating: 4.8,
    students: 1800,
    instructor: 'Thầy Bùi Hoàng',
    isEnrolled: false,
    lessons: LESSONS_AVAILABLE,
  },
  {
    id: 'c6',
    title: 'Lịch Sử Việt Nam: Kháng Chiến Chống Pháp',
    description: 'Tìm hiểu về cuộc đấu tranh giành độc lập hào hùng.',
    detailedDescription: 'Tái hiện lại những trang sử hào hùng của dân tộc qua góc nhìn đa chiều, sử dụng tư liệu thực tế và sơ đồ tư duy sinh động.',
    price: '299.000đ',
    subject: 'Sử',
    grade: 'Lớp 9',
    image: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    rating: 4.9,
    students: 4500,
    instructor: 'Thầy Nguyễn Lịch',
    isEnrolled: false,
    lessons: LESSONS_AVAILABLE,
  },
  {
    id: 'c7',
    title: 'Địa Lý: Khí Hậu Các Vùng Miền',
    description: 'Tổng quan về đặc điểm tự nhiên của đất nước.',
    detailedDescription: 'Hiểu rõ sự khác biệt thú vị về khí hậu giữa 3 miền Bắc – Trung – Nam, qua đó giải thích được nhiều hiện tượng thiên nhiên.',
    price: '250.000đ',
    subject: 'Địa',
    grade: 'Lớp 8',
    image: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    rating: 4.5,
    students: 900,
    instructor: 'Cô Lê Hằng',
    isEnrolled: false,
    lessons: LESSONS_AVAILABLE,
  },
  {
    id: 'c8',
    title: 'Vật Lý 7: Ánh Sáng Và Âm Thanh',
    description: 'Khám phá các hiện tượng vật lý trong đời sống.',
    detailedDescription: 'Âm thanh và ánh sáng truyền đi như thế nào? Cùng khám phá với những ví dụ sinh động ngay tại nhà bạn.',
    price: '320.000đ',
    subject: 'Lý',
    grade: 'Lớp 7',
    image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    rating: 4.7,
    students: 1300,
    instructor: 'Thầy Đặng Khôi',
    isEnrolled: false,
    lessons: LESSONS_AVAILABLE,
  },
  {
    id: 'c9',
    title: 'Toán Học Cơ Bản: Phân Số',
    description: 'Củng cố kiến thức nền tảng toán học lớp 6.',
    detailedDescription: 'Mất gốc môn toán? Khóa học này dành cho bạn. Xây dựng lại tư duy học toán từ những phép tính phân số cơ bản nhất.',
    price: '199.000đ',
    subject: 'Toán',
    grade: 'Lớp 6',
    image: 'https://images.unsplash.com/photo-1632516643720-e7f5d7d6eca9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    rating: 4.8,
    students: 2600,
    instructor: 'Cô Thanh Nhàn',
    isEnrolled: false,
    lessons: LESSONS_AVAILABLE,
  },
];

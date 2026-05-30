import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, Award, Clock, User, ChevronDown, BookOpen, 
  Star, FileText, CheckCircle, Percent, ArrowLeft, BarChart2, AlertCircle
} from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import PageBanner from '../../components/PageBanner';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';

// ---------------------------------------------------------------------------
//  Mock dữ liệu phân tích học tập chi tiết của từng học sinh
// ---------------------------------------------------------------------------
interface SubjectProgress {
  name: string;
  grade: string;
  progress: number;
  avgScore: number;
  completedQuizzes: number;
  totalQuizzes: number;
}

interface GradeRecord {
  id: string;
  date: string;
  examName: string;
  subject: string;
  score: number;
  type: 'quiz' | 'exam' | 'assignment';
  remarks: string;
}

const MOCK_CHILDREN_PROGRESS: Record<string, { subjects: SubjectProgress[], grades: GradeRecord[] }> = {
  'BEE123': {
    subjects: [
      { name: 'Toán Đại Số Nâng Cao', grade: 'Lớp 8', progress: 65, avgScore: 8.5, completedQuizzes: 2, totalQuizzes: 4 },
      { name: 'Vật Lý Khám Phá Điện Từ', grade: 'Lớp 8', progress: 85, avgScore: 8.0, completedQuizzes: 3, totalQuizzes: 3 },
      { name: 'Văn Học Dân Gian Việt Nam', grade: 'Lớp 8', progress: 100, avgScore: 9.0, completedQuizzes: 2, totalQuizzes: 2 }
    ],
    grades: [
      { id: 'g1', date: '25/05/2026', examName: 'Kiểm tra Chương 1: Hằng đẳng thức', subject: 'Toán học', score: 9.0, type: 'quiz', remarks: 'Làm bài xuất sắc, nắm chắc công thức.' },
      { id: 'g2', date: '20/05/2026', examName: 'Kiểm tra giữa kỳ: Thực hành mạch điện', subject: 'Vật lý', score: 8.0, type: 'exam', remarks: 'Hiểu nguyên lý mạch điện, làm tốt.' },
      { id: 'g3', date: '15/05/2026', examName: 'Bài kiểm tra Văn học dân gian Việt Nam', subject: 'Ngữ văn', score: 9.0, type: 'exam', remarks: 'Phân tích văn học sâu sắc, chữ viết đẹp.' },
      { id: 'g4', date: '10/05/2026', examName: 'Quiz thử thách: Định luật Ôm', subject: 'Vật lý', score: 8.5, type: 'quiz', remarks: 'Nắm được các công thức tính toán dòng điện.' }
    ]
  },
  'BEE456': {
    subjects: [
      { name: 'Văn Học Dân Gian Việt Nam', grade: 'Lớp 6', progress: 45, avgScore: 7.2, completedQuizzes: 1, totalQuizzes: 3 }
    ],
    grades: [
      { id: 'g5', date: '22/05/2026', examName: 'Kiểm tra Chương 1: Truyền thuyết dân gian', subject: 'Ngữ văn', score: 7.0, type: 'quiz', remarks: 'Hiểu bài, cần cải thiện phần biểu cảm.' },
      { id: 'g6', date: '18/05/2026', examName: 'Bài tập ngắn tự luận: Con Rồng cháu Tiên', subject: 'Ngữ văn', score: 7.5, type: 'assignment', remarks: 'Bài viết đầy đủ ý, cần trình bày sạch đẹp hơn.' }
    ]
  }
};

export default function ParentProgress() {
  const { linkedStudents, fetchLinkedStudents } = useAuthStore();
  
  // Học sinh tích cực
  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => {
    return localStorage.getItem('parent_active_student_id') || linkedStudents[0]?.id || '';
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Tải danh sách con cái từ API thật khi component mount
  useEffect(() => {
    fetchLinkedStudents();
  }, [fetchLinkedStudents]);

  useEffect(() => {
    if (linkedStudents.length > 0) {
      const isValid = linkedStudents.some(s => s.id === selectedStudentId);
      if (!isValid) {
        setSelectedStudentId(linkedStudents[0].id);
        localStorage.setItem('parent_active_student_id', linkedStudents[0].id);
      }
    } else {
      setSelectedStudentId('');
    }
  }, [linkedStudents, selectedStudentId]);

  const activeStudent = linkedStudents.find(s => s.id === selectedStudentId);

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    localStorage.setItem('parent_active_student_id', studentId);
    setDropdownOpen(false);
    notify.success(`Đã chuyển sang xem tiến độ của ${linkedStudents.find(s => s.id === studentId)?.name}`);
  };

  if (linkedStudents.length === 0) {
    return (
      <div className="min-h-screen bg-surface flex flex-col font-sans">
        <DashboardHeader />
        <PageBanner title="Tiến độ & Điểm số" subtitle="Phân tích chi tiết kết quả học tập" />
        <div className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-10 py-12 text-center">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-10 max-w-xl mx-auto shadow-sm">
            <AlertCircle className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-extrabold text-on-surface">Chưa liên kết tài khoản con</h3>
            <p className="text-xs text-on-surface-variant mt-2 mb-6">Liên kết tài khoản con để xem kết quả học tập.</p>
          </div>
        </div>
      </div>
    );
  }

  // Lấy dữ liệu học sinh hiện tại
  const progressData = activeStudent ? (MOCK_CHILDREN_PROGRESS[activeStudent.code] || { subjects: [], grades: [] }) : { subjects: [], grades: [] };
  
  // Tính điểm trung bình tích lũy (GPA)
  const gpa = progressData.grades.length > 0
    ? (progressData.grades.reduce((sum, g) => sum + g.score, 0) / progressData.grades.length).toFixed(1)
    : '—';

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <DashboardHeader />
      
      {/* Page Banner */}
      <div className="relative">
        <PageBanner 
          title="Tiến độ & Điểm số" 
          subtitle="Thống kê học tập chi tiết, bảng điểm và biểu đồ xu hướng học tập của con" 
        />
        
        {/* Child selector */}
        <div className="absolute bottom-4 right-4 md:right-10 z-10">
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 bg-surface-container-lowest px-4 py-2.5 rounded-xl border border-outline-variant/30 shadow-md font-bold text-sm text-on-surface hover:bg-surface-container-low transition-colors"
            >
              <User className="w-4 h-4 text-primary" />
              <span>Con: {activeStudent?.name}</span>
              <ChevronDown className="w-4 h-4 text-on-surface-variant" />
            </button>
            
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-xl z-20 py-2">
                {linkedStudents.map(student => (
                  <button
                    key={student.id}
                    onClick={() => handleSelectStudent(student.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-surface-container-low ${
                      student.id === selectedStudentId ? 'bg-primary/5 text-primary font-bold' : 'text-on-surface'
                    }`}
                  >
                    <img 
                      src={student.avatar} 
                      alt={student.name} 
                      className="w-7 h-7 rounded-full object-cover border border-outline-variant/20"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-xs leading-none">{student.name}</p>
                      <p className="text-[10px] text-on-surface-variant mt-1">{student.grade}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-10 py-8">
        {activeStudent && (
          <div className="space-y-8">
            
            {/* Header Tổng hợp Năng lực */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Thẻ GPA */}
              <div className="bg-gradient-to-br from-primary to-primary-container p-6 rounded-3xl text-on-primary shadow-lg flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider opacity-70">Điểm trung bình (GPA)</p>
                  <p className="text-4xl font-extrabold mt-1">{gpa}/10</p>
                  <p className="text-xs mt-2 font-medium opacity-90">Dựa trên {progressData.grades.length} cột điểm gần nhất</p>
                </div>
                <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <Award className="w-8 h-8 text-white" />
                </div>
              </div>

              {/* Thẻ Số bài kiểm tra hoàn thành */}
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Bài kiểm tra đã nộp</p>
                  <p className="text-3xl font-extrabold text-on-surface mt-1">
                    {progressData.subjects.reduce((sum, s) => sum + s.completedQuizzes, 0)}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-2 font-medium">
                    Tổng số Quiz được giao: {progressData.subjects.reduce((sum, s) => sum + s.totalQuizzes, 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-teal-500/10 text-teal-600 rounded-2xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6" />
                </div>
              </div>

              {/* Thẻ Thống kê môn học tốt nhất */}
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Môn học xuất sắc nhất</p>
                  <p className="text-xl font-extrabold text-on-surface mt-2 leading-tight">
                    {progressData.subjects.length > 0 
                      ? progressData.subjects.reduce((max, s) => s.avgScore > max.avgScore ? s : max, progressData.subjects[0]).name
                      : 'Chưa thống kê'}
                  </p>
                  <p className="text-xs text-primary mt-2 font-extrabold flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-primary" />
                    Điểm trung bình cao vượt trội
                  </p>
                </div>
                <div className="w-12 h-12 bg-secondary-container/20 text-on-secondary-container rounded-2xl flex items-center justify-center">
                  <Star className="w-6 h-6 text-secondary fill-secondary" />
                </div>
              </div>

            </div>

            {/* Layout 2 cột: Báo cáo Tiến độ Môn học & Nhật ký Bảng điểm */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              
              {/* Cột trái 2/5: Báo cáo chi tiết theo từng môn học */}
              <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm flex flex-col space-y-6">
                <div>
                  <h3 className="font-extrabold text-on-surface text-base">Tiến độ theo môn học</h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">Tiến độ bài học và điểm số trung bình của con</p>
                </div>

                <div className="space-y-5 flex-grow">
                  {progressData.subjects.map((subject, idx) => (
                    <div key={idx} className="space-y-2 p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-extrabold text-on-surface">{subject.name}</span>
                        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                          GPA: {subject.avgScore}/10
                        </span>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] text-on-surface-variant font-semibold">
                          <span>Tiến độ chương trình</span>
                          <span>{subject.progress}%</span>
                        </div>
                        <div className="w-full bg-surface-container-high rounded-full h-1.5">
                          <div 
                            className="bg-primary h-1.5 rounded-full transition-all duration-500" 
                            style={{ width: `${subject.progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Quizzes info */}
                      <div className="flex justify-between items-center text-[10px] text-on-surface-variant pt-1">
                        <span>Đã làm: <span className="font-bold text-on-surface">{subject.completedQuizzes}</span>/{subject.totalQuizzes} quiz</span>
                        <span>Lớp học: {subject.grade}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cột phải 3/5: Bảng điểm & nhận xét chi tiết */}
              <div className="lg:col-span-3 bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm flex flex-col">
                <div className="mb-6">
                  <h3 className="font-extrabold text-on-surface text-base">Bảng điểm các bài kiểm tra</h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">Nhật ký kết quả thi trắc nghiệm và bài tự luận</p>
                </div>

                <div className="flex-grow overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant/20 bg-surface-container-low/50 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                        <th className="px-4 py-3">Ngày</th>
                        <th className="px-4 py-3">Tên bài làm</th>
                        <th className="px-4 py-3">Môn học</th>
                        <th className="px-4 py-3 text-center">Điểm số</th>
                        <th className="px-4 py-3">Giáo viên nhận xét</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                      {progressData.grades.map(grade => (
                        <tr key={grade.id} className="hover:bg-surface-container-low/20 transition-colors">
                          <td className="px-4 py-3.5 text-xs text-on-surface-variant font-medium whitespace-nowrap">
                            {grade.date}
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-xs text-on-surface max-w-[200px] truncate" title={grade.examName}>
                            {grade.examName}
                          </td>
                          <td className="px-4 py-3.5 text-xs">
                            <span className="inline-block px-2 py-0.5 bg-secondary-container/20 text-on-secondary-container rounded-md font-bold">
                              {grade.subject}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center font-extrabold text-xs">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold ${
                              grade.score >= 8.5 
                                ? 'bg-green-500/10 text-green-600' 
                                : grade.score >= 7.0 
                                  ? 'bg-blue-500/10 text-blue-600' 
                                  : 'bg-primary/10 text-primary'
                            }`}>
                              {grade.score.toFixed(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-on-surface-variant max-w-[220px] truncate" title={grade.remarks}>
                            {grade.remarks}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </div>
        )}
      </div>
    </div>
  );
}

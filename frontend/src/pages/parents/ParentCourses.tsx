import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  BookOpen, ChevronDown, ChevronUp, CheckCircle, Clock, 
  User, PlayCircle, FileText, CheckCircle2, Award, Calendar, AlertCircle
} from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import PageBanner from '../../components/PageBanner';
import { useAuthStore } from '../../store/useAuthStore';
import { MOCK_COURSES } from '../../data/mockCourses';
import { notify } from '../../lib/toast';

// ---------------------------------------------------------------------------
//  Cấu hình danh sách khóa học cụ thể của từng con (mock matching)
// ---------------------------------------------------------------------------
const MOCK_CHILDREN_COURSES: Record<string, Array<{ id: string; progress: number; enrollDate: string }>> = {
  'BEE123': [
    { id: 'c1', progress: 65, enrollDate: '12/03/2026' },
    { id: 'c3', progress: 85, enrollDate: '20/03/2026' },
    { id: 'c2', progress: 100, enrollDate: '01/02/2026' }
  ],
  'BEE456': [
    { id: 'c2', progress: 45, enrollDate: '05/04/2026' }
  ]
};

export default function ParentCourses() {
  const { linkedStudents, fetchLinkedStudents } = useAuthStore();
  
  // Lấy học sinh tích cực từ localStorage hoặc mặc định
  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => {
    return localStorage.getItem('parent_active_student_id') || linkedStudents[0]?.id || '';
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);

  // Tải danh sách con cái từ API thật khi component mount
  useEffect(() => {
    fetchLinkedStudents();
  }, [fetchLinkedStudents]);

  // Đồng bộ student ID khi danh sách linkedStudents thay đổi và đồng bộ an toàn nếu bị gỡ liên kết
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

  // Tìm học sinh hiện tại
  const activeStudent = linkedStudents.find(s => s.id === selectedStudentId);

  // Cập nhật localStorage khi đổi học sinh
  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    localStorage.setItem('parent_active_student_id', studentId);
    setExpandedCourseId(null);
    setDropdownOpen(false);
    notify.success(`Đã chuyển sang xem khóa học của ${linkedStudents.find(s => s.id === studentId)?.name}`);
  };

  if (linkedStudents.length === 0) {
    return (
      <div className="min-h-screen bg-surface flex flex-col font-sans">
        <DashboardHeader />
        <PageBanner title="Khóa học của con" subtitle="Theo dõi tiến độ học tập chi tiết" />
        <div className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-10 py-12 text-center">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-10 max-w-xl mx-auto shadow-sm">
            <AlertCircle className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-extrabold text-on-surface">Chưa liên kết tài khoản con</h3>
            <p className="text-xs text-on-surface-variant mt-2 mb-6">Liên kết tài khoản con để xem danh sách khóa học.</p>
          </div>
        </div>
      </div>
    );
  }

  // Lấy danh sách khóa học của học sinh hiện tại
  const childCoursesMeta = activeStudent ? (MOCK_CHILDREN_COURSES[activeStudent.code] || []) : [];
  
  // Kết hợp thông tin tĩnh từ MOCK_COURSES và tiến độ động của học sinh đó
  const activeStudentCourses = childCoursesMeta.map(meta => {
    const courseStatic = MOCK_COURSES.find(c => c.id === meta.id);
    return {
      ...courseStatic,
      progress: meta.progress,
      enrollDate: meta.enrollDate,
    };
  }).filter(c => c.id) as Array<any>;

  const handleToggleExpand = (courseId: string) => {
    setExpandedCourseId(expandedCourseId === courseId ? null : courseId);
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <DashboardHeader />
      
      {/* Banner với Dropdown đổi con */}
      <div className="relative">
        <PageBanner 
          title="Khóa học của con" 
          subtitle="Danh sách bài giảng và trạng thái hoàn thành các môn học của con" 
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

      {/* Main Content */}
      <div className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-10 py-8">
        {activeStudent && (
          <div className="space-y-6">
            
            {/* Header số lượng khóa học */}
            <div className="flex justify-between items-center border-b border-outline-variant/20 pb-4">
              <h2 className="text-lg font-extrabold text-on-surface flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                Khóa học đã đăng ký ({activeStudentCourses.length})
              </h2>
              <span className="text-xs text-on-surface-variant font-medium">
                Tài khoản: <span className="font-bold text-on-surface">{activeStudent.name}</span>
              </span>
            </div>

            {/* Grid/List các khóa học */}
            {activeStudentCourses.length === 0 ? (
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-12 text-center">
                <p className="text-sm text-on-surface-variant">Con chưa đăng ký khóa học nào trên hệ thống.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeStudentCourses.map(course => {
                  const isExpanded = expandedCourseId === course.id;
                  
                  // Đếm số bài học đã hoàn thành giả định dựa trên tiến độ học
                  const totalLessonsCount = course.lessons?.length || 0;
                  const completedCount = Math.round((course.progress / 100) * totalLessonsCount);

                  return (
                    <motion.div 
                      key={course.id}
                      layout
                      className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                    >
                      {/* Tiêu đề Khóa học */}
                      <div 
                        onClick={() => handleToggleExpand(course.id)}
                        className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer select-none hover:bg-surface-container-low/20 transition-colors"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          {/* Ảnh đại diện khóa học */}
                          <img 
                            src={course.image} 
                            alt={course.title} 
                            className="w-16 h-16 rounded-2xl object-cover border border-outline-variant/20 flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="inline-block px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-extrabold rounded-md uppercase tracking-wider mb-1">
                              {course.subject} - {course.grade}
                            </span>
                            <h3 className="font-extrabold text-on-surface text-sm md:text-base truncate leading-tight">
                              {course.title}
                            </h3>
                            <p className="text-xs text-on-surface-variant mt-1">
                              Giảng viên: <span className="font-semibold text-on-surface">{course.instructor}</span> | Đăng ký: {course.enrollDate}
                            </p>
                          </div>
                        </div>

                        {/* Thanh Tiến độ & Action */}
                        <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end flex-shrink-0">
                          {/* Progress */}
                          <div className="w-48 text-right">
                            <div className="flex justify-between items-center text-xs mb-1.5 font-bold">
                              <span className="text-on-surface-variant">Tiến độ:</span>
                              <span className={course.progress === 100 ? 'text-green-600 font-extrabold' : 'text-primary'}>
                                {course.progress}%
                              </span>
                            </div>
                            <div className="w-full bg-surface-container rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full transition-all duration-500 ${
                                  course.progress === 100 ? 'bg-green-500' : 'bg-primary'
                                }`}
                                style={{ width: `${course.progress}%` }}
                              />
                            </div>
                          </div>

                          {/* Expand Button */}
                          <div className="p-2 bg-surface-container rounded-xl text-on-surface-variant hover:text-on-surface">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>
                      </div>

                      {/* Chi tiết danh sách bài giảng (Khi expand) */}
                      {isExpanded && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="border-t border-outline-variant/20 bg-surface-container-low/30 px-6 py-5 space-y-4"
                        >
                          <div className="flex justify-between items-center border-b border-outline-variant/10 pb-2">
                            <span className="text-xs font-bold text-on-surface">
                              Danh sách bài giảng & bài kiểm tra
                            </span>
                            <span className="text-xs text-on-surface-variant font-medium">
                              Đã học: <span className="font-bold text-on-surface">{completedCount}</span> / {totalLessonsCount} mục
                            </span>
                          </div>

                          {/* Danh sách bài học */}
                          <div className="space-y-2">
                            {course.lessons && course.lessons.map((lesson: any, index: number) => {
                              // Giả định bài học đã hoàn thành dựa trên chỉ mục của nó
                              const isLessonCompleted = index < completedCount;

                              return (
                                <div 
                                  key={lesson.id}
                                  className="flex items-center justify-between p-3.5 bg-surface-container-lowest border border-outline-variant/10 rounded-2xl"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    {/* Icon loại bài học */}
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                      isLessonCompleted ? 'bg-green-500/10 text-green-600' : 'bg-surface-container text-on-surface-variant'
                                    }`}>
                                      {lesson.type === 'video' && <PlayCircle className="w-4 h-4" />}
                                      {lesson.type === 'pdf' && <FileText className="w-4 h-4" />}
                                      {lesson.type === 'quiz' && <Award className="w-4 h-4" />}
                                    </div>
                                    <div className="min-w-0">
                                      <p className={`text-xs md:text-sm font-semibold truncate ${
                                        isLessonCompleted ? 'text-on-surface' : 'text-on-surface-variant'
                                      }`}>
                                        {lesson.title}
                                      </p>
                                      <p className="text-[10px] text-on-surface-variant mt-0.5">
                                        Loại: {lesson.type === 'video' ? 'Video bài giảng' : lesson.type === 'pdf' ? 'Tài liệu lý thuyết' : 'Bài trắc nghiệm'} | Lượng: {lesson.duration}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Trạng thái hoàn thành */}
                                  <div className="flex-shrink-0 ml-4">
                                    {isLessonCompleted ? (
                                      <span className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-600 text-[10px] font-extrabold rounded-full">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Đã hoàn thành
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-1.5 px-3 py-1 bg-surface-container text-on-surface-variant/60 text-[10px] font-bold rounded-full">
                                        <Clock className="w-3.5 h-3.5" />
                                        Chưa học
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

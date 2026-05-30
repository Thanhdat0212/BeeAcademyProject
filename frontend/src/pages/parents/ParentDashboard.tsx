import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  BarChart2, BookOpen, Calendar, ChevronDown, FileDown, 
  Clock, User, MessageSquare, Star, Award, AlertCircle, ArrowRight, Loader2
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardHeader from '../../components/DashboardHeader';
import PageBanner from '../../components/PageBanner';
import { useAuthStore, LinkedStudent } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import * as parentService from '../../api/parentService';
import type { ChildOverviewResponse } from '../../types/api';

// ---------------------------------------------------------------------------
//  Nhận xét mẫu từ giáo viên dựa theo mã học sinh
// ---------------------------------------------------------------------------
const MOCK_TEACHER_REMARKS: Record<string, Array<{ id: string; teacher: string; subject: string; content: string; date: string; avatar: string }>> = {
  'Nguyễn Minh Anh': [
    {
      id: 'r1',
      teacher: 'Cô Nguyễn Thị Mai',
      subject: 'Toán học - Lớp 8',
      content: 'Minh Anh làm bài tập tự luận chương 1 rất tốt, trình bày khoa học và đạt điểm tối đa. Cần phát huy tinh thần tự học này.',
      date: 'Hôm nay, 08:30',
      avatar: 'https://ui-avatars.com/api/?name=Nguyen+Mai&background=ad2c00&color=fff&bold=true'
    },
    {
      id: 'r2',
      teacher: 'Thầy Lê Cường',
      subject: 'Vật lý - Lớp 8',
      content: 'Cháu tham gia làm các bài kiểm tra thực hành ảo đầy đủ, tuy nhiên điểm phần Từ trường hơi thấp (6.5), cháu nên ôn tập lại phần lý thuyết chương này.',
      date: 'Hôm qua, 15:40',
      avatar: 'https://ui-avatars.com/api/?name=Le+Cuong&background=7c5800&color=fff&bold=true'
    }
  ],
  'Nguyễn Quốc Bảo': [
    {
      id: 'r3',
      teacher: 'Cô Trần Lan',
      subject: 'Ngữ văn - Lớp 6',
      content: 'Quốc Bảo có sự tiến bộ rõ rệt trong việc phân tích các bài ca dao. Cháu viết văn bay bổng và có nhiều ý tưởng sáng tạo.',
      date: '25/05/2026',
      avatar: 'https://ui-avatars.com/api/?name=Tran+Lan&background=008080&color=fff&bold=true'
    }
  ]
};

export default function ParentDashboard() {
  const navigate = useNavigate();
  const { user, linkedStudents, fetchLinkedStudents } = useAuthStore();
  
  // State quản lý học sinh được chọn hiện tại
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  // State chứa thông tin báo cáo động từ backend
  const [overview, setOverview] = useState<ChildOverviewResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState<boolean>(false);

  // Tải danh sách con cái khi mount
  useEffect(() => {
    fetchLinkedStudents();
  }, [fetchLinkedStudents]);

  // Khởi tạo học sinh được chọn đầu tiên khi danh sách thay đổi và đồng bộ nếu con đang chọn bị hủy liên kết
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

  // Tải báo cáo động của con từ backend API
  useEffect(() => {
    if (selectedStudentId) {
      const loadOverview = async () => {
        setLoadingOverview(true);
        try {
          const data = await parentService.getChildOverview(selectedStudentId);
          setOverview(data);
        } catch (error) {
          console.error('Lỗi khi tải báo cáo học tập của con:', error);
          notify.error('Không thể tải báo cáo tiến độ học tập.');
        } finally {
          setLoadingOverview(false);
        }
      };
      loadOverview();
    } else {
      setOverview(null);
    }
  }, [selectedStudentId]);

  // Tìm thông tin của học sinh đang được chọn
  const activeStudent = linkedStudents.find(s => s.id === selectedStudentId);

  // Lời chào cá nhân hóa dựa trên thời gian thực
  const getGreeting = (name: string) => {
    const hours = new Date().getHours();
    if (hours < 12) return `Chào buổi sáng, Phụ huynh! Dưới đây là tiến độ học tập hôm nay của ${name}.`;
    if (hours < 18) return `Chào buổi chiều, Phụ huynh! Dưới đây là tiến độ học tập hôm nay của ${name}.`;
    return `Chào buổi tối, Phụ huynh! Dưới đây là tiến độ học tập hôm nay của ${name}.`;
  };

  // Xuất báo cáo học tập chi tiết giả lập
  const handleExportReport = () => {
    if (!activeStudent || !overview) return;
    const toastId = notify.loading('Đang khởi tạo báo cáo...');
    
    setTimeout(() => {
      // Dữ liệu CSV
      const headers = ['Học sinh', 'Lớp', 'Tiến độ trung bình (%)', 'Khóa học đang học', 'Khóa học hoàn thành', 'Điểm Quiz mới nhất', 'Điểm thi mới nhất'];
      const data = [
        activeStudent.name,
        activeStudent.grade,
        overview.avgProgress,
        overview.activeCourses,
        overview.completedCourses,
        overview.latestQuizScore,
        overview.latestExamScore
      ];
      
      const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
        + [headers.join(','), data.join(',')].join('\n');
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Bao_Cao_Hoc_Tap_${activeStudent.name.replace(/\s+/g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      notify.dismiss(toastId);
      notify.success('Đã tải xuống báo cáo học tập chi tiết thành công!');
    }, 1500);
  };

  if (linkedStudents.length === 0) {
    return (
      <div className="min-h-screen bg-surface flex flex-col font-sans">
        <DashboardHeader />
        <PageBanner title="Tổng quan báo cáo" subtitle="Theo dõi tiến độ học tập của các con" />
        
        <div className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-10 py-12">
          <main className="max-w-2xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-10 shadow-sm"
            >
              <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-extrabold text-on-surface mb-3">Chưa liên kết tài khoản con</h2>
              <p className="text-on-surface-variant text-sm mb-8 max-w-md mx-auto leading-relaxed">
                Vui lòng liên kết tài khoản của con bạn bằng mã liên kết học sinh (ví dụ: BEE123) để theo dõi kết quả, tiến độ học tập cũng như nhận xét từ giáo viên bộ môn.
              </p>
              <button
                onClick={() => navigate('/parent/link')}
                className="px-6 py-3.5 bg-primary text-on-primary font-bold rounded-xl text-sm hover:bg-primary/95 transition-all shadow-md shadow-primary/20"
              >
                Liên kết tài khoản ngay
              </button>
            </motion.div>
          </main>
        </div>
      </div>
    );
  }

  // Lấy các nhận xét của học sinh hiện tại
  const currentRemarks = activeStudent ? (MOCK_TEACHER_REMARKS[activeStudent.name] || []) : [];

  // Trích xuất các biến số liệu học tập từ overview hoặc dùng fallback mặc định
  const avgProgress = overview?.avgProgress ?? 0;
  const activeCourses = overview?.activeCourses ?? 0;
  const completedCourses = overview?.completedCourses ?? 0;
  const latestQuizScore = overview?.latestQuizScore ?? 0;
  const latestExamScore = overview?.latestExamScore ?? 0;
  const weeklyActivity = overview?.weeklyActivityHours ?? [0, 0, 0, 0, 0, 0, 0];

  const maxWeeklyHours = Math.max(...weeklyActivity, 1);
  const daysOfWeek = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];


  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <DashboardHeader />
      
      {/* Page Banner với Dropdown đổi con */}
      <div className="relative">
        <PageBanner 
          title="Tổng quan báo cáo" 
          subtitle="Hệ thống giám sát và báo cáo học tập dành riêng cho phụ huynh" 
        />
        
        {/* Dropdown chuyển con nằm góc phải banner */}
        <div className="absolute bottom-4 right-4 md:right-10 z-10">
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 bg-surface-container-lowest px-4 py-2.5 rounded-xl border border-outline-variant/30 shadow-md font-bold text-sm text-on-surface hover:bg-surface-container-low transition-colors"
            >
              <User className="w-4 h-4 text-primary" />
              <span>Con: {activeStudent?.name} ({activeStudent?.grade})</span>
              <ChevronDown className="w-4 h-4 text-on-surface-variant" />
            </button>
            
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-xl z-20 py-2">
                <p className="px-4 py-1.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                  Chọn tài khoản học sinh:
                </p>
                {linkedStudents.map(student => (
                  <button
                    key={student.id}
                    onClick={() => {
                      setSelectedStudentId(student.id);
                      setDropdownOpen(false);
                      notify.success(`Đã chuyển sang xem báo cáo của ${student.name}`);
                    }}
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
                <div className="border-t border-outline-variant/20 mt-2 pt-2 px-2">
                  <button
                    onClick={() => navigate('/parent/link')}
                    className="w-full py-2 bg-surface-container text-primary rounded-xl font-bold text-xs hover:bg-surface-container-high transition-colors flex items-center justify-center gap-2"
                  >
                    Quản lý liên kết con
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nội dung chính */}
      <div className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-10 py-8">
        {activeStudent && (
          <div className="space-y-8">
            
            {/* Lời chào động và Nút xuất báo cáo */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-primary-fixed text-primary-fixed-dim p-6 rounded-3xl"
            >
              <div>
                <h2 className="text-xl font-extrabold text-primary leading-tight">
                  {getGreeting(activeStudent.name)}
                </h2>
                <p className="text-xs text-on-surface-variant mt-1">
                  Học sinh: {activeStudent.name} | Khối lớp: {activeStudent.grade}
                </p>
              </div>
              <button
                onClick={handleExportReport}
                className="flex items-center gap-2 px-5 py-3 bg-primary text-on-primary rounded-xl font-bold text-xs hover:bg-primary/95 transition-all shadow-md shadow-primary/20 flex-shrink-0"
              >
                <FileDown className="w-4 h-4" />
                Xuất báo cáo chi tiết
              </button>
            </motion.div>

            {/* 4 Thẻ Chỉ số chính */}
            <div className="relative">
              {loadingOverview && (
                <div className="absolute inset-0 bg-surface/50 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-3xl">
                  <div className="bg-surface-container px-4 py-3 rounded-2xl border border-outline-variant/30 flex items-center gap-2 shadow-lg">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    <span className="text-xs font-bold text-on-surface">Đang cập nhật số liệu...</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Thẻ 1: Khóa học của con */}
                <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Khóa học của con</span>
                    <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center">
                      <BookOpen className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-on-surface">
                    {activeCourses + completedCourses}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-2 font-medium">
                    Đang học: <span className="font-bold text-teal-600">{activeCourses}</span> | Đã xong: <span className="font-bold text-on-surface">{completedCourses}</span>
                  </p>
                </div>

                {/* Thẻ 2: Tiến độ học tập trung bình */}
                <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Tiến độ trung bình</span>
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                      <BarChart2 className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-on-surface">{avgProgress}%</p>
                  <div className="w-full bg-surface-container rounded-full h-1.5 mt-3">
                    <div 
                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" 
                      style={{ width: `${avgProgress}%` }}
                    />
                  </div>
                </div>

                {/* Thẻ 3: KPI Điểm Quiz mới nhất */}
                <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Điểm Quiz mới nhất</span>
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Award className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-primary">{latestQuizScore}/10</p>
                  <p className="text-[11px] text-primary/70 mt-2 font-semibold flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-primary" />
                    Học lực: Đạt yêu cầu cao
                  </p>
                </div>

                {/* Thẻ 4: KPI Điểm Kiểm tra mới nhất */}
                <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Điểm thi mới nhất</span>
                    <div className="w-10 h-10 rounded-xl bg-secondary-container/20 text-on-secondary-container flex items-center justify-center">
                      <Award className="w-5 h-5 text-secondary" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-secondary">{latestExamScore}/10</p>
                  <p className="text-[11px] text-secondary mt-2 font-semibold flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-secondary text-secondary" />
                    Học lực: Xuất sắc
                  </p>
                </div>

              </div>
            </div>

            {/* Layout 2 cột: Biểu đồ thời gian học & Nhận xét của Giáo viên */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 relative">
              {loadingOverview && (
                <div className="absolute inset-0 bg-surface/50 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-3xl">
                  <div className="bg-surface-container px-4 py-3 rounded-2xl border border-outline-variant/30 flex items-center gap-2 shadow-lg">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    <span className="text-xs font-bold text-on-surface">Đang tải biểu đồ & nhận xét...</span>
                  </div>
                </div>
              )}

              {/* Cột trái 3/5: Biểu đồ hoạt động học tập trong tuần */}
              <div className="lg:col-span-3 bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-extrabold text-on-surface text-base">Thời lượng tự học tuần này</h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">Tổng hợp giờ học hàng ngày của con trên Bee Academy</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-semibold bg-surface-container-low px-3 py-1.5 rounded-xl border border-outline-variant/10">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span>Tổng: {weeklyActivity.reduce((a, b) => a + b, 0).toFixed(1)} giờ</span>
                  </div>
                </div>

                {/* Biểu đồ cột SVG */}
                <div className="flex-1 flex items-end justify-center h-64 pt-6 relative">
                  <svg className="w-full h-full max-h-[220px]" viewBox="0 0 500 200" preserveAspectRatio="none">
                    {/* Đường phân cách ngang chỉ số giờ */}
                    <line x1="40" y1="20" x2="480" y2="20" stroke="#edeef2" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="40" y1="70" x2="480" y2="70" stroke="#edeef2" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="40" y1="120" x2="480" y2="120" stroke="#edeef2" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="40" y1="170" x2="480" y2="170" stroke="#edeef2" strokeWidth="1" />

                    {/* Render các cột đại diện cho từng ngày */}
                    {weeklyActivity.map((hours, idx) => {
                      const colWidth = 40;
                      const colGap = 20;
                      const startX = 60 + idx * (colWidth + colGap);
                      
                      // Tính toán chiều cao cột (tối đa 150px)
                      const colHeight = (hours / maxWeeklyHours) * 140;
                      const startY = 170 - colHeight;

                      const isHovered = hoveredBarIndex === idx;

                      return (
                        <g 
                          key={idx}
                          onMouseEnter={() => setHoveredBarIndex(idx)}
                          onMouseLeave={() => setHoveredBarIndex(null)}
                          className="cursor-pointer"
                        >
                          {/* Cột chính */}
                          <rect
                            x={startX}
                            y={startY}
                            width={colWidth}
                            height={Math.max(colHeight, 4)} // Tối thiểu 4px để cột không biến mất
                            rx="6"
                            fill={isHovered ? '#ad2c00' : '#feb700'}
                            className="transition-all duration-300"
                          />
                          
                          {/* Text hiển thị số giờ khi hover hoặc mặc định */}
                          {(isHovered || hours > 0) && (
                            <text
                              x={startX + colWidth / 2}
                              y={startY - 6}
                              textAnchor="middle"
                              className="text-[10px] font-extrabold fill-primary"
                            >
                              {hours.toFixed(1)}h
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Nhãn các ngày trong tuần ở chân biểu đồ */}
                <div className="flex justify-between px-14 border-t border-outline-variant/10 pt-3">
                  {daysOfWeek.map((day, idx) => (
                    <span 
                      key={idx} 
                      className={`text-xs font-bold ${hoveredBarIndex === idx ? 'text-primary font-extrabold scale-110' : 'text-on-surface-variant'} transition-all`}
                    >
                      {day}
                    </span>
                  ))}
                </div>
              </div>

              {/* Cột phải 2/5: Hộp thư ý kiến / Nhận xét của Giáo viên */}
              <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-extrabold text-on-surface text-base">Phản hồi gần đây từ Giáo viên</h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">Nhận xét chuyên môn của giáo viên bộ môn</p>
                  </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto max-h-[250px] pr-1">
                  {currentRemarks.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-10">
                      <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center mb-3">
                        <MessageSquare className="w-5 h-5 text-on-surface-variant/40" />
                      </div>
                      <p className="text-xs text-on-surface-variant">Không có nhận xét nào gần đây.</p>
                    </div>
                  ) : (
                    currentRemarks.map(remark => (
                      <div 
                        key={remark.id}
                        className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/20 hover:border-outline-variant/40 transition-colors"
                      >
                        <div className="flex items-center gap-3 mb-2.5">
                          <img 
                            src={remark.avatar} 
                            alt={remark.teacher} 
                            className="w-8 h-8 rounded-full border border-outline-variant/20 object-cover"
                          />
                          <div className="min-w-0">
                            <p className="font-extrabold text-xs text-on-surface leading-tight">{remark.teacher}</p>
                            <p className="text-[10px] text-primary font-bold mt-0.5">{remark.subject}</p>
                          </div>
                          <span className="ml-auto text-[9px] text-on-surface-variant font-medium">{remark.date}</span>
                        </div>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                          "{remark.content}"
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t border-outline-variant/20 mt-4 pt-4">
                  <Link 
                    to="/parent/messages" 
                    className="w-full py-2.5 bg-primary/5 hover:bg-primary/10 text-primary rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Trò chuyện với Giáo viên</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

            </div>

          </div>
        )}
      </div>
    </div>
  );
}

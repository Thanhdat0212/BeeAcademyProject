import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  Award,
  BookOpen,
  ChevronDown,
  FileDown,
  Filter,
  Loader2,
  RefreshCw,
  Star,
  TrendingUp,
  User,
} from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import PageBanner from '../../components/PageBanner';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import * as parentService from '../../api/parentService';
import { printParentProgressReport } from '../../lib/parentProgressReport';
import type {
  ChildProgressReportResponse,
  ParentAssessmentRecord,
  ParentCourseProgressItem,
} from '../../types/api';

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function formatCourseGrades(grades: number[], fallback: string): string {
  if (grades.length === 0) return fallback || 'Chưa rõ';
  return `Lớp ${grades.join(', ')}`;
}

function formatScore(record: ParentAssessmentRecord): string {
  if (record.rawScore == null || record.maxScore == null) return '—';
  return `${record.rawScore.toFixed(1)}/${record.maxScore.toFixed(0)}`;
}

function formatNormalizedScore(record: ParentAssessmentRecord): string {
  if (record.normalizedScore == null) return '—';
  return `${record.normalizedScore.toFixed(1)}/10`;
}

function courseMetric(course: ParentCourseProgressItem): number {
  if (course.latestExamScore != null) return course.latestExamScore;
  if (course.averageQuizScore != null) return course.averageQuizScore;
  if (course.latestAssignmentScore != null) return course.latestAssignmentScore;
  return course.progressPct / 10;
}

function courseStatusLabel(status: ParentCourseProgressItem['status']): string {
  return status === 'completed' ? 'Đã hoàn thành' : 'Đang học';
}

export default function ParentProgress() {
  const { linkedStudents, fetchLinkedStudents } = useAuthStore();
  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => {
    return localStorage.getItem('parent_active_student_id') || linkedStudents[0]?.id || '';
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ChildProgressReportResponse | null>(null);

  const [courseFilter, setCourseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    fetchLinkedStudents();
  }, [fetchLinkedStudents]);

  useEffect(() => {
    if (linkedStudents.length > 0) {
      const savedStudentId = localStorage.getItem('parent_active_student_id');
      const isValidSavedStudent = savedStudentId && linkedStudents.some(student => student.id === savedStudentId);
      const isValidCurrentStudent = linkedStudents.some(student => student.id === selectedStudentId);

      if (isValidSavedStudent && savedStudentId !== selectedStudentId) {
        setSelectedStudentId(savedStudentId);
      } else if (!isValidCurrentStudent) {
        setSelectedStudentId(linkedStudents[0].id);
        localStorage.setItem('parent_active_student_id', linkedStudents[0].id);
      }
    } else {
      setSelectedStudentId('');
    }
  }, [linkedStudents, selectedStudentId]);

  useEffect(() => {
    if (!selectedStudentId) {
      setReport(null);
      return;
    }

    let active = true;
    const loadReport = async () => {
      setLoading(true);
      try {
        const data = await parentService.getChildProgressReport(selectedStudentId);
        if (!active) return;
        setReport(data);
      } catch (error) {
        if (!active) return;
        setReport(null);
        console.error('Lỗi khi tải báo cáo tiến độ của con:', error);
        notify.error('Không thể tải dữ liệu tiến độ học tập.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadReport();
    return () => {
      active = false;
    };
  }, [selectedStudentId]);

  useEffect(() => {
    if (courseFilter && report && !report.courses.some(course => course.courseId === courseFilter)) {
      setCourseFilter('');
    }
  }, [courseFilter, report]);

  const activeStudent = linkedStudents.find(student => student.id === selectedStudentId);
  const gradeLabel = report?.gradeLabel || activeStudent?.grade || 'Chưa phân lớp';

  const filteredCourses = report
    ? report.courses.filter(course => {
        if (courseFilter && course.courseId !== courseFilter) return false;
        if (statusFilter !== 'all' && course.status !== statusFilter) return false;
        return true;
      })
    : [];

  const allowedCourseIds = new Set(filteredCourses.map(course => course.courseId));

  const filteredAssessments = report
    ? report.assessments.filter(record => {
        if (!allowedCourseIds.has(record.courseId)) return false;
        const recordDate = record.submittedAt ? record.submittedAt.slice(0, 10) : '';
        if (fromDate && (!recordDate || recordDate < fromDate)) return false;
        if (toDate && (!recordDate || recordDate > toDate)) return false;
        return true;
      })
    : [];

  const scoredAssessments = filteredAssessments.filter(record => record.normalizedScore != null);
  const averageScore = scoredAssessments.length > 0
    ? scoredAssessments.reduce((sum, record) => sum + (record.normalizedScore ?? 0), 0) / scoredAssessments.length
    : null;
  const averageProgress = filteredCourses.length > 0
    ? filteredCourses.reduce((sum, course) => sum + course.progressPct, 0) / filteredCourses.length
    : 0;
  const totalQuizCompleted = filteredCourses.reduce((sum, course) => sum + course.quizCompletedCount, 0);
  const totalQuizCount = filteredCourses.reduce((sum, course) => sum + course.quizTotalCount, 0);
  const bestCourse = filteredCourses
    .slice()
    .sort((left, right) => courseMetric(right) - courseMetric(left))[0];

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    localStorage.setItem('parent_active_student_id', studentId);
    setDropdownOpen(false);
    setCourseFilter('');
    notify.success(`Đã chuyển sang xem tiến độ của ${linkedStudents.find(student => student.id === studentId)?.name}`);
  };

  const handleRefresh = async () => {
    if (!selectedStudentId) return;
    setLoading(true);
    try {
      const data = await parentService.getChildProgressReport(selectedStudentId);
      setReport(data);
      notify.success('Đã cập nhật báo cáo tiến độ mới nhất.');
    } catch (error) {
      console.error('Lỗi khi làm mới báo cáo tiến độ:', error);
      notify.error('Không thể làm mới báo cáo tiến độ.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setCourseFilter('');
    setStatusFilter('all');
    setFromDate('');
    setToDate('');
  };

  const handlePrintReport = () => {
    if (!report || !activeStudent) return;

    const selectedCourse = report.courses.find(course => course.courseId === courseFilter);
    const summaryParts = [
      selectedCourse ? `Khóa học: ${selectedCourse.courseTitle}` : 'Khóa học: tất cả',
      statusFilter === 'all' ? 'Trạng thái: tất cả' : `Trạng thái: ${statusFilter === 'completed' ? 'đã hoàn thành' : 'đang học'}`,
      fromDate ? `Từ ngày: ${fromDate}` : '',
      toDate ? `Đến ngày: ${toDate}` : '',
    ].filter(Boolean);

    const printableReport: ChildProgressReportResponse = {
      ...report,
      courses: filteredCourses,
      assessments: filteredAssessments,
    };

    const opened = printParentProgressReport(printableReport, {
      filterSummary: summaryParts.join(' • '),
    });

    if (!opened) {
      notify.error('Trình duyệt đang chặn cửa sổ in báo cáo.');
      return;
    }

    notify.success(`Đã mở báo cáo PDF cho ${activeStudent.name}.`);
  };

  if (linkedStudents.length === 0) {
    return (
      <div className="min-h-screen bg-surface flex flex-col font-sans">
        <DashboardHeader />
        <PageBanner title="Tiến độ & Điểm số" subtitle="Phân tích chi tiết kết quả học tập của con" />
        <div className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-10 py-12 text-center">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-10 max-w-xl mx-auto shadow-sm">
            <AlertCircle className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-extrabold text-on-surface">Chưa liên kết tài khoản con</h3>
            <p className="text-xs text-on-surface-variant mt-2 mb-6">
              Liên kết tài khoản con để xem kết quả học tập và báo cáo tiến độ chi tiết.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <DashboardHeader />

      <div className="relative">
        <PageBanner
          title="Tiến độ & Điểm số"
          subtitle="Theo dõi tiến độ khóa học, cột điểm gần đây và xuất báo cáo dành cho phụ huynh"
        />

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
                      <p className="text-[10px] text-on-surface-variant mt-1">{student.grade || report?.gradeLabel || 'Chưa phân lớp'}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-10 py-8">
        {activeStudent && (
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm"
            >
              <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-primary">UC24 · Theo dõi tiến độ học tập</p>
                  <h2 className="text-2xl font-extrabold text-on-surface mt-1">{activeStudent.name}</h2>
                  <p className="text-sm text-on-surface-variant mt-1">
                    {gradeLabel} · Cập nhật lúc {formatDateTime(report?.generatedAt)}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 flex-1">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Khóa học</span>
                    <select
                      value={courseFilter}
                      onChange={(event) => setCourseFilter(event.target.value)}
                      className="h-11 rounded-xl border border-outline-variant/30 bg-surface px-3 text-sm font-semibold text-on-surface"
                    >
                      <option value="">Tất cả khóa học</option>
                      {(report?.courses ?? []).map(course => (
                        <option key={course.courseId} value={course.courseId}>
                          {course.courseTitle}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Trạng thái</span>
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'completed')}
                      className="h-11 rounded-xl border border-outline-variant/30 bg-surface px-3 text-sm font-semibold text-on-surface"
                    >
                      <option value="all">Tất cả</option>
                      <option value="active">Đang học</option>
                      <option value="completed">Đã hoàn thành</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Từ ngày</span>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(event) => setFromDate(event.target.value)}
                      className="h-11 rounded-xl border border-outline-variant/30 bg-surface px-3 text-sm font-semibold text-on-surface"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Đến ngày</span>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(event) => setToDate(event.target.value)}
                      className="h-11 rounded-xl border border-outline-variant/30 bg-surface px-3 text-sm font-semibold text-on-surface"
                    />
                  </label>

                  <div className="flex items-end gap-2">
                    <button
                      onClick={handleResetFilters}
                      className="h-11 px-4 rounded-xl border border-outline-variant/30 bg-surface font-bold text-xs text-on-surface-variant hover:bg-surface-container-low transition-colors"
                    >
                      Xóa lọc
                    </button>
                    <button
                      onClick={handleRefresh}
                      className="h-11 w-11 rounded-xl border border-outline-variant/30 bg-surface text-on-surface-variant hover:bg-surface-container-low transition-colors flex items-center justify-center"
                      title="Làm mới"
                    >
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-4 border-t border-outline-variant/20">
                <div className="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant font-semibold">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/5 text-primary">
                    <Filter className="w-3.5 h-3.5" />
                    {filteredCourses.length} khóa học hiển thị
                  </span>
                  <span>{filteredAssessments.length} cột điểm khớp bộ lọc</span>
                </div>

                <button
                  onClick={handlePrintReport}
                  disabled={!report || loading}
                  className="h-11 px-5 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/95 transition-all shadow-md shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  <FileDown className="w-4 h-4" />
                  In / Lưu PDF
                </button>
              </div>
            </motion.div>

            <div className="relative">
              {loading && (
                <div className="absolute inset-0 bg-surface/55 backdrop-blur-[2px] z-20 flex items-center justify-center rounded-3xl">
                  <div className="bg-surface-container px-4 py-3 rounded-2xl border border-outline-variant/30 flex items-center gap-2 shadow-lg">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    <span className="text-xs font-bold text-on-surface">Đang tải báo cáo tiến độ...</span>
                  </div>
                </div>
              )}

              {report && filteredCourses.length === 0 && filteredAssessments.length === 0 ? (
                <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-10 shadow-sm text-center">
                  <AlertCircle className="w-12 h-12 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-extrabold text-on-surface">Không có dữ liệu phù hợp</h3>
                  <p className="text-sm text-on-surface-variant mt-2 max-w-xl mx-auto">
                    Bộ lọc hiện tại chưa khớp với khóa học hoặc cột điểm nào của {activeStudent.name}. Thử đổi khoảng ngày hoặc chọn lại trạng thái.
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    <div className="bg-gradient-to-br from-primary to-primary-container p-6 rounded-3xl text-on-primary shadow-lg flex items-center justify-between">
                      <div>
                        <p className="text-xs font-extrabold uppercase tracking-wider opacity-75">Điểm trung bình</p>
                        <p className="text-4xl font-extrabold mt-1">{averageScore != null ? averageScore.toFixed(1) : '—'}/10</p>
                        <p className="text-xs mt-2 font-medium opacity-90">Tính từ {scoredAssessments.length} cột điểm</p>
                      </div>
                      <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                        <Award className="w-8 h-8 text-white" />
                      </div>
                    </div>

                    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Tiến độ trung bình</p>
                        <p className="text-3xl font-extrabold text-on-surface mt-1">{averageProgress.toFixed(1)}%</p>
                        <p className="text-xs text-on-surface-variant mt-2 font-medium">{filteredCourses.length} khóa học đang hiển thị</p>
                      </div>
                      <div className="w-12 h-12 bg-blue-500/10 text-blue-600 rounded-2xl flex items-center justify-center">
                        <TrendingUp className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Quiz đã hoàn thành</p>
                        <p className="text-3xl font-extrabold text-on-surface mt-1">{totalQuizCompleted}/{totalQuizCount}</p>
                        <p className="text-xs text-on-surface-variant mt-2 font-medium">Số quiz đã nộp trên tổng quiz cấu hình</p>
                      </div>
                      <div className="w-12 h-12 bg-teal-500/10 text-teal-600 rounded-2xl flex items-center justify-center">
                        <BookOpen className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Khóa học nổi bật</p>
                        <p className="text-xl font-extrabold text-on-surface mt-2 leading-tight">
                          {bestCourse ? bestCourse.courseTitle : 'Chưa có dữ liệu'}
                        </p>
                        <p className="text-xs text-primary mt-2 font-extrabold flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-primary" />
                          {bestCourse ? `${courseMetric(bestCourse).toFixed(1)}/10` : '—'}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-secondary-container/20 text-on-secondary-container rounded-2xl flex items-center justify-center">
                        <Star className="w-6 h-6 text-secondary fill-secondary" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
                    <div className="xl:col-span-2 bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm flex flex-col space-y-5">
                      <div>
                        <h3 className="font-extrabold text-on-surface text-base">Tiến độ theo khóa học</h3>
                        <p className="text-xs text-on-surface-variant mt-0.5">Theo dõi từng khóa học mà con đang hoặc đã hoàn thành</p>
                      </div>

                      <div className="space-y-4">
                        {filteredCourses.map(course => (
                          <div key={course.courseId} className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h4 className="font-extrabold text-sm text-on-surface truncate">{course.courseTitle}</h4>
                                <p className="text-[11px] text-on-surface-variant mt-1">
                                  {course.teacherName || 'Chưa rõ giáo viên'} · {formatCourseGrades(course.grades, gradeLabel)}
                                </p>
                              </div>
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold whitespace-nowrap ${
                                course.status === 'completed'
                                  ? 'bg-green-500/10 text-green-600'
                                  : 'bg-blue-500/10 text-blue-600'
                              }`}>
                                {courseStatusLabel(course.status)}
                              </span>
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[11px] font-semibold text-on-surface-variant">
                                <span>Tiến độ hiện tại</span>
                                <span>{course.progressPct}%</span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-surface-container-high">
                                <div
                                  className={`h-2 rounded-full transition-all ${
                                    course.status === 'completed' ? 'bg-green-500' : 'bg-primary'
                                  }`}
                                  style={{ width: `${course.progressPct}%` }}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-[11px]">
                              <div className="bg-surface px-3 py-2 rounded-xl border border-outline-variant/15">
                                <p className="text-on-surface-variant font-bold uppercase tracking-wider">Quiz</p>
                                <p className="text-on-surface font-extrabold mt-1">{course.quizCompletedCount}/{course.quizTotalCount}</p>
                              </div>
                              <div className="bg-surface px-3 py-2 rounded-xl border border-outline-variant/15">
                                <p className="text-on-surface-variant font-bold uppercase tracking-wider">TB Quiz</p>
                                <p className="text-on-surface font-extrabold mt-1">{course.averageQuizScore != null ? `${course.averageQuizScore.toFixed(1)}/10` : '—'}</p>
                              </div>
                              <div className="bg-surface px-3 py-2 rounded-xl border border-outline-variant/15">
                                <p className="text-on-surface-variant font-bold uppercase tracking-wider">Quiz mới nhất</p>
                                <p className="text-on-surface font-extrabold mt-1">{course.latestQuizScore != null ? `${course.latestQuizScore.toFixed(1)}/10` : '—'}</p>
                              </div>
                              <div className="bg-surface px-3 py-2 rounded-xl border border-outline-variant/15">
                                <p className="text-on-surface-variant font-bold uppercase tracking-wider">Exam mới nhất</p>
                                <p className="text-on-surface font-extrabold mt-1">{course.latestExamScore != null ? `${course.latestExamScore.toFixed(1)}/10` : '—'}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="xl:col-span-3 bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm flex flex-col">
                      <div className="mb-6">
                        <h3 className="font-extrabold text-on-surface text-base">Bảng điểm gần đây</h3>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          Danh sách quiz, exam và assignment của con theo thứ tự mới nhất
                        </p>
                      </div>

                      <div className="flex-grow overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                          <thead>
                            <tr className="border-b border-outline-variant/20 bg-surface-container-low/50 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                              <th className="px-4 py-3">Thời gian</th>
                              <th className="px-4 py-3">Khóa học</th>
                              <th className="px-4 py-3">Bài đánh giá</th>
                              <th className="px-4 py-3">Loại</th>
                              <th className="px-4 py-3 text-center">Điểm</th>
                              <th className="px-4 py-3">Nhận xét</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant/10">
                            {filteredAssessments.map(record => (
                              <tr key={record.id} className="hover:bg-surface-container-low/20 transition-colors">
                                <td className="px-4 py-3.5 text-xs text-on-surface-variant font-medium whitespace-nowrap">
                                  {formatDateTime(record.submittedAt)}
                                </td>
                                <td className="px-4 py-3.5 text-xs font-semibold text-on-surface">
                                  <p className="max-w-[180px] truncate" title={record.courseTitle}>{record.courseTitle}</p>
                                  <p className="text-[10px] text-on-surface-variant mt-1">
                                    {record.courseStatus === 'completed' ? 'Đã hoàn thành' : 'Đang học'}
                                  </p>
                                </td>
                                <td className="px-4 py-3.5 text-xs text-on-surface">
                                  <p className="font-semibold max-w-[220px] truncate" title={record.assessmentName}>{record.assessmentName}</p>
                                  {record.chapterTitle && (
                                    <p className="text-[10px] text-on-surface-variant mt-1">{record.chapterTitle}</p>
                                  )}
                                </td>
                                <td className="px-4 py-3.5 text-xs">
                                  <span className={`inline-block px-2 py-0.5 rounded-md font-bold ${
                                    record.assessmentType === 'quiz'
                                      ? 'bg-amber-500/10 text-amber-700'
                                      : record.assessmentType === 'exam'
                                        ? 'bg-blue-500/10 text-blue-600'
                                        : 'bg-teal-500/10 text-teal-600'
                                  }`}>
                                    {record.assessmentType.toUpperCase()}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 text-center text-xs">
                                  <p className="font-extrabold text-on-surface">{formatScore(record)}</p>
                                  <p className="text-[10px] text-primary font-bold mt-1">{formatNormalizedScore(record)}</p>
                                </td>
                                <td className="px-4 py-3.5 text-xs text-on-surface-variant max-w-[220px]">
                                  <p className="line-clamp-2" title={record.feedback || undefined}>
                                    {record.feedback || 'Chưa có nhận xét chi tiết'}
                                  </p>
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
        )}
      </div>
    </div>
  );
}

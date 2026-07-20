import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Award,
  BookOpen,
  CalendarDays,
  ChevronDown,
  FileDown,
  Filter,
  Loader2,
  Minus,
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
  ParentRequiredExamStatus,
} from '../../types/api';

const PROGRESS_AUTO_REFRESH_MS = 4 * 60 * 1000;

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

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(date);
}

function weeklyTrendLabel(trend: string): string {
  switch (trend) {
    case 'increasing':
      return 'Tăng so với tuần trước';
    case 'decreasing':
      return 'Giảm so với tuần trước';
    case 'stable':
      return 'Ổn định so với tuần trước';
    default:
      return 'Chưa đủ dữ liệu so sánh';
  }
}

function requiredExamStatusLabel(status: ParentRequiredExamStatus): string {
  switch (status) {
    case 'not_configured':
      return 'Chưa cấu hình';
    case 'not_submitted':
      return 'Chưa nộp';
    case 'in_progress':
      return 'Đang làm';
    case 'pending_grading':
      return 'Chờ chấm';
    case 'passed':
      return 'Đạt';
    case 'failed':
      return 'Chưa đạt';
    default:
      return status;
  }
}

function requiredExamStatusClass(status: ParentRequiredExamStatus): string {
  switch (status) {
    case 'passed':
      return 'bg-green-500/10 text-green-700 border-green-500/20';
    case 'failed':
      return 'bg-red-500/10 text-red-700 border-red-500/20';
    case 'pending_grading':
    case 'in_progress':
      return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
    default:
      return 'bg-surface text-on-surface-variant border-outline-variant/20';
  }
}

function requiredExamTypeLabel(examType: string | null): string {
  if (examType === 'final_exam') return 'Cuối kỳ';
  if (examType === 'chapter_test') return 'Giữa kỳ';
  if (examType === 'quiz') return 'Quiz';
  return examType || 'Chưa cấu hình';
}

function progressAccessReasonLabel(reason: string | null | undefined): string {
  switch (reason) {
    case 'DOB_MISSING_REQUIRE_CONSENT':
      return 'Thiếu ngày sinh học sinh, cần xác nhận đồng ý để xem dữ liệu nhạy cảm.';
    case 'STUDENT_16_PLUS_PRIVACY_ENABLED_REQUIRE_CONSENT':
      return 'Học sinh từ 16 tuổi đang bật quyền riêng tư, cần đồng ý trước khi hiển thị chi tiết nhạy cảm.';
    default:
      return 'Một số nhận xét và chi tiết bài làm đang được ẩn theo thiết lập quyền riêng tư.';
  }
}

function certificateStatusLabel(status: string): string {
  switch (status) {
    case 'ISSUED':
      return 'Đã cấp';
    case 'REISSUED':
      return 'Đã cấp lại';
    case 'NEEDS_REVIEW':
      return 'Cần xem xét';
    case 'REVOKED':
      return 'Đã thu hồi';
    default:
      return 'Chưa cấp';
  }
}

function certificateStatusClass(status: string): string {
  switch (status) {
    case 'ISSUED':
    case 'REISSUED':
      return 'bg-green-500/10 text-green-700 border-green-500/20';
    case 'NEEDS_REVIEW':
      return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
    case 'REVOKED':
      return 'bg-red-500/10 text-red-700 border-red-500/20';
    default:
      return 'bg-surface text-on-surface-variant border-outline-variant/20';
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function ParentProgress() {
  const { linkedStudents, fetchLinkedStudents } = useAuthStore();
  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => {
    return localStorage.getItem('parent_active_student_id') || linkedStudents[0]?.id || '';
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
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
    const loadReport = async (showLoading = true) => {
      if (showLoading) setLoading(true);
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
        if (active && showLoading) setLoading(false);
      }
    };

    loadReport();
    const refreshTimer = window.setInterval(() => {
      loadReport(false);
    }, PROGRESS_AUTO_REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
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

  const filteredCertificates = report
    ? (report.certificates ?? []).filter(certificate => {
        if (!certificate.courseId) return !courseFilter;
        return allowedCourseIds.has(certificate.courseId);
      })
    : [];
  const totalCompletedLessons = filteredCourses.reduce(
    (sum, course) => sum + (course.completedLessons?.length ?? 0),
    0,
  );

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
  const weeklySummary = report?.weeklySummary;
  const weeklyActivityMax = Math.max(
    weeklySummary?.currentWeekCompletedItems ?? 0,
    weeklySummary?.previousWeekCompletedItems ?? 0,
    1,
  );

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
      certificates: filteredCertificates,
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

  const handleExportExcel = async () => {
    if (!selectedStudentId || !activeStudent) return;
    setExportingExcel(true);
    try {
      const blob = await parentService.exportChildProgressReport(selectedStudentId, {
        courseId: courseFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      const safeName = activeStudent.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase() || 'hoc-sinh';
      downloadBlob(blob, `bao-cao-tien-do-${safeName}.xlsx`);
      notify.success(`Đã tải file Excel báo cáo của ${activeStudent.name}.`);
    } catch (error) {
      console.error('Lỗi khi tải Excel báo cáo tiến độ:', error);
      notify.error('Không thể tải file Excel báo cáo.');
    } finally {
      setExportingExcel(false);
    }
  };

  if (linkedStudents.length === 0) {
    return (
      <div data-testid="parent-progress-empty" className="min-h-screen bg-surface flex flex-col font-sans">
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
    <div data-testid="parent-progress-page" className="min-h-screen bg-surface flex flex-col font-sans">
      <DashboardHeader />

      <div className="relative">
        <PageBanner
          title="Tiến độ & Điểm số"
          subtitle="Theo dõi tiến độ khóa học, cột điểm gần đây và xuất báo cáo dành cho phụ huynh"
        />

        <div className="absolute bottom-4 right-4 md:right-10 z-10">
          <div className="relative">
            <button
              data-testid="student-selector"
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
                      data-testid="course-filter"
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
                      data-testid="status-filter"
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
                      data-testid="from-date-filter"
                      type="date"
                      value={fromDate}
                      onChange={(event) => setFromDate(event.target.value)}
                      className="h-11 rounded-xl border border-outline-variant/30 bg-surface px-3 text-sm font-semibold text-on-surface"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Đến ngày</span>
                    <input
                      data-testid="to-date-filter"
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
                      data-testid="refresh-progress"
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
                  <span>{totalCompletedLessons} bài đã học</span>
                  <span>{filteredAssessments.length} cột điểm khớp bộ lọc</span>
                  <span>{filteredCertificates.length} chứng chỉ</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    data-testid="export-progress-xlsx"
                    onClick={handleExportExcel}
                    disabled={!report || loading || exportingExcel}
                    className="h-11 px-5 rounded-xl border border-outline-variant/30 bg-surface text-on-surface font-bold text-xs hover:bg-surface-container-low transition-all disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  >
                    {exportingExcel ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                    Tải Excel
                  </button>
                  <button
                    onClick={handlePrintReport}
                    disabled={!report || loading}
                    className="h-11 px-5 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary/95 transition-all shadow-md shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  >
                    <FileDown className="w-4 h-4" />
                    In / Lưu PDF
                  </button>
                </div>
              </div>
            </motion.div>

            {report?.sensitiveDataMasked && (
              <div data-testid="privacy-warning" className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 flex items-start gap-3 text-amber-800">
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-extrabold">Đang ẩn dữ liệu nhạy cảm</p>
                  <p className="text-xs mt-1 font-medium">
                    {progressAccessReasonLabel(report.detailAccessReason)}
                  </p>
                </div>
              </div>
            )}

            {weeklySummary && (
              <section data-testid="weekly-report" className="bg-surface-container-lowest border-y border-outline-variant/30 px-5 py-6 md:px-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-primary">
                      <CalendarDays className="h-5 w-5" />
                      <h3 className="text-base font-extrabold text-on-surface">Báo cáo 7 ngày</h3>
                    </div>
                    <p className="mt-1 text-xs font-medium text-on-surface-variant">
                      {formatDate(weeklySummary.periodStart)} đến {formatDate(weeklySummary.periodEnd)}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 text-sm font-extrabold text-on-surface">
                    {weeklySummary.progressTrend === 'increasing' ? (
                      <ArrowUp className="h-4 w-4 text-green-600" />
                    ) : weeklySummary.progressTrend === 'decreasing' ? (
                      <ArrowDown className="h-4 w-4 text-red-600" />
                    ) : (
                      <Minus className="h-4 w-4 text-on-surface-variant" />
                    )}
                    {weeklyTrendLabel(weeklySummary.progressTrend)}
                  </div>
                </div>

                <div className="mt-5 space-y-3" aria-label="So sánh hoạt động học tập hai tuần">
                  <div className="grid grid-cols-[76px_minmax(0,1fr)_32px] items-center gap-3">
                    <span className="text-xs font-bold text-on-surface-variant">Tuần này</span>
                    <div className="h-3 overflow-hidden bg-surface-container-high">
                      <div
                        className="h-full bg-primary transition-[width] duration-300"
                        style={{ width: `${(weeklySummary.currentWeekCompletedItems / weeklyActivityMax) * 100}%` }}
                      />
                    </div>
                    <span className="text-right text-xs font-extrabold text-on-surface">{weeklySummary.currentWeekCompletedItems}</span>
                  </div>
                  <div className="grid grid-cols-[76px_minmax(0,1fr)_32px] items-center gap-3">
                    <span className="text-xs font-bold text-on-surface-variant">Tuần trước</span>
                    <div className="h-3 overflow-hidden bg-surface-container-high">
                      <div
                        className="h-full bg-secondary transition-[width] duration-300"
                        style={{ width: `${(weeklySummary.previousWeekCompletedItems / weeklyActivityMax) * 100}%` }}
                      />
                    </div>
                    <span className="text-right text-xs font-extrabold text-on-surface">{weeklySummary.previousWeekCompletedItems}</span>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 border-y border-outline-variant/20 md:grid-cols-4">
                  <div className="px-3 py-4 md:border-r md:border-outline-variant/20">
                    <p className="text-[11px] font-bold uppercase text-on-surface-variant">Hoàn thành tuần này</p>
                    <p className="mt-1 text-2xl font-extrabold text-on-surface">{weeklySummary.currentWeekCompletedItems}</p>
                    <p className="mt-1 text-[11px] text-on-surface-variant">Tuần trước: {weeklySummary.previousWeekCompletedItems}</p>
                  </div>
                  <div className="border-l border-outline-variant/20 px-3 py-4 md:border-l-0 md:border-r">
                    <p className="text-[11px] font-bold uppercase text-on-surface-variant">Điểm trung bình</p>
                    <p className="mt-1 text-2xl font-extrabold text-on-surface">
                      {weeklySummary.averageScore == null ? '—' : weeklySummary.averageScore.toFixed(1)}<span className="text-sm">/10</span>
                    </p>
                    <p className="mt-1 text-[11px] text-on-surface-variant">{weeklySummary.completedAssessments} bài đánh giá</p>
                  </div>
                  <div className="border-t border-outline-variant/20 px-3 py-4 md:border-r md:border-t-0">
                    <p className="text-[11px] font-bold uppercase text-on-surface-variant">Bài chưa hoàn thành</p>
                    <p className="mt-1 text-2xl font-extrabold text-on-surface">{weeklySummary.incompleteLearningItems}</p>
                    <p className="mt-1 text-[11px] text-on-surface-variant">Trong {weeklySummary.incompleteCourses} khóa chưa xong</p>
                  </div>
                  <div className="border-l border-t border-outline-variant/20 px-3 py-4 md:border-l-0 md:border-t-0">
                    <p className="text-[11px] font-bold uppercase text-on-surface-variant">Ngày không học</p>
                    <p className="mt-1 text-2xl font-extrabold text-on-surface">{weeklySummary.inactiveDays}<span className="text-sm">/7</span></p>
                    <p className="mt-1 text-[11px] text-on-surface-variant">Tính từ bài học và bài đánh giá</p>
                  </div>
                </div>

                <div className="mt-4 flex items-start gap-3 bg-primary/5 px-4 py-3 text-sm text-on-surface">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <div>
                    <p className="font-extrabold">Khuyến nghị theo quy tắc</p>
                    <p className="mt-0.5 text-xs font-medium text-on-surface-variant">{weeklySummary.actionSuggestion}</p>
                  </div>
                </div>
              </section>
            )}

            {report && (
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="font-extrabold text-on-surface text-base">Chứng chỉ của con</h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Trạng thái chứng chỉ theo từng khóa học.
                    </p>
                  </div>
                  <Award className="w-5 h-5 text-primary flex-shrink-0" />
                </div>

                {filteredCertificates.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-outline-variant/30 bg-surface px-4 py-5 text-sm text-on-surface-variant">
                    Chưa có chứng chỉ phù hợp với bộ lọc hiện tại.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {filteredCertificates.map(certificate => (
                      <div
                        key={certificate.certificateId}
                        className="rounded-2xl border border-outline-variant/20 bg-surface p-4"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-extrabold text-sm text-on-surface truncate" title={certificate.courseTitle}>
                              {certificate.courseTitle}
                            </p>
                            <p className="text-[11px] text-on-surface-variant mt-1">
                              {certificate.teacherName || 'Chưa rõ giáo viên'}
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded-full border text-[10px] font-extrabold whitespace-nowrap ${certificateStatusClass(certificate.status)}`}>
                            {certificateStatusLabel(certificate.status)}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2 text-[11px]">
                          <div>
                            <p className="text-on-surface-variant font-bold uppercase tracking-wider">Số chứng chỉ</p>
                            <p className="font-extrabold text-on-surface mt-0.5 break-all">{certificate.certificateNo}</p>
                          </div>
                          <div>
                            <p className="text-on-surface-variant font-bold uppercase tracking-wider">Mã xác thực</p>
                            <p className="font-extrabold text-primary mt-0.5 break-all">{certificate.verificationCode}</p>
                          </div>
                          <div>
                            <p className="text-on-surface-variant font-bold uppercase tracking-wider">Ngày cấp</p>
                            <p className="font-semibold text-on-surface mt-0.5">{formatDateTime(certificate.issuedAt)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
                          <div
                            key={course.courseId}
                            data-testid={`course-progress-${course.courseId}`}
                            className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10 space-y-3"
                          >
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

                            <div className="bg-surface px-3 py-2 rounded-xl border border-outline-variant/15">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-on-surface-variant font-bold uppercase tracking-wider text-[11px]">Bài đã học</p>
                                <p className="text-on-surface font-extrabold text-xs">{course.completedLessons?.length ?? 0}</p>
                              </div>
                              {(course.completedLessons?.length ?? 0) > 0 && (
                                <p className="text-[11px] text-on-surface-variant mt-1 truncate">
                                  Mới nhất: {course.completedLessons[course.completedLessons.length - 1]?.lessonTitle}
                                </p>
                              )}
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

                            <div className="bg-surface px-3 py-3 rounded-xl border border-outline-variant/15">
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <p className="text-[11px] text-on-surface-variant font-bold uppercase tracking-wider">4 bài kiểm tra bắt buộc</p>
                                <span className="text-[10px] text-on-surface-variant font-bold">
                                  {(course.requiredExams ?? []).filter(exam => exam.status === 'passed').length}/4 đạt
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {(course.requiredExams ?? []).map(exam => (
                                  <div
                                    key={`${course.courseId}-${exam.slotIndex}`}
                                    data-testid={`required-exam-${course.courseId}-${exam.slotIndex}`}
                                    className={`rounded-lg border px-2.5 py-2 ${requiredExamStatusClass(exam.status)}`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="font-extrabold text-[11px] leading-tight">{exam.label}</p>
                                      <span className="text-[9px] font-extrabold whitespace-nowrap">
                                        {requiredExamStatusLabel(exam.status)}
                                      </span>
                                    </div>
                                    <p className="text-[10px] mt-1 font-semibold">
                                      {exam.normalizedScore != null ? `${exam.normalizedScore.toFixed(1)}/10` : 'Chưa có điểm'}
                                    </p>
                                    {exam.examName && (
                                      <p className="text-[10px] mt-1 truncate" title={exam.examName}>
                                        {exam.examName}
                                      </p>
                                    )}
                                    <p className="text-[9px] mt-1 opacity-75">
                                      {requiredExamTypeLabel(exam.examType)}
                                    </p>
                                  </div>
                                ))}
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
                              <tr
                                key={record.id}
                                data-testid={`assessment-${record.id}`}
                                className="hover:bg-surface-container-low/20 transition-colors"
                              >
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
                                    {record.feedback || (report?.sensitiveDataMasked ? 'Đang ẩn theo quyền riêng tư/consent' : 'Chưa có nhận xét chi tiết')}
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

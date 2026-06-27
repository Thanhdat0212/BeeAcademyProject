import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  RefreshCw,
  TrendingUp,
  User,
} from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import PageBanner from '../../components/PageBanner';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import * as parentService from '../../api/parentService';
import type { ChildProgressReportResponse, ParentCourseProgressItem } from '../../types/api';

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function formatGrades(grades: number[], fallback: string): string {
  if (grades.length === 0) return fallback || 'Chưa rõ lớp';
  return `Lớp ${grades.join(', ')}`;
}

function formatScore(value: number | null): string {
  if (value == null) return 'Chưa có';
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}/10`;
}

function courseStatusLabel(status: ParentCourseProgressItem['status']): string {
  return status === 'completed' ? 'Đã hoàn thành' : 'Đang học';
}

export default function ParentCourses() {
  const { linkedStudents, fetchLinkedStudents } = useAuthStore();
  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => {
    return localStorage.getItem('parent_active_student_id') || '';
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ChildProgressReportResponse | null>(null);

  useEffect(() => {
    fetchLinkedStudents();
  }, [fetchLinkedStudents]);

  useEffect(() => {
    if (linkedStudents.length === 0) {
      setSelectedStudentId('');
      setReport(null);
      return;
    }

    const savedStudentId = localStorage.getItem('parent_active_student_id');
    const validSaved = savedStudentId && linkedStudents.some(student => student.id === savedStudentId);
    const validCurrent = linkedStudents.some(student => student.id === selectedStudentId);

    if (validSaved && savedStudentId !== selectedStudentId) {
      setSelectedStudentId(savedStudentId);
      return;
    }

    if (!validCurrent) {
      setSelectedStudentId(linkedStudents[0].id);
      localStorage.setItem('parent_active_student_id', linkedStudents[0].id);
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
      setReport(null);
      try {
        const data = await parentService.getChildProgressReport(selectedStudentId);
        if (active) setReport(data);
      } catch (error) {
        if (!active) return;
        console.error('Lỗi khi tải danh sách khóa học của con:', error);
        notify.error('Không thể tải danh sách khóa học của con.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadReport();
    return () => {
      active = false;
    };
  }, [selectedStudentId]);

  const activeStudent = linkedStudents.find(student => student.id === selectedStudentId);
  const gradeLabel = report?.gradeLabel || activeStudent?.grade || 'Chưa phân lớp';
  const courses = report?.courses ?? [];
  const completedCount = courses.filter(course => course.status === 'completed').length;
  const averageProgress = courses.length > 0
    ? courses.reduce((sum, course) => sum + course.progressPct, 0) / courses.length
    : 0;

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    localStorage.setItem('parent_active_student_id', studentId);
    setDropdownOpen(false);
    notify.success(`Đã chuyển sang xem khóa học của ${linkedStudents.find(student => student.id === studentId)?.name}`);
  };

  const handleRefresh = async () => {
    if (!selectedStudentId) return;
    setLoading(true);
    try {
      const data = await parentService.getChildProgressReport(selectedStudentId);
      setReport(data);
      notify.success('Đã cập nhật danh sách khóa học mới nhất.');
    } catch (error) {
      console.error('Lỗi khi làm mới danh sách khóa học của con:', error);
      notify.error('Không thể làm mới danh sách khóa học.');
    } finally {
      setLoading(false);
    }
  };

  if (linkedStudents.length === 0) {
    return (
      <div className="min-h-screen bg-surface flex flex-col font-sans">
        <DashboardHeader />
        <PageBanner title="Khóa học của con" subtitle="Theo dõi tiến độ từng khóa học bằng dữ liệu học tập thực tế" />
        <div className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-10 py-12 text-center">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-10 max-w-xl mx-auto shadow-sm">
            <AlertCircle className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-extrabold text-on-surface">Chưa liên kết tài khoản con</h3>
            <p className="text-sm text-on-surface-variant mt-2">
              Liên kết tài khoản con để xem danh sách khóa học và tiến độ học tập.
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
          title="Khóa học của con"
          subtitle="Danh sách khóa học, tiến độ hoàn thành và kết quả đánh giá theo từng khóa"
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
                      <p className="text-[10px] text-on-surface-variant mt-1">{student.grade || 'Chưa phân lớp'}</p>
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
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-primary">UC24 · Khóa học & tiến độ</p>
                  <h2 className="text-2xl font-extrabold text-on-surface mt-1">{activeStudent.name}</h2>
                  <p className="text-sm text-on-surface-variant mt-1">
                    {gradeLabel} · Cập nhật lúc {formatDateTime(report?.generatedAt)}
                  </p>
                </div>

                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="h-11 px-4 rounded-xl border border-outline-variant/30 bg-surface text-on-surface-variant hover:bg-surface-container-low transition-colors flex items-center justify-center gap-2 font-bold text-xs disabled:opacity-60"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Làm mới
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="rounded-2xl bg-primary/5 border border-primary/10 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">Tổng khóa học</p>
                  <p className="text-3xl font-extrabold text-on-surface mt-1">{courses.length}</p>
                </div>
                <div className="rounded-2xl bg-green-500/5 border border-green-500/10 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-green-700">Đã hoàn thành</p>
                  <p className="text-3xl font-extrabold text-on-surface mt-1">{completedCount}</p>
                </div>
                <div className="rounded-2xl bg-blue-500/5 border border-blue-500/10 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Tiến độ trung bình</p>
                  <p className="text-3xl font-extrabold text-on-surface mt-1">{averageProgress.toFixed(1)}%</p>
                </div>
              </div>
            </motion.section>

            <div className="relative">
              {loading && (
                <div className="absolute inset-0 bg-surface/55 backdrop-blur-[2px] z-20 flex items-center justify-center rounded-3xl">
                  <div className="bg-surface-container px-4 py-3 rounded-2xl border border-outline-variant/30 flex items-center gap-2 shadow-lg">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    <span className="text-xs font-bold text-on-surface">Đang tải danh sách khóa học...</span>
                  </div>
                </div>
              )}

              {courses.length === 0 ? (
                <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-12 text-center">
                  <BookOpen className="w-12 h-12 text-on-surface-variant/45 mx-auto mb-4" />
                  <h3 className="text-xl font-extrabold text-on-surface">Con chưa có khóa học nào</h3>
                  <p className="text-sm text-on-surface-variant mt-2">
                    Khi con ghi danh khóa học, tiến độ và điểm số sẽ xuất hiện tại đây.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {courses.map(course => (
                    <motion.article
                      key={course.courseId}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="text-lg font-extrabold text-on-surface leading-tight truncate" title={course.courseTitle}>
                            {course.courseTitle}
                          </h3>
                          <p className="text-xs text-on-surface-variant mt-1">
                            {course.teacherName || 'Chưa rõ giáo viên'} · {formatGrades(course.grades, gradeLabel)}
                          </p>
                          <p className="text-[11px] text-on-surface-variant mt-1">
                            Ghi danh: {formatDateTime(course.enrolledAt)}
                          </p>
                        </div>

                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold whitespace-nowrap ${
                          course.status === 'completed'
                            ? 'bg-green-500/10 text-green-700'
                            : 'bg-blue-500/10 text-blue-700'
                        }`}>
                          {course.status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                          {courseStatusLabel(course.status)}
                        </span>
                      </div>

                      <div className="mt-5 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant">
                          <span>Tiến độ hiện tại</span>
                          <span>{course.progressPct}%</span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-surface-container-high">
                          <div
                            className={`h-2.5 rounded-full transition-all ${
                              course.status === 'completed' ? 'bg-green-500' : 'bg-primary'
                            }`}
                            style={{ width: `${course.progressPct}%` }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
                        <div className="rounded-2xl bg-surface-container-low border border-outline-variant/15 p-3">
                          <BookOpen className="w-4 h-4 text-primary mb-2" />
                          <p className="text-[11px] text-on-surface-variant font-bold uppercase">Quiz</p>
                          <p className="text-sm font-extrabold text-on-surface mt-1">
                            {course.quizCompletedCount}/{course.quizTotalCount}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-surface-container-low border border-outline-variant/15 p-3">
                          <TrendingUp className="w-4 h-4 text-blue-600 mb-2" />
                          <p className="text-[11px] text-on-surface-variant font-bold uppercase">TB Quiz</p>
                          <p className="text-sm font-extrabold text-on-surface mt-1">
                            {formatScore(course.averageQuizScore)}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-surface-container-low border border-outline-variant/15 p-3">
                          <Award className="w-4 h-4 text-amber-600 mb-2" />
                          <p className="text-[11px] text-on-surface-variant font-bold uppercase">Exam</p>
                          <p className="text-sm font-extrabold text-on-surface mt-1">
                            {formatScore(course.latestExamScore)}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-surface-container-low border border-outline-variant/15 p-3">
                          <Award className="w-4 h-4 text-teal-600 mb-2" />
                          <p className="text-[11px] text-on-surface-variant font-bold uppercase">Bài tập</p>
                          <p className="text-sm font-extrabold text-on-surface mt-1">
                            {formatScore(course.latestAssignmentScore)}
                          </p>
                        </div>
                      </div>
                    </motion.article>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

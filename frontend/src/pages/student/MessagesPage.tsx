import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BookOpen,
  CheckCheck,
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquare,
  PenLine,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import PageBanner from '../../components/PageBanner';
import { notify } from '../../lib/toast';
import { getCourseDetail, getEnrolledCourses } from '../../api/courseService';
import type { CourseDetail, CourseSummary, LessonDetail } from '../../types/api';
import {
  addStudentQaMessage,
  createStudentQaThread,
  listStudentQaThreads,
  QaMessage,
  QaThread,
  QaThreadStatus,
} from '../../api/qaService';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(iso: string): string {
  const diffMinutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

function StatusBadge({ status }: { status: QaThreadStatus }) {
  const config = {
    pending: {
      icon: <Clock className="w-3.5 h-3.5" />,
      label: 'Chờ giáo viên',
      className: 'bg-amber-500/10 text-amber-700',
    },
    answered: {
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      label: 'Đã trả lời',
      className: 'bg-blue-500/10 text-blue-700',
    },
    resolved: {
      icon: <CheckCheck className="w-3.5 h-3.5" />,
      label: 'Đã giải quyết',
      className: 'bg-green-500/10 text-green-700',
    },
  }[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

function MessageBubble({ message }: { message: QaMessage }) {
  const isStudent = message.authorRole === 'student';
  return (
    <div className={`flex ${isStudent ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[82%] rounded-2xl px-4 py-3 ${
        isStudent
          ? 'bg-primary text-on-primary rounded-br-md'
          : 'bg-surface-container text-on-surface rounded-bl-md'
      }`}>
        <div className={`text-xs font-bold mb-1 ${isStudent ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>
          {message.authorName} · {formatDateTime(message.sentAt)}
        </div>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
      </div>
    </div>
  );
}

interface ComposeModalProps {
  courses: CourseSummary[];
  onClose: () => void;
  onCreated: (thread: QaThread) => void;
}

function flattenLessons(course: CourseDetail | null): LessonDetail[] {
  if (!course) return [];
  return course.chapters.flatMap(chapter => chapter.lessons);
}

function ComposeModal({ courses, onClose, onCreated }: ComposeModalProps) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const [lessonId, setLessonId] = useState('');
  const [content, setContent] = useState('');
  const [courseDetail, setCourseDetail] = useState<CourseDetail | null>(null);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const lessons = useMemo(() => flattenLessons(courseDetail), [courseDetail]);

  useEffect(() => {
    if (!courseId) {
      setCourseDetail(null);
      return;
    }

    let cancelled = false;
    setLoadingLessons(true);
    setLessonId('');
    getCourseDetail(courseId)
      .then(detail => {
        if (!cancelled) setCourseDetail(detail);
      })
      .catch(() => {
        if (!cancelled) {
          setCourseDetail(null);
          notify.error('Không tải được danh sách bài học');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLessons(false);
      });

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  async function handleSubmit() {
    if (!courseId) {
      notify.error('Vui lòng chọn khóa học');
      return;
    }
    if (!content.trim()) {
      notify.error('Vui lòng nhập nội dung câu hỏi');
      return;
    }
    try {
      setSubmitting(true);
      const thread = await createStudentQaThread({
        courseId,
        lessonId: lessonId || null,
        content: content.trim(),
      });
      notify.success('Đã gửi câu hỏi tới giáo viên');
      onCreated(thread);
      onClose();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không gửi được câu hỏi');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
        className="bg-surface rounded-2xl w-full max-w-2xl shadow-2xl shadow-black/15 overflow-hidden border border-outline-variant/20"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20">
          <div>
            <h3 className="font-extrabold text-on-surface text-base">Đặt câu hỏi mới</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">Chọn khóa học và mô tả rõ chỗ bạn đang vướng.</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-container rounded-lg text-on-surface-variant transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <label className="block">
            <span className="block text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Khóa học</span>
            <select
              value={courseId}
              onChange={e => setCourseId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-primary outline-none text-sm text-on-surface"
            >
              {courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Bài học</span>
            <select
              value={lessonId}
              onChange={e => setLessonId(e.target.value)}
              disabled={loadingLessons}
              className="w-full px-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-primary outline-none text-sm text-on-surface disabled:opacity-70"
            >
              <option value="">Hỏi chung về khóa học</option>
              {lessons.map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Nội dung câu hỏi</span>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Ví dụ: Em chưa hiểu bước biến đổi ở phút 07:30..."
              rows={6}
              className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-primary outline-none text-sm text-on-surface placeholder:text-on-surface-variant/60 resize-none leading-relaxed"
            />
          </label>
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-outline-variant/20">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-xl transition-colors">
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Gửi câu hỏi
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function MessagesPage() {
  const [threads, setThreads] = useState<QaThread[]>([]);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const selectedThread = threads.find(thread => thread.id === selectedId) ?? null;

  async function loadData() {
    try {
      setLoading(true);
      const [threadList, courseList] = await Promise.all([
        listStudentQaThreads(),
        getEnrolledCourses(),
      ]);
      setThreads(threadList);
      setCourses(courseList);
      setSelectedId(prev => prev && threadList.some(t => t.id === prev) ? prev : threadList[0]?.id ?? null);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không tải được hộp hỏi đáp');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function upsertThread(thread: QaThread) {
    setThreads(prev => {
      const exists = prev.some(item => item.id === thread.id);
      const next = exists ? prev.map(item => item.id === thread.id ? thread : item) : [thread, ...prev];
      return next.sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
    });
    setSelectedId(thread.id);
  }

  async function sendFollowUp() {
    if (!selectedThread) return;
    const content = replyInput.trim();
    if (!content) {
      notify.error('Vui lòng nhập nội dung phản hồi');
      return;
    }
    try {
      setSending(true);
      const updated = await addStudentQaMessage(selectedThread.id, content);
      upsertThread(updated);
      setReplyInput('');
      notify.success('Đã gửi phản hồi');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không gửi được phản hồi');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <DashboardHeader />

      <PageBanner
        title="Hỏi & Đáp"
        subtitle="Trao đổi trực tiếp với giáo viên về bài học và khóa học của bạn"
      />

      <div className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-10 py-8">
        <main>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-extrabold text-on-surface">Hộp hỏi đáp</h2>
              <p className="text-sm text-on-surface-variant mt-0.5">Theo dõi câu trả lời và gửi thêm thông tin khi cần.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadData}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-outline-variant/50 rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Làm mới
              </button>
              <button
                onClick={() => {
                  if (courses.length === 0) {
                    notify.error('Bạn cần ghi danh khóa học trước khi đặt câu hỏi');
                    return;
                  }
                  setShowCompose(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
              >
                <PenLine className="w-4 h-4" />
                Đặt câu hỏi
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24 text-on-surface-variant">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 border-dashed">
              <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mb-5">
                <MessageSquare className="w-9 h-9 text-on-surface-variant opacity-40" />
              </div>
              <h3 className="text-lg font-bold text-on-surface mb-2">Chưa có câu hỏi nào</h3>
              <p className="text-on-surface-variant text-sm text-center max-w-sm mb-6">Đặt câu hỏi đầu tiên để giáo viên hỗ trợ đúng phần bạn đang học.</p>
              <button
                onClick={() => {
                  if (courses.length === 0) {
                    notify.error('Bạn cần ghi danh khóa học trước khi đặt câu hỏi');
                    return;
                  }
                  setShowCompose(true);
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
              >
                <PenLine className="w-4 h-4" />
                Đặt câu hỏi mới
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <section className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 shadow-sm h-fit">
                <h3 className="font-extrabold text-on-surface mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" />Cuộc hội thoại</span>
                  <span className="text-sm text-on-surface-variant font-normal">{threads.length}</span>
                </h3>
                <div className="space-y-2 max-h-[650px] overflow-y-auto">
                  {threads.map(thread => {
                    const isSelected = thread.id === selectedId;
                    const latest = thread.messages[thread.messages.length - 1];
                    return (
                      <button
                        key={thread.id}
                        onClick={() => setSelectedId(thread.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-colors ${
                          isSelected
                            ? 'bg-primary/10 border-primary/30'
                            : 'bg-surface-container/30 border-outline-variant/30 hover:bg-surface-container/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p className={`font-bold text-sm line-clamp-1 ${isSelected ? 'text-primary' : 'text-on-surface'}`}>{thread.courseTitle}</p>
                            <p className="text-xs text-on-surface-variant line-clamp-1">{thread.lessonTitle ?? 'Hỏi chung về khóa học'}</p>
                          </div>
                          <StatusBadge status={thread.status} />
                        </div>
                        <p className="text-sm text-on-surface line-clamp-2 mb-2">{latest?.content ?? 'Không có nội dung'}</p>
                        <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                          <span>{thread.messages.length} tin nhắn</span>
                          <span>{formatRelativeTime(thread.lastActivityAt)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="lg:col-span-3 bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-sm min-h-[560px] flex flex-col">
                {!selectedThread ? (
                  <div className="text-center py-16 px-5 my-auto">
                    <MessageSquare className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
                    <p className="text-on-surface-variant">Chọn một cuộc hội thoại để xem chi tiết</p>
                  </div>
                ) : (
                  <>
                    <div className="px-5 py-4 border-b border-outline-variant/30">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-extrabold text-on-surface flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-primary flex-shrink-0" />
                            {selectedThread.courseTitle}
                          </p>
                          <p className="text-sm text-on-surface-variant mt-1">{selectedThread.lessonTitle ?? 'Hỏi chung về khóa học'}</p>
                          <p className="text-xs text-on-surface-variant mt-1">Bắt đầu: {formatDateTime(selectedThread.createdAt)}</p>
                        </div>
                        <StatusBadge status={selectedThread.status} />
                      </div>
                    </div>

                    <div className="px-5 py-4 space-y-4 max-h-[440px] overflow-y-auto">
                      {selectedThread.messages.map(message => <MessageBubble key={message.id} message={message} />)}
                    </div>

                    <div className="px-5 py-4 border-t border-outline-variant/30 mt-auto">
                      <textarea
                        value={replyInput}
                        onChange={e => setReplyInput(e.target.value)}
                        placeholder="Gửi thêm thông tin hoặc đặt câu hỏi tiếp..."
                        rows={3}
                        className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant resize-none"
                      />
                      <div className="flex justify-end mt-3">
                        <button
                          onClick={sendFollowUp}
                          disabled={sending}
                          className="flex items-center justify-center gap-2 px-5 py-2 bg-primary text-on-primary text-sm font-bold rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-colors shadow-md shadow-primary/20"
                        >
                          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          Gửi phản hồi
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </section>
            </div>
          )}
        </main>
      </div>

      <AnimatePresence>
        {showCompose && (
          <ComposeModal
            courses={courses}
            onClose={() => setShowCompose(false)}
            onCreated={upsertThread}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

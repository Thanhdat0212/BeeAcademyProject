import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import {
  getAdminQaThread,
  listAdminQaThreads,
  type QaMessage,
  type QaThread,
  type QaThreadStatus,
  type QaVisibility,
} from '../../api/qaService';
import { notify } from '../../lib/toast';

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status: QaThreadStatus): string {
  if (status === 'answered') return 'Đã trả lời';
  if (status === 'resolved') return 'Đã giải quyết';
  return 'Chờ giáo viên';
}

function roleLabel(role: QaMessage['authorRole']): string {
  const labels: Record<QaMessage['authorRole'], string> = {
    student: 'Học sinh',
    teacher: 'Giáo viên',
    parent: 'Phụ huynh',
    admin: 'Admin',
  };
  return labels[role];
}

function VisibilityBadge({ visibility }: { visibility: QaVisibility }) {
  const isPrivate = visibility === 'private';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${
      isPrivate ? 'bg-violet-500/10 text-violet-700' : 'bg-emerald-500/10 text-emerald-700'
    }`}>
      {isPrivate ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      {isPrivate ? 'Riêng tư' : 'Công khai'}
    </span>
  );
}

export default function AdminQaPanel() {
  const [threads, setThreads] = useState<QaThread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<QaThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch] = useState('');
  const [visibility, setVisibility] = useState<'all' | QaVisibility>('all');
  const [status, setStatus] = useState<'all' | QaThreadStatus>('all');
  const [courseId, setCourseId] = useState('all');

  const courses = useMemo(() => {
    const byId = new Map<string, string>();
    threads.forEach(thread => byId.set(thread.courseId, thread.courseTitle));
    return [...byId.entries()]
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title, 'vi'));
  }, [threads]);

  const filteredThreads = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return threads.filter(thread => {
      if (visibility !== 'all' && thread.visibility !== visibility) return false;
      if (status !== 'all' && thread.status !== status) return false;
      if (courseId !== 'all' && thread.courseId !== courseId) return false;
      if (!keyword) return true;
      return thread.title.toLowerCase().includes(keyword)
        || thread.studentName.toLowerCase().includes(keyword)
        || thread.courseTitle.toLowerCase().includes(keyword)
        || (thread.lessonTitle ?? '').toLowerCase().includes(keyword)
        || thread.messages.some(message => message.content.toLowerCase().includes(keyword));
    });
  }, [courseId, search, status, threads, visibility]);

  async function loadThreads() {
    try {
      setLoading(true);
      const data = await listAdminQaThreads();
      setThreads(data);
      setSelectedId(previous => previous && data.some(thread => thread.id === previous)
        ? previous
        : data[0]?.id ?? null);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không tải được danh sách Q&A');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadThreads();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelectedThread(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    getAdminQaThread(selectedId)
      .then(thread => {
        if (!cancelled) setSelectedThread(thread);
      })
      .catch(error => {
        if (!cancelled) {
          setSelectedThread(threads.find(thread => thread.id === selectedId) ?? null);
          notify.error(error instanceof Error ? error.message : 'Không tải được chi tiết câu hỏi');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, threads]);

  const privateCount = threads.filter(thread => thread.visibility === 'private').length;
  const pendingCount = threads.filter(thread => thread.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Tổng câu hỏi</span>
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-on-surface">{threads.length}</p>
        </div>
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Câu hỏi riêng tư</span>
            <ShieldCheck className="h-5 w-5 text-violet-600" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-on-surface">{privateCount}</p>
        </div>
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Đang chờ trả lời</span>
            <Clock className="h-5 w-5 text-amber-600" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-on-surface">{pendingCount}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Tìm tiêu đề, học sinh, khóa học..."
              className="w-full rounded-xl border border-outline-variant/40 bg-surface py-2.5 pl-10 pr-3 text-sm text-on-surface outline-none focus:border-primary"
            />
          </label>
          <select value={courseId} onChange={event => setCourseId(event.target.value)} className="rounded-xl border border-outline-variant/40 bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary">
            <option value="all">Tất cả khóa học</option>
            {courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
          </select>
          <select value={visibility} onChange={event => setVisibility(event.target.value as 'all' | QaVisibility)} className="rounded-xl border border-outline-variant/40 bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary">
            <option value="all">Mọi phạm vi</option>
            <option value="public">Công khai</option>
            <option value="private">Riêng tư</option>
          </select>
          <div className="flex gap-2">
            <select value={status} onChange={event => setStatus(event.target.value as 'all' | QaThreadStatus)} className="min-w-0 flex-1 rounded-xl border border-outline-variant/40 bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary">
              <option value="all">Mọi trạng thái</option>
              <option value="pending">Chờ giáo viên</option>
              <option value="answered">Đã trả lời</option>
              <option value="resolved">Đã giải quyết</option>
            </select>
            <button type="button" onClick={() => void loadThreads()} className="rounded-xl border border-outline-variant/40 p-2.5 text-on-surface-variant hover:bg-surface-container" aria-label="Làm mới Q&A">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        <section className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm xl:col-span-2">
          <div className="border-b border-outline-variant/30 px-4 py-3 text-sm font-bold text-on-surface">
            Danh sách câu hỏi ({filteredThreads.length})
          </div>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filteredThreads.length === 0 ? (
            <p className="px-4 py-16 text-center text-sm text-on-surface-variant">Không có câu hỏi phù hợp.</p>
          ) : (
            <div className="max-h-[680px] space-y-2 overflow-y-auto p-3">
              {filteredThreads.map(thread => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setSelectedId(thread.id)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    selectedId === thread.id
                      ? 'border-primary/40 bg-primary/10'
                      : 'border-outline-variant/30 bg-surface hover:bg-surface-container/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-bold text-on-surface">{thread.title}</p>
                    <VisibilityBadge visibility={thread.visibility} />
                  </div>
                  <p className="mt-2 line-clamp-1 text-xs text-on-surface-variant">{thread.studentName} · {thread.courseTitle}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-on-surface-variant">
                    <span>{statusLabel(thread.status)}</span>
                    <span>{formatDateTime(thread.lastActivityAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="min-h-[560px] rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm xl:col-span-3">
          {loadingDetail ? (
            <div className="flex h-full min-h-[560px] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : !selectedThread ? (
            <div className="flex min-h-[560px] flex-col items-center justify-center text-on-surface-variant">
              <MessageSquare className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm">Chọn một câu hỏi để xem chi tiết.</p>
            </div>
          ) : (
            <div>
              <div className="border-b border-outline-variant/30 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-extrabold text-on-surface">{selectedThread.title}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
                      <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{selectedThread.studentName}</span>
                      <span className="inline-flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{selectedThread.courseTitle}</span>
                      {selectedThread.lessonTitle && <span>· {selectedThread.lessonTitle}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <VisibilityBadge visibility={selectedThread.visibility} />
                    <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[11px] font-bold text-amber-700">{statusLabel(selectedThread.status)}</span>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-on-surface-variant">Tạo lúc {formatDateTime(selectedThread.createdAt)}</p>
              </div>
              <div className="max-h-[590px] space-y-4 overflow-y-auto p-5">
                {selectedThread.messages.map(message => (
                  <div key={message.id} className={`flex ${message.authorRole === 'student' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[88%] rounded-2xl border px-4 py-3 ${
                      message.authorRole === 'student'
                        ? 'border-outline-variant/30 bg-surface'
                        : 'border-primary/20 bg-primary/10'
                    }`}>
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-on-surface-variant">
                        <span className="font-bold text-on-surface">{message.authorName}</span>
                        <span>{roleLabel(message.authorRole)}</span>
                        <span>· {formatDateTime(message.sentAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-on-surface">{message.content}</p>
                      {message.attachmentUrl && message.attachmentType?.startsWith('image/') && (
                        <a href={message.attachmentUrl} target="_blank" rel="noreferrer" className="mt-3 block">
                          <img src={message.attachmentUrl} alt={message.attachmentName ?? 'Ảnh đính kèm'} className="max-h-72 max-w-full rounded-xl object-contain" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  UserRound,
  X,
} from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import PageBanner from '../../components/PageBanner';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import {
  getChildTeacherConversations,
  sendParentTeacherMessage,
  uploadParentMessageAttachment,
} from '../../api/parentService';
import {
  listUserNotifications,
  markUserNotificationRead,
} from '../../api/notificationService';
import type {
  ParentTeacherConversationResponse,
  ParentTeacherConversationStatus,
  ParentTeacherMessageResponse,
} from '../../types/api';

type FilterType = 'all' | 'pending' | 'answered';
const MESSAGE_MAX_LENGTH = 2000;
const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;

function avatarFor(name: string, url?: string | null, size = 96): string {
  return url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Teacher')}&background=ad2c00&color=fff&bold=true&size=${size}`;
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return 'Chưa có';
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(iso?: string | null): string {
  if (!iso) return 'Chưa có tin nhắn';
  const diffMinutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

function statusMeta(status: ParentTeacherConversationStatus | null) {
  if (status === 'answered') {
    return {
      label: 'Đã trả lời',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      className: 'bg-blue-500/10 text-blue-700',
    };
  }
  if (status === 'resolved') {
    return {
      label: 'Đã xử lý',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      className: 'bg-green-500/10 text-green-700',
    };
  }
  if (status === 'pending') {
    return {
      label: 'Chờ giáo viên',
      icon: <Clock className="w-3.5 h-3.5" />,
      className: 'bg-amber-500/10 text-amber-700',
    };
  }
  return {
    label: 'Sẵn sàng',
    icon: <MessageSquare className="w-3.5 h-3.5" />,
    className: 'bg-surface-container text-on-surface-variant',
  };
}

function roleLabel(role: ParentTeacherMessageResponse['authorRole']): string {
  const labels: Record<ParentTeacherMessageResponse['authorRole'], string> = {
    student: 'Học sinh',
    teacher: 'Giáo viên',
    parent: 'Phụ huynh',
    admin: 'Quản trị viên',
  };
  return labels[role] ?? role;
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function conversationTimestamp(conversation: ParentTeacherConversationResponse): number {
  return conversation.lastActivityAt ? new Date(conversation.lastActivityAt).getTime() : 0;
}

function StatusPill({ status }: { status: ParentTeacherConversationStatus | null }) {
  const meta = statusMeta(status);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${meta.className}`}>
      {meta.icon}
      {meta.label}
    </span>
  );
}

function MessageBubble({ message }: { message: ParentTeacherMessageResponse }) {
  const isParent = message.authorRole === 'parent';

  return (
    <div className={`flex ${isParent ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-3 shadow-sm ${
          isParent
            ? 'bg-primary text-on-primary rounded-br-md'
            : 'bg-surface-container-lowest text-on-surface rounded-bl-md border border-outline-variant/20'
        }`}
      >
        <div className={`text-xs font-bold mb-1 ${isParent ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>
          {message.authorName} · {roleLabel(message.authorRole)} · {formatDateTime(message.sentAt)}
        </div>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
        {message.attachmentUrl && (
          <a
            href={message.attachmentUrl}
            target="_blank"
            rel="noreferrer"
            className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${
              isParent
                ? 'bg-on-primary/15 text-on-primary hover:bg-on-primary/20'
                : 'bg-surface-container text-primary hover:bg-primary/10'
            }`}
          >
            <Paperclip className="w-4 h-4" />
            <span className="truncate">{message.attachmentName || 'File đính kèm'}</span>
            <span className="opacity-75">{formatFileSize(message.attachmentSizeBytes)}</span>
          </a>
        )}
      </div>
    </div>
  );
}

export default function ParentMessages() {
  const { linkedStudents, fetchLinkedStudents } = useAuthStore();

  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [conversations, setConversations] = useState<ParentTeacherConversationResponse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [childrenLoading, setChildrenLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setChildrenLoading(true);
    fetchLinkedStudents().finally(() => {
      if (!cancelled) setChildrenLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchLinkedStudents]);

  useEffect(() => {
    let cancelled = false;

    async function markTeacherRepliesRead() {
      try {
        const summary = await listUserNotifications(true);
        const replyNotifications = summary.notifications.filter(
          notification => notification.type === 'parent_teacher_reply',
        );
        if (replyNotifications.length === 0) return;

        await Promise.allSettled(
          replyNotifications.map(notification => markUserNotificationRead(notification.id)),
        );
        if (!cancelled) {
          window.dispatchEvent(new Event('bee:user-notifications-updated'));
        }
      } catch {
        // Badge refresh is best-effort; message loading should stay quiet.
      }
    }

    markTeacherRepliesRead();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (linkedStudents.length === 0) {
      setSelectedStudentId('');
      return;
    }
    setSelectedStudentId(current =>
      current && linkedStudents.some(student => student.id === current)
        ? current
        : linkedStudents[0].id,
    );
  }, [linkedStudents]);

  async function loadConversations(studentId = selectedStudentId) {
    if (!studentId) {
      setConversations([]);
      setSelectedCourseId(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getChildTeacherConversations(studentId);
      const sorted = [...data].sort((a, b) => conversationTimestamp(b) - conversationTimestamp(a));
      setConversations(sorted);
      setSelectedCourseId(current =>
        current && sorted.some(item => item.courseId === current)
          ? current
          : sorted[0]?.courseId ?? null,
      );
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không tải được tin nhắn giáo viên');
      setConversations([]);
      setSelectedCourseId(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (childrenLoading) return;
    loadConversations(selectedStudentId);
  }, [childrenLoading, selectedStudentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedCourseId, conversations]);

  const selectedStudent = linkedStudents.find(student => student.id === selectedStudentId) ?? null;
  const activeConversation = conversations.find(item => item.courseId === selectedCourseId) ?? null;

  const filteredConversations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return conversations
      .filter(item => {
        if (filterType === 'pending') return item.status === 'pending';
        if (filterType === 'answered') return item.status === 'answered' || item.status === 'resolved';
        return true;
      })
      .filter(item => {
        if (!query) return true;
        return (
          item.teacherName.toLowerCase().includes(query) ||
          item.courseTitle.toLowerCase().includes(query) ||
          (item.categoryName ?? '').toLowerCase().includes(query)
        );
      });
  }, [conversations, filterType, searchTerm]);

  function upsertConversation(updated: ParentTeacherConversationResponse) {
    setConversations(current => {
      const exists = current.some(item => item.courseId === updated.courseId);
      const next = exists
        ? current.map(item => (item.courseId === updated.courseId ? updated : item))
        : [updated, ...current];
      return next.sort((a, b) => conversationTimestamp(b) - conversationTimestamp(a));
    });
    setSelectedCourseId(updated.courseId);
  }

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = inputText.trim();
    if (content.length > MESSAGE_MAX_LENGTH) {
      notify.error(`Tin nhắn tối đa ${MESSAGE_MAX_LENGTH} ký tự`);
      return;
    }
    if (!content) {
      notify.error('Vui lòng nhập nội dung tin nhắn');
      return;
    }
    if (!selectedStudentId || !activeConversation) {
      notify.error('Vui lòng chọn giáo viên cần trao đổi');
      return;
    }

    try {
      setSending(true);
      const uploaded = attachmentFile
        ? await uploadParentMessageAttachment(attachmentFile)
        : null;
      const updated = await sendParentTeacherMessage(
        selectedStudentId,
        activeConversation.courseId,
        content,
        uploaded?.publicUrl
          ? {
              attachmentUrl: uploaded.publicUrl,
              attachmentName: attachmentFile?.name ?? 'File đính kèm',
              attachmentType: uploaded.fileType,
              attachmentSizeBytes: uploaded.fileSizeBytes,
            }
          : null,
      );
      upsertConversation(updated);
      setInputText('');
      setAttachmentFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      notify.success('Đã gửi tin nhắn tới giáo viên');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không gửi được tin nhắn');
    } finally {
      setSending(false);
    }
  }

  function handleAttachmentChange(file: File | null) {
    if (!file) {
      setAttachmentFile(null);
      return;
    }
    if (file.size > ATTACHMENT_MAX_BYTES) {
      notify.error('File đính kèm tối đa 20MB');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setAttachmentFile(file);
  }

  if (childrenLoading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col font-sans">
        <DashboardHeader />
        <PageBanner title="Tin nhắn giáo viên" subtitle="Trao đổi trực tiếp với giáo viên phụ trách khóa học của con" />
        <div className="flex-grow flex items-center justify-center text-on-surface-variant">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (linkedStudents.length === 0) {
    return (
      <div className="min-h-screen bg-surface flex flex-col font-sans">
        <DashboardHeader />
        <PageBanner title="Tin nhắn giáo viên" subtitle="Trao đổi trực tiếp với giáo viên phụ trách khóa học của con" />
        <div className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-10 py-12 text-center">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-10 max-w-xl mx-auto shadow-sm">
            <AlertCircle className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-extrabold text-on-surface">Chưa liên kết tài khoản con</h3>
            <p className="text-sm text-on-surface-variant mt-2">
              Liên kết tài khoản con trước khi gửi tin nhắn cho giáo viên.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <DashboardHeader />

      <PageBanner
        title="Tin nhắn giáo viên"
        subtitle="Theo dõi trao đổi giữa phụ huynh và giáo viên theo từng khóa học của con"
      />

      <div className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-10 py-8">
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm p-4 md:p-5 mb-6">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <label className="block md:max-w-sm flex-1">
              <span className="block text-xs font-extrabold text-on-surface-variant uppercase tracking-wide mb-1.5">
                Tài khoản con
              </span>
              <select
                value={selectedStudentId}
                onChange={event => setSelectedStudentId(event.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-primary outline-none text-sm text-on-surface font-semibold"
              >
                {linkedStudents.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.name}{student.grade ? ` · ${student.grade}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <div className="md:ml-auto flex items-center gap-2">
              <button
                onClick={() => loadConversations()}
                disabled={childrenLoading || loading || !selectedStudentId}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant/50 text-sm font-bold text-on-surface hover:bg-surface-container disabled:opacity-60 transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Làm mới
              </button>
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[680px]"
        >
          <aside className="lg:col-span-4 border-r border-outline-variant/20 flex flex-col bg-surface-container-lowest min-h-[420px]">
            <div className="p-4 border-b border-outline-variant/20 space-y-3">
              <div>
                <h2 className="text-base font-extrabold text-on-surface">Giáo viên của {selectedStudent?.name ?? 'con'}</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {conversations.length} khóa học có thể trao đổi
                </p>
              </div>

              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/60 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  placeholder="Tìm giáo viên, khóa học..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-all placeholder:text-on-surface-variant/45 text-on-surface"
                />
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {([
                  ['all', 'Tất cả'],
                  ['pending', 'Chờ'],
                  ['answered', 'Đã trả lời'],
                ] as Array<[FilterType, string]>).map(([type, label]) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`py-2 rounded-lg text-xs font-extrabold transition-colors border ${
                      filterType === type
                        ? 'bg-primary text-on-primary border-primary shadow-sm'
                        : 'bg-surface-container-low text-on-surface-variant border-outline-variant/20 hover:bg-surface-container'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/10">
              {loading ? (
                <div className="h-full min-h-[320px] flex items-center justify-center text-on-surface-variant">
                  <Loader2 className="w-7 h-7 animate-spin" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="py-14 px-5 text-center">
                  <Inbox className="w-10 h-10 text-on-surface-variant/35 mx-auto mb-3" />
                  <p className="text-sm font-bold text-on-surface">
                    {conversations.length === 0 ? 'Chưa có giáo viên để trao đổi' : 'Không tìm thấy kết quả phù hợp'}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-1.5">
                    {conversations.length === 0
                      ? 'Khi con ghi danh khóa học có giáo viên, danh sách sẽ xuất hiện tại đây.'
                      : 'Thử đổi bộ lọc hoặc từ khóa tìm kiếm.'}
                  </p>
                </div>
              ) : (
                filteredConversations.map(conversation => {
                  const isActive = conversation.courseId === selectedCourseId;
                  return (
                    <button
                      key={conversation.courseId}
                      onClick={() => setSelectedCourseId(conversation.courseId)}
                      className={`w-full text-left flex items-start gap-3 p-4 transition-colors ${
                        isActive ? 'bg-primary/5' : 'hover:bg-surface-container-low/50'
                      }`}
                    >
                      <img
                        src={avatarFor(conversation.teacherName, conversation.teacherAvatarUrl, 96)}
                        alt={conversation.teacherName}
                        className="w-11 h-11 rounded-full border border-outline-variant/20 object-cover flex-shrink-0"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm truncate ${isActive ? 'font-extrabold text-primary' : 'font-extrabold text-on-surface'}`}>
                            {conversation.teacherName}
                          </p>
                          <span className="text-[10px] text-on-surface-variant whitespace-nowrap">
                            {formatRelativeTime(conversation.lastActivityAt)}
                          </span>
                        </div>
                        <p className="text-xs text-primary font-bold mt-0.5 line-clamp-1">
                          {conversation.categoryName ?? 'Khóa học'} · {conversation.gradeLabel || 'Chưa rõ lớp'}
                        </p>
                        <p className="text-xs text-on-surface-variant font-semibold mt-1 line-clamp-1">
                          {conversation.courseTitle}
                        </p>
                        <p className="text-xs text-on-surface-variant/80 mt-1.5 line-clamp-2">
                          {conversation.lastMessage ?? 'Bắt đầu trao đổi với giáo viên phụ trách khóa học này.'}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <StatusPill status={conversation.status} />
                          <span className="text-[11px] text-on-surface-variant">{conversation.messageCount} tin</span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="lg:col-span-8 flex flex-col bg-surface-container-low/20 min-h-[680px]">
            {activeConversation ? (
              <>
                <div className="px-5 md:px-6 py-4 bg-surface-container-lowest border-b border-outline-variant/20 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={avatarFor(activeConversation.teacherName, activeConversation.teacherAvatarUrl, 96)}
                      alt={activeConversation.teacherName}
                      className="w-11 h-11 rounded-full object-cover border border-outline-variant/20 flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-extrabold text-on-surface truncate">{activeConversation.teacherName}</p>
                      <p className="text-sm text-primary font-bold truncate">{activeConversation.courseTitle}</p>
                      <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5">
                        <BookOpen className="w-3.5 h-3.5" />
                        {activeConversation.categoryName ?? 'Khóa học'} · {activeConversation.gradeLabel || 'Chưa rõ lớp'}
                      </p>
                    </div>
                  </div>
                  <StatusPill status={activeConversation.status} />
                </div>

                <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-4 bg-surface/50">
                  {activeConversation.messages.length === 0 ? (
                    <div className="h-full min-h-[360px] flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                        <MessageSquare className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="font-extrabold text-on-surface">Chưa có tin nhắn</h3>
                      <p className="text-sm text-on-surface-variant mt-1.5 max-w-sm">
                        Gửi tin nhắn đầu tiên để giáo viên nắm tình hình học tập của con trong khóa này.
                      </p>
                    </div>
                  ) : (
                    activeConversation.messages.map(message => (
                      <MessageBubble key={message.id} message={message} />
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-4 bg-surface-container-lowest border-t border-outline-variant/20">
                  <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
                    <div className="flex-grow">
                      {attachmentFile && (
                        <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-primary/10 text-primary px-3 py-2 text-xs font-bold">
                          <span className="inline-flex items-center gap-2 min-w-0">
                            <Paperclip className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{attachmentFile.name}</span>
                            <span className="text-primary/70">{formatFileSize(attachmentFile.size)}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setAttachmentFile(null);
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className="p-1 rounded-lg hover:bg-primary/10"
                            title="Bỏ file"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    <textarea
                      value={inputText}
                      maxLength={MESSAGE_MAX_LENGTH}
                      onChange={event => setInputText(event.target.value)}
                      placeholder="Nhập tin nhắn gửi giáo viên..."
                      rows={2}
                      className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm text-on-surface transition-all placeholder:text-on-surface-variant/45 resize-none leading-relaxed"
                    />
                      <div className="mt-1 text-right text-[11px] text-on-surface-variant">
                        {inputText.length}/{MESSAGE_MAX_LENGTH}
                      </div>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.ppt,.pptx,.txt"
                      onChange={event => handleAttachmentChange(event.target.files?.[0] ?? null)}
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={sending}
                      className="p-3 bg-surface-container text-on-surface rounded-xl font-bold hover:bg-surface-container-high disabled:opacity-60 transition-colors flex-shrink-0"
                      title="Đính kèm file"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>

                    <button
                      type="submit"
                      disabled={sending}
                      className="p-3 bg-primary text-on-primary rounded-xl font-bold hover:bg-primary/95 disabled:opacity-60 transition-colors shadow-md shadow-primary/20 flex-shrink-0"
                      title="Gửi tin nhắn"
                    >
                      {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                  </form>

                  <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-on-surface-variant/75 font-semibold justify-center">
                    <ShieldAlert className="w-3.5 h-3.5 text-primary" />
                    <span>Tin nhắn được lưu trong hệ thống Q&A trực tiếp để giáo viên phụ trách phản hồi.</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full min-h-[520px] flex flex-col items-center justify-center text-center px-5">
                {loading ? (
                  <Loader2 className="w-8 h-8 text-on-surface-variant animate-spin" />
                ) : (
                  <>
                    <UserRound className="w-12 h-12 text-on-surface-variant/30 mb-4" />
                    <h4 className="font-extrabold text-on-surface">Chọn giáo viên để trao đổi</h4>
                    <p className="text-sm text-on-surface-variant mt-1.5 max-w-sm">
                      Danh sách bên trái được lấy từ các khóa học mà con đã ghi danh.
                    </p>
                  </>
                )}
              </div>
            )}
          </section>
        </motion.div>
      </div>
    </div>
  );
}

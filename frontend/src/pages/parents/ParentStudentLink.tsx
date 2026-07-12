import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  MailPlus,
  RefreshCw,
  Send,
  Trash2,
  UserRound
} from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import PageBanner from '../../components/PageBanner';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';
import * as parentService from '../../api/parentService';
import type { ParentLinkInvitationResponse } from '../../types/api';

const relationshipLabels = {
  father: 'Cha',
  mother: 'Me',
  guardian: 'Nguoi giam ho',
} as const;

function fallbackAvatar(name: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=feb700&color=1a1b1e&bold=true&size=128`;
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function statusLabel(status: ParentLinkInvitationResponse['status']): string {
  switch (status) {
    case 'accepted':
      return 'Đã chấp nhận';
    case 'rejected':
      return 'Đã từ chối';
    default:
      return 'Đang chờ xác nhận';
  }
}

export default function ParentStudentLink() {
  const { linkedStudents, unlinkStudent, fetchLinkedStudents } = useAuthStore();

  const [inviteEmail, setInviteEmail] = useState('');
  const [relationship, setRelationship] = useState<ParentLinkInvitationResponse['relationship']>('guardian');
  const [inviteNote, setInviteNote] = useState('');
  const [pendingInvitations, setPendingInvitations] = useState<ParentLinkInvitationResponse[]>([]);
  const [pageLoading, setPageLoading] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
  const [cancellingInvitationId, setCancellingInvitationId] = useState<string | null>(null);
  const [confirmUnlinkId, setConfirmUnlinkId] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  const confirmStudent = useMemo(
    () => linkedStudents.find(student => student.id === confirmUnlinkId) ?? null,
    [confirmUnlinkId, linkedStudents]
  );
  const isConfirmingStudentUnlinkRequest = confirmStudent?.unlinkRequestedByRole === 'student';

  const loadData = async (showLoading = true) => {
    if (showLoading) setPageLoading(true);
    try {
      const invitations = await parentService.getLinkInvitations();
      await fetchLinkedStudents();
      setPendingInvitations(invitations);
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu liên kết phụ huynh - học sinh:', error);
      notify.error(error instanceof Error ? error.message : 'Không thể tải dữ liệu liên kết.');
    } finally {
      if (showLoading) setPageLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSendInvite = async (emailOverride?: string) => {
    const targetEmail = (emailOverride ?? inviteEmail).trim();
    if (!targetEmail) {
      notify.error('Vui lòng nhập email học sinh.');
      return;
    }

    if (emailOverride) {
      setResendingEmail(targetEmail);
    } else {
      setSendingInvite(true);
    }

    try {
      const existingInvitation = emailOverride
        ? pendingInvitations.find(item => item.studentEmail === targetEmail)
        : null;
      const invitation = await parentService.sendLinkInvitation({
        studentEmail: targetEmail,
        relationship: existingInvitation?.relationship ?? relationship,
        note: existingInvitation?.note ?? (inviteNote.trim() || null),
      });
      setPendingInvitations(current => [
        invitation,
        ...current.filter(item => item.studentId !== invitation.studentId),
      ]);
      if (!emailOverride) {
        setInviteEmail('');
        setRelationship('guardian');
        setInviteNote('');
      }
      notify.success(`Đã gửi lời mời liên kết tới ${targetEmail}.`);
    } catch (error) {
      console.error('Lỗi khi gửi lời mời liên kết:', error);
      notify.error(error instanceof Error ? error.message : 'Không thể gửi lời mời liên kết.');
    } finally {
      setSendingInvite(false);
      setResendingEmail(null);
    }
  };

  const handleCancelInvitation = async (invitation: ParentLinkInvitationResponse) => {
    setCancellingInvitationId(invitation.studentId);
    try {
      await parentService.cancelLinkInvitation(invitation.studentId);
      setPendingInvitations(current => current.filter(item => item.studentId !== invitation.studentId));
      notify.success(`Da huy loi moi lien ket toi ${invitation.studentName}.`);
    } catch (error) {
      console.error('Loi khi huy loi moi lien ket:', error);
      notify.error(error instanceof Error ? error.message : 'Khong the huy loi moi lien ket.');
    } finally {
      setCancellingInvitationId(null);
    }
  };

  const handleExecuteUnlink = async () => {
    if (!confirmUnlinkId) return;

    setUnlinking(true);
    const result = await unlinkStudent(confirmUnlinkId);
    setUnlinking(false);

    if (typeof result === 'string') {
      notify.error(result);
      return;
    }

    if (isConfirmingStudentUnlinkRequest && localStorage.getItem('parent_active_student_id') === confirmUnlinkId) {
      localStorage.removeItem('parent_active_student_id');
    }
    notify.success(
      isConfirmingStudentUnlinkRequest
        ? `Đã đồng ý hủy liên kết với ${confirmStudent?.name ?? 'học sinh'}.`
        : `Đã gửi yêu cầu hủy liên kết tới ${confirmStudent?.name ?? 'học sinh'}. Cần học sinh đồng ý để hoàn tất.`
    );
    setConfirmUnlinkId(null);
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <DashboardHeader />

      <PageBanner
        title="Lời mời liên kết tài khoản con"
        subtitle="Gửi lời mời qua email, theo dõi các yêu cầu chờ xác nhận, và quản lý những tài khoản học sinh đã liên kết với bạn."
      />

      <div className="flex-grow max-w-[1100px] mx-auto w-full px-4 md:px-10 py-8">
        <div className="space-y-8">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm"
          >
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-extrabold uppercase tracking-wide">
                  <MailPlus className="w-3.5 h-3.5" />
                  UC27
                </div>
                <h2 className="mt-3 text-2xl font-extrabold text-on-surface">
                  Mời học sinh xác nhận liên kết
                </h2>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                  Hệ thống sẽ tạo yêu cầu ở trạng thái <strong>PENDING</strong> và gửi email thông báo
                  đến đúng tài khoản học sinh. Nếu lời mời đã tồn tại, thao tác này sẽ gửi lại thông báo mới nhất.
                </p>
              </div>

              <button
                onClick={() => loadData()}
                disabled={pageLoading}
                className="h-11 w-11 rounded-xl border border-outline-variant/30 bg-surface text-on-surface-variant hover:bg-surface-container-low transition-colors flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                title="Làm mới"
              >
                <RefreshCw className={`w-4 h-4 ${pageLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_220px_auto] gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Email tài khoản học sinh
                </span>
                <div className="h-12 rounded-2xl border border-outline-variant/30 bg-surface px-4 flex items-center gap-3">
                  <Mail className="w-4 h-4 text-on-surface-variant" />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="student@example.com"
                    className="flex-1 bg-transparent outline-none text-sm font-semibold text-on-surface placeholder:text-on-surface-variant/60"
                  />
                </div>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Quan he
                </span>
                <select
                  value={relationship}
                  onChange={(event) => setRelationship(event.target.value as ParentLinkInvitationResponse['relationship'])}
                  className="h-12 rounded-2xl border border-outline-variant/30 bg-surface px-4 outline-none text-sm font-semibold text-on-surface"
                >
                  <option value="father">Cha</option>
                  <option value="mother">Me</option>
                  <option value="guardian">Nguoi giam ho</option>
                </select>
              </label>

              <button
                onClick={() => handleSendInvite()}
                disabled={sendingInvite}
                className="h-12 px-5 rounded-2xl bg-primary text-on-primary font-bold text-sm hover:bg-primary/95 transition-all shadow-md shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {sendingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Gửi lời mời
              </button>
            </div>
            <label className="mt-3 flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Ghi chu tuy chon
              </span>
              <textarea
                value={inviteNote}
                onChange={(event) => setInviteNote(event.target.value.slice(0, 500))}
                rows={3}
                placeholder="Thong tin de hoc sinh xac nhan dung phu huynh."
                className="rounded-2xl border border-outline-variant/30 bg-surface px-4 py-3 outline-none text-sm text-on-surface placeholder:text-on-surface-variant/60 resize-none"
              />
              <span className="text-[11px] text-on-surface-variant text-right">{inviteNote.length}/500</span>
            </label>
          </motion.section>

          <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-8">
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm min-h-[380px]"
            >
              <div className="flex items-start justify-between gap-4 border-b border-outline-variant/20 pb-4 mb-5">
                <div>
                  <h3 className="font-extrabold text-on-surface text-lg">
                    Lời mời đang chờ xác nhận ({pendingInvitations.length})
                  </h3>
                  <p className="text-sm text-on-surface-variant mt-1">
                    Học sinh nhận email sẽ thấy lời mời ở trạng thái PENDING cho tới khi chấp nhận hoặc từ chối.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-700 text-xs font-extrabold">
                  <Clock3 className="w-3.5 h-3.5" />
                  Đang chờ
                </div>
              </div>

              {pageLoading ? (
                <div className="h-[240px] flex items-center justify-center">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface-variant">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    Đang tải dữ liệu lời mời...
                  </div>
                </div>
              ) : pendingInvitations.length === 0 ? (
                <div className="h-[240px] flex flex-col items-center justify-center text-center px-6">
                  <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center mb-4">
                    <MailPlus className="w-6 h-6 text-on-surface-variant/50" />
                  </div>
                  <p className="text-sm font-semibold text-on-surface">Chưa có lời mời nào đang chờ.</p>
                  <p className="text-xs text-on-surface-variant mt-1 max-w-md">
                    Gửi email học sinh ở phía trên để tạo lời mời liên kết mới cho tài khoản phụ huynh của bạn.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingInvitations.map(invitation => (
                    <div
                      key={invitation.studentId}
                      className="p-4 rounded-2xl border border-outline-variant/20 bg-surface-container-low/40"
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={invitation.avatarUrl || fallbackAvatar(invitation.studentName)}
                            alt={invitation.studentName}
                            className="w-12 h-12 rounded-full object-cover border border-outline-variant/20 bg-surface-container flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-sm text-on-surface truncate">
                              {invitation.studentName}
                            </h4>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant">
                              <span>{invitation.studentEmail}</span>
                              <span>{invitation.grade || 'Chưa có lớp học'}</span>
                              <span>{relationshipLabels[invitation.relationship]}</span>
                              <span>Gửi lúc: {formatDateTime(invitation.invitedAt)}</span>
                              <span>Hết hạn: {formatDateTime(invitation.expiresAt)}</span>
                            </div>
                            {invitation.note && (
                              <p className="mt-2 text-xs text-on-surface-variant line-clamp-2">
                                {invitation.note}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-700 text-[11px] font-extrabold uppercase tracking-wide">
                            {statusLabel(invitation.status)}
                          </span>
                          <button
                            onClick={() => handleSendInvite(invitation.studentEmail)}
                            disabled={resendingEmail === invitation.studentEmail}
                            className="h-10 px-4 rounded-xl border border-outline-variant/25 bg-surface text-xs font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
                          >
                            {resendingEmail === invitation.studentEmail ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                            Gửi lại
                          </button>
                          <button
                            onClick={() => handleCancelInvitation(invitation)}
                            disabled={cancellingInvitationId === invitation.studentId}
                            className="h-10 px-4 rounded-xl border border-red-200/50 bg-red-50 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
                          >
                            {cancellingInvitationId === invitation.studentId ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                            Hủy lời mời
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm min-h-[380px]"
            >
              <div className="border-b border-outline-variant/20 pb-4 mb-5">
                <h3 className="font-extrabold text-on-surface text-lg">
                  Học sinh đã liên kết ({linkedStudents.length})
                </h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  Đây là các tài khoản học sinh đã chấp nhận liên kết và đang được bạn theo dõi.
                </p>
              </div>

              {pageLoading ? (
                <div className="h-[240px] flex items-center justify-center">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface-variant">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    Đang tải danh sách học sinh...
                  </div>
                </div>
              ) : linkedStudents.length === 0 ? (
                <div className="h-[240px] flex flex-col items-center justify-center text-center px-6">
                  <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center mb-4">
                    <UserRound className="w-6 h-6 text-on-surface-variant/45" />
                  </div>
                  <p className="text-sm font-semibold text-on-surface">Chưa có học sinh nào đã liên kết.</p>
                  <p className="text-xs text-on-surface-variant mt-1 max-w-md">
                    Sau khi học sinh chấp nhận lời mời, tài khoản sẽ xuất hiện tại đây và có thể xem tiến độ học tập.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {linkedStudents.map(student => {
                    const waitingForStudent = student.unlinkRequestedByRole === 'parent';
                    const waitingForParent = student.unlinkRequestedByRole === 'student';

                    return (
                    <div
                      key={student.id}
                      className="p-4 bg-surface-container-low/40 border border-outline-variant/15 rounded-2xl flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={student.avatar || fallbackAvatar(student.name)}
                          alt={student.name}
                          className="w-12 h-12 rounded-full border border-outline-variant/20 object-cover flex-shrink-0 bg-surface-container"
                        />
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-sm text-on-surface truncate">{student.name}</h4>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-on-surface-variant">
                            <span>{student.grade || 'Chưa có lớp học'}</span>
                            <span>
                              {waitingForStudent
                                ? 'Đang chờ học sinh đồng ý hủy'
                                : waitingForParent
                                  ? 'Học sinh đang yêu cầu hủy'
                                  : 'Đã liên kết'}
                            </span>
                            {student.unlinkRequestedAt && (
                              <span>Yêu cầu lúc: {formatDateTime(student.unlinkRequestedAt)}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setConfirmUnlinkId(student.id)}
                        disabled={waitingForStudent}
                        className={`h-10 w-10 rounded-xl transition-colors border flex items-center justify-center flex-shrink-0 ${
                          waitingForStudent
                            ? 'bg-amber-50 text-amber-600 border-amber-200/50 cursor-not-allowed'
                            : waitingForParent
                              ? 'bg-emerald-50 hover:bg-emerald-100/70 text-emerald-600 border-emerald-200/60'
                              : 'bg-red-50 hover:bg-red-100/60 text-red-500 border-red-200/40'
                        }`}
                        title={
                          waitingForStudent
                            ? 'Đang chờ học sinh đồng ý hủy'
                            : waitingForParent
                              ? 'Đồng ý hủy liên kết'
                              : 'Gửi yêu cầu hủy liên kết'
                        }
                      >
                        {waitingForStudent ? (
                          <Clock3 className="w-4 h-4" />
                        ) : waitingForParent ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    );
                  })}
                </div>
              )}
            </motion.section>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {confirmUnlinkId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface-container-lowest border border-outline-variant/40 rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-6"
            >
              <div className={`flex items-center gap-3 ${isConfirmingStudentUnlinkRequest ? 'text-emerald-600' : 'text-red-600'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isConfirmingStudentUnlinkRequest ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                  {isConfirmingStudentUnlinkRequest ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                </div>
                <h4 className="font-extrabold text-base text-on-surface">
                  {isConfirmingStudentUnlinkRequest ? 'Đồng ý hủy liên kết?' : 'Gửi yêu cầu hủy liên kết?'}
                </h4>
              </div>

              <p className="text-sm text-on-surface-variant leading-relaxed">
                {isConfirmingStudentUnlinkRequest ? (
                  <>
                    Học sinh <strong className="text-on-surface">{confirmStudent?.name ?? 'đã chọn'}</strong> đã gửi yêu cầu hủy liên kết.
                    Khi bạn đồng ý, liên kết sẽ chuyển sang trạng thái đã hủy và bạn sẽ không còn xem được tiến độ, điểm số của con.
                  </>
                ) : (
                  <>
                    Hệ thống sẽ gửi yêu cầu hủy liên kết tới học sinh{' '}
                    <strong className="text-on-surface">{confirmStudent?.name ?? 'đã chọn'}</strong>. Liên kết chỉ bị hủy sau khi học sinh đồng ý.
                  </>
                )}
              </p>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmUnlinkId(null)}
                  disabled={unlinking}
                  className="px-4 py-2.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-sm font-bold text-on-surface-variant transition-colors disabled:opacity-60"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleExecuteUnlink}
                  disabled={unlinking}
                  className={`px-4 py-2.5 text-white rounded-xl text-sm font-bold transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2 ${
                    isConfirmingStudentUnlinkRequest
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                      : 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
                  }`}
                >
                  {unlinking && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isConfirmingStudentUnlinkRequest ? 'Đồng ý hủy' : 'Gửi yêu cầu'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

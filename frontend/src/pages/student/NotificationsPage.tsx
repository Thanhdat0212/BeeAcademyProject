import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  Loader2,
  Megaphone,
  RefreshCw,
  Trash2,
  UserRound,
  XCircle
} from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import PageBanner from '../../components/PageBanner';
import { notify } from '../../lib/toast';
import * as studentParentLinkService from '../../api/studentParentLinkService';
import { listUserNotifications, markUserNotificationRead } from '../../api/notificationService';
import type { StudentParentLinkInvitationResponse, UserNotification } from '../../types/api';

const relationshipLabels = {
  father: 'Cha',
  mother: 'Mẹ',
  guardian: 'Người giám hộ',
} as const;

function fallbackAvatar(name: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ffdbd1&color=7c2d12&bold=true&size=128`;
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

function invitationStatusText(invitation: StudentParentLinkInvitationResponse): string {
  if (invitation.expired || invitation.status === 'expired') return 'Yêu cầu đã hết hạn';
  return 'Đang chờ xác nhận';
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState<StudentParentLinkInvitationResponse[]>([]);
  const [linkedParents, setLinkedParents] = useState<StudentParentLinkInvitationResponse[]>([]);
  const [systemNotifications, setSystemNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [confirmUnlinkParent, setConfirmUnlinkParent] = useState<StudentParentLinkInvitationResponse | null>(null);
  const [unlinkReason, setUnlinkReason] = useState('');
  const actionableInvitationCount = invitations.filter(invitation => !invitation.expired).length;
  const expiredInvitationCount = invitations.length - actionableInvitationCount;
  const pendingUnlinkCount = linkedParents.filter(parent => parent.unlinkRequestedByRole === 'parent').length;
  const unreadSystemCount = systemNotifications.filter(item => !item.read).length;

  const loadInvitations = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [invitationData, parentData, notificationSummary] = await Promise.all([
        studentParentLinkService.getStudentParentLinkInvitations(),
        studentParentLinkService.getStudentLinkedParents(),
        listUserNotifications(false),
      ]);
      setInvitations(invitationData);
      setLinkedParents(parentData);
      setSystemNotifications(notificationSummary.notifications);
    } catch (error) {
      console.error('Lỗi khi tải thông báo lời mời phụ huynh:', error);
      notify.error(error instanceof Error ? error.message : 'Không thể tải thông báo.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleOpenSystemNotification = async (notification: UserNotification) => {
    if (!notification.read) {
      try {
        await markUserNotificationRead(notification.id);
        setSystemNotifications(items =>
          items.map(item => item.id === notification.id ? { ...item, read: true } : item)
        );
        window.dispatchEvent(new Event('bee:user-notifications-updated'));
      } catch (error) {
        console.error('Không thể đánh dấu thông báo đã đọc:', error);
      }
    }
    if (notification.targetUrl) navigate(notification.targetUrl);
  };

  useEffect(() => {
    loadInvitations();
  }, []);

  const handleInvitationAction = async (
    invitation: StudentParentLinkInvitationResponse,
    action: 'accept' | 'reject'
  ) => {
    const key = `${invitation.parentId}:${action}`;
    setActionKey(key);
    try {
      if (action === 'accept') {
        await studentParentLinkService.acceptStudentParentLinkInvitation(invitation.parentId);
        notify.success(`Đã chấp nhận liên kết với ${invitation.parentName}.`);
      } else {
        await studentParentLinkService.rejectStudentParentLinkInvitation(invitation.parentId);
        notify.success(`Đã từ chối lời mời từ ${invitation.parentName}.`);
      }
      setInvitations(current => current.filter(item => item.parentId !== invitation.parentId));
      window.dispatchEvent(new Event('bee:student-parent-link-invitations-updated'));
    } catch (error) {
      console.error('Lỗi khi xử lý lời mời liên kết phụ huynh:', error);
      notify.error(error instanceof Error ? error.message : 'Không thể xử lý lời mời.');
    } finally {
      setActionKey(null);
    }
  };

  const handleUnlinkAction = async () => {
    if (!confirmUnlinkParent) return;

    const parent = confirmUnlinkParent;
    const key = `${parent.parentId}:unlink`;
    setActionKey(key);
    try {
      await studentParentLinkService.unlinkStudentParent(parent.parentId, unlinkReason);
      setLinkedParents(current => current.filter(item => item.parentId !== parent.parentId));
      notify.success(`Đã hủy liên kết với ${parent.parentName}.`);
      setConfirmUnlinkParent(null);
      setUnlinkReason('');
      window.dispatchEvent(new Event('bee:student-parent-link-invitations-updated'));
    } catch (error) {
      console.error('Lỗi khi xử lý yêu cầu hủy liên kết phụ huynh:', error);
      notify.error(error instanceof Error ? error.message : 'Không thể xử lý yêu cầu hủy liên kết.');
    } finally {
      setActionKey(null);
    }
  };

  const handleConsentToggle = async (parent: StudentParentLinkInvitationResponse) => {
    const nextValue = !parent.sensitiveDataConsentGranted;
    const key = `${parent.parentId}:consent`;
    setActionKey(key);
    try {
      const updated = await studentParentLinkService.updateSensitiveDataConsent(parent.parentId, nextValue);
      setLinkedParents(current => current.map(item => item.parentId === parent.parentId ? updated : item));
      notify.success(
        nextValue
          ? `Đã cho phép ${parent.parentName} xem dữ liệu học tập nhạy cảm.`
          : `Đã tắt quyền xem dữ liệu học tập nhạy cảm của ${parent.parentName}.`
      );
    } catch (error) {
      console.error('Lỗi khi cập nhật quyền xem dữ liệu nhạy cảm:', error);
      notify.error(error instanceof Error ? error.message : 'Không thể cập nhật quyền xem dữ liệu nhạy cảm.');
    } finally {
      setActionKey(null);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <DashboardHeader />

      <PageBanner
        title="Thông báo"
        subtitle="Theo dõi lời mời liên kết phụ huynh và các cập nhật quan trọng dành cho tài khoản học sinh."
      />

      <div className="flex-grow max-w-[1100px] mx-auto w-full px-4 md:px-10 py-8">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm"
        >
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 border-b border-outline-variant/20 pb-5">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-extrabold uppercase tracking-wide">
                <Megaphone className="w-3.5 h-3.5" />
                Thông báo hệ thống
              </div>
              <h2 className="mt-3 text-2xl font-extrabold text-on-surface">
                Thông báo từ Bee Academy ({unreadSystemCount})
              </h2>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant max-w-2xl">
                Các thông báo và cập nhật quan trọng được Bee Academy gửi tới bạn.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="min-h-[160px] flex items-center justify-center">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface-variant">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Đang tải thông báo...
              </div>
            </div>
          ) : systemNotifications.length === 0 ? (
            <div className="min-h-[160px] flex flex-col items-center justify-center text-center px-6">
              <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center mb-4">
                <Megaphone className="w-6 h-6 text-on-surface-variant/45" />
              </div>
              <p className="text-sm font-extrabold text-on-surface">Chưa có thông báo hệ thống nào.</p>
            </div>
          ) : (
            <div className="pt-5 space-y-3">
              {systemNotifications.map(notification => (
                <button
                  key={notification.id}
                  onClick={() => handleOpenSystemNotification(notification)}
                  className={`w-full text-left p-4 rounded-2xl border transition-colors flex gap-3 ${
                    notification.read
                      ? 'border-outline-variant/20 bg-surface-container-low/40 hover:bg-surface-container-low/70'
                      : 'border-primary/30 bg-primary/5 hover:bg-primary/10'
                  }`}
                >
                  <span
                    className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      notification.read ? 'bg-outline-variant' : 'bg-red-500'
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold text-on-surface line-clamp-1">
                      {notification.title}
                    </span>
                    <span className="block text-sm text-on-surface-variant mt-0.5 line-clamp-3">
                      {notification.body}
                    </span>
                    <span className="block text-xs text-on-surface-variant/70 mt-1.5">
                      {formatDateTime(notification.createdAt)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm"
        >
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 border-b border-outline-variant/20 pb-5">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-extrabold uppercase tracking-wide">
                <Bell className="w-3.5 h-3.5" />
                Liên kết phụ huynh
              </div>
              <h2 className="mt-3 text-2xl font-extrabold text-on-surface">
                Yêu cầu phụ huynh cần xử lý ({actionableInvitationCount + pendingUnlinkCount})
              </h2>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant max-w-2xl">
                Quản lý lời mời liên kết và xác nhận hủy liên kết với phụ huynh trên Bee Academy.
                {expiredInvitationCount > 0 && ` ${expiredInvitationCount} lời mời đã hết hạn.`}
              </p>
            </div>

            <button
              onClick={() => loadInvitations()}
              disabled={loading}
              className="h-11 w-11 rounded-xl border border-outline-variant/30 bg-surface text-on-surface-variant hover:bg-surface-container-low transition-colors flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
              title="Làm mới"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="min-h-[280px] flex items-center justify-center">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface-variant">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Đang tải thông báo...
              </div>
            </div>
          ) : invitations.length === 0 ? (
            <div className="min-h-[280px] flex flex-col items-center justify-center text-center px-6">
              <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-4">
                <Bell className="w-7 h-7 text-on-surface-variant/45" />
              </div>
              <p className="text-base font-extrabold text-on-surface">Bạn chưa có lời mời liên kết nào.</p>
              <p className="text-sm text-on-surface-variant mt-1 max-w-md">
                Khi phụ huynh gửi lời mời qua email của bạn, yêu cầu xác nhận sẽ xuất hiện tại đây.
              </p>
            </div>
          ) : (
            <div className="pt-5 space-y-4">
              {invitations.map(invitation => {
                const expired = invitation.expired || invitation.status === 'expired';
                return (
                <div
                  key={invitation.parentId}
                  data-testid={`parent-link-invitation-${invitation.parentId}`}
                  className={`p-4 rounded-2xl border border-outline-variant/20 bg-surface-container-low/40 ${expired ? 'opacity-75' : ''}`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={invitation.avatarUrl || fallbackAvatar(invitation.parentName)}
                        alt={invitation.parentName}
                        className="w-12 h-12 rounded-full object-cover border border-outline-variant/20 bg-surface-container flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-sm text-on-surface truncate">
                          {invitation.parentName}
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant">
                          <span>{invitation.parentEmail}</span>
                          <span>{relationshipLabels[invitation.relationship]}</span>
                          <span>Hết hạn: {formatDateTime(invitation.expiresAt)}</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="w-3.5 h-3.5" />
                            Gửi lúc: {formatDateTime(invitation.invitedAt)}
                          </span>
                        </div>
                        {invitation.note && (
                          <p className="mt-2 text-xs text-on-surface-variant line-clamp-2">
                            {invitation.note}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 text-amber-700 text-xs font-extrabold">
                        <UserRound className="w-4 h-4" />
                        Đang chờ xác nhận
                      </span>
                      {expired && (
                        <span
                          data-testid={`parent-link-expired-${invitation.parentId}`}
                          className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-500/10 text-slate-700 text-xs font-extrabold"
                        >
                          {invitationStatusText(invitation)}
                        </span>
                      )}
                      <button
                        data-testid={`reject-parent-link-${invitation.parentId}`}
                        onClick={() => handleInvitationAction(invitation, 'reject')}
                        disabled={actionKey !== null || expired}
                        className="h-10 px-4 rounded-xl border border-red-200/50 bg-red-50 text-red-600 text-xs font-extrabold hover:bg-red-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                      >
                        {actionKey === `${invitation.parentId}:reject` ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        Từ chối
                      </button>
                      <button
                        data-testid={`accept-parent-link-${invitation.parentId}`}
                        onClick={() => handleInvitationAction(invitation, 'accept')}
                        disabled={actionKey !== null || expired}
                        className="h-10 px-4 rounded-xl bg-primary text-on-primary text-xs font-extrabold hover:bg-primary/95 transition-colors shadow-md shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                      >
                        {actionKey === `${invitation.parentId}:accept` ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        Chấp nhận
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </motion.section>

        {!loading && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mt-6 bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm"
          >
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 border-b border-outline-variant/20 pb-5">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant text-xs font-extrabold uppercase tracking-wide">
                  <UserRound className="w-3.5 h-3.5" />
                  Phụ huynh đã liên kết
                </div>
                <h2 className="mt-3 text-xl font-extrabold text-on-surface">
                  Quản lý liên kết đang hoạt động ({linkedParents.length})
                </h2>
              </div>
            </div>

            {linkedParents.length === 0 ? (
              <div className="min-h-[180px] flex flex-col items-center justify-center text-center px-6">
                <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center mb-4">
                  <UserRound className="w-6 h-6 text-on-surface-variant/45" />
                </div>
                <p className="text-sm font-extrabold text-on-surface">Bạn chưa có phụ huynh nào đang liên kết.</p>
              </div>
            ) : (
              <div className="pt-5 space-y-4">
                {linkedParents.map(parent => {
                  const actionKeyValue = `${parent.parentId}:unlink`;
                  const consentKeyValue = `${parent.parentId}:consent`;

                  return (
                    <div
                      key={parent.parentId}
                      className="p-4 rounded-2xl border border-outline-variant/20 bg-surface-container-low/40"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={parent.avatarUrl || fallbackAvatar(parent.parentName)}
                            alt={parent.parentName}
                            className="w-12 h-12 rounded-full object-cover border border-outline-variant/20 bg-surface-container flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <h3 className="font-extrabold text-sm text-on-surface truncate">
                              {parent.parentName}
                            </h3>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant">
                              <span>{parent.parentEmail}</span>
                              <span>Đã liên kết</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() => handleConsentToggle(parent)}
                            disabled={actionKey !== null}
                            className={`h-10 px-4 rounded-xl text-xs font-extrabold transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 ${
                              parent.sensitiveDataConsentGranted
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-500/20'
                                : 'border border-outline-variant/30 bg-surface text-on-surface-variant hover:bg-surface-container'
                            }`}
                          >
                            {actionKey === consentKeyValue ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : parent.sensitiveDataConsentGranted ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                            {parent.sensitiveDataConsentGranted ? 'Đang cho xem dữ liệu nhạy cảm' : 'Cho xem dữ liệu nhạy cảm'}
                          </button>

                        <button
                          onClick={() => setConfirmUnlinkParent(parent)}
                          disabled={actionKey !== null}
                          className="h-10 px-4 rounded-xl text-xs font-extrabold transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 border border-red-200/50 bg-red-50 text-red-600 hover:bg-red-100"
                        >
                          {actionKey === actionKeyValue ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          Hủy liên kết
                        </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.section>
        )}
        <AnimatePresence>
          {confirmUnlinkParent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-surface-container-lowest border border-outline-variant/40 rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-6"
              >
                <div className="flex items-center gap-3 text-red-600">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/10">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <h4 className="font-extrabold text-base text-on-surface">Xác nhận hủy liên kết?</h4>
                </div>

                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Liên kết với <strong className="text-on-surface">{confirmUnlinkParent.parentName}</strong> sẽ chuyển sang trạng thái đã hủy ngay.
                  Phụ huynh sẽ không thể xem tiến độ, liên hệ giáo viên hoặc xem lịch sử thanh toán của bạn.
                </p>

                <label className="block space-y-2">
                  <span className="text-xs font-bold text-on-surface-variant">Lý do (tùy chọn)</span>
                  <textarea
                    value={unlinkReason}
                    onChange={event => setUnlinkReason(event.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Nhập lý do hủy liên kết"
                    className="w-full resize-none rounded-xl border border-outline-variant/40 bg-surface px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
                  />
                  <span className="block text-right text-[11px] text-on-surface-variant">{unlinkReason.length}/500</span>
                </label>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setConfirmUnlinkParent(null);
                      setUnlinkReason('');
                    }}
                    disabled={actionKey !== null}
                    className="px-4 py-2.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-sm font-bold text-on-surface-variant transition-colors disabled:opacity-60"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    onClick={handleUnlinkAction}
                    disabled={actionKey !== null}
                    className="px-4 py-2.5 text-white rounded-xl text-sm font-bold transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 shadow-red-500/20"
                  >
                    {actionKey !== null && <Loader2 className="w-4 h-4 animate-spin" />}
                    Xác nhận hủy
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Bell,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  Trash2,
  UserRound,
  XCircle
} from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import PageBanner from '../../components/PageBanner';
import { notify } from '../../lib/toast';
import * as studentParentLinkService from '../../api/studentParentLinkService';
import type { StudentParentLinkInvitationResponse } from '../../types/api';

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

export default function NotificationsPage() {
  const [invitations, setInvitations] = useState<StudentParentLinkInvitationResponse[]>([]);
  const [linkedParents, setLinkedParents] = useState<StudentParentLinkInvitationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const pendingUnlinkCount = linkedParents.filter(parent => parent.unlinkRequestedByRole === 'parent').length;

  const loadInvitations = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [invitationData, parentData] = await Promise.all([
        studentParentLinkService.getStudentParentLinkInvitations(),
        studentParentLinkService.getStudentLinkedParents(),
      ]);
      setInvitations(invitationData);
      setLinkedParents(parentData);
    } catch (error) {
      console.error('Lỗi khi tải thông báo lời mời phụ huynh:', error);
      notify.error(error instanceof Error ? error.message : 'Không thể tải thông báo.');
    } finally {
      if (showLoading) setLoading(false);
    }
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

  const handleUnlinkAction = async (
    parent: StudentParentLinkInvitationResponse,
    action: 'request' | 'confirm'
  ) => {
    const key = `${parent.parentId}:unlink:${action}`;
    setActionKey(key);
    try {
      const updated = action === 'confirm'
        ? await studentParentLinkService.confirmStudentParentUnlink(parent.parentId)
        : await studentParentLinkService.requestStudentParentUnlink(parent.parentId);

      if (updated.status === 'rejected') {
        setLinkedParents(current => current.filter(item => item.parentId !== parent.parentId));
        notify.success(`Đã hủy liên kết với ${parent.parentName}.`);
      } else {
        setLinkedParents(current => current.map(item => item.parentId === parent.parentId ? updated : item));
        notify.success(`Đã gửi yêu cầu hủy liên kết tới ${parent.parentName}. Cần phụ huynh đồng ý để hoàn tất.`);
      }
      window.dispatchEvent(new Event('bee:student-parent-link-invitations-updated'));
    } catch (error) {
      console.error('Lỗi khi xử lý yêu cầu hủy liên kết phụ huynh:', error);
      notify.error(error instanceof Error ? error.message : 'Không thể xử lý yêu cầu hủy liên kết.');
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
          className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm"
        >
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 border-b border-outline-variant/20 pb-5">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-extrabold uppercase tracking-wide">
                <Bell className="w-3.5 h-3.5" />
                Liên kết phụ huynh
              </div>
              <h2 className="mt-3 text-2xl font-extrabold text-on-surface">
                Yêu cầu phụ huynh cần xử lý ({invitations.length + pendingUnlinkCount})
              </h2>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant max-w-2xl">
                Quản lý lời mời liên kết và xác nhận hủy liên kết với phụ huynh trên Bee Academy.
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
              {invitations.map(invitation => (
                <div
                  key={invitation.parentId}
                  className="p-4 rounded-2xl border border-outline-variant/20 bg-surface-container-low/40"
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
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="w-3.5 h-3.5" />
                            Gửi lúc: {formatDateTime(invitation.invitedAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 text-amber-700 text-xs font-extrabold">
                        <UserRound className="w-4 h-4" />
                        Đang chờ xác nhận
                      </span>
                      <button
                        onClick={() => handleInvitationAction(invitation, 'reject')}
                        disabled={actionKey !== null}
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
                        onClick={() => handleInvitationAction(invitation, 'accept')}
                        disabled={actionKey !== null}
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
              ))}
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
                  const parentRequested = parent.unlinkRequestedByRole === 'parent';
                  const studentRequested = parent.unlinkRequestedByRole === 'student';
                  const actionKeyValue = `${parent.parentId}:unlink:${parentRequested ? 'confirm' : 'request'}`;

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
                              <span>
                                {parentRequested
                                  ? 'Phụ huynh đang yêu cầu hủy'
                                  : studentRequested
                                    ? 'Đang chờ phụ huynh đồng ý hủy'
                                    : 'Đã liên kết'}
                              </span>
                              {parent.unlinkRequestedAt && (
                                <span>Yêu cầu lúc: {formatDateTime(parent.unlinkRequestedAt)}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleUnlinkAction(parent, parentRequested ? 'confirm' : 'request')}
                          disabled={actionKey !== null || studentRequested}
                          className={`h-10 px-4 rounded-xl text-xs font-extrabold transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 ${
                            parentRequested
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-500/20'
                              : studentRequested
                                ? 'border border-amber-200/60 bg-amber-50 text-amber-700'
                                : 'border border-red-200/50 bg-red-50 text-red-600 hover:bg-red-100'
                          }`}
                        >
                          {actionKey === actionKeyValue ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : parentRequested ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : studentRequested ? (
                            <Clock3 className="w-4 h-4" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          {parentRequested ? 'Đồng ý hủy' : studentRequested ? 'Đang chờ' : 'Gửi yêu cầu hủy'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.section>
        )}
      </div>
    </div>
  );
}

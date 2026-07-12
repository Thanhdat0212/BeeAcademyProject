import { useEffect, useRef, useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { listUserNotifications, markUserNotificationRead } from '../api/notificationService';
import type { UserNotification } from '../types/api';

function formatNotificationTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

function notificationTypeLabel(type: string) {
  switch (type) {
    case 'parent_teacher_message':
      return 'Tin nhắn phụ huynh';
    case 'course_approved':
      return 'Duyệt khóa học';
    case 'course_rejected':
      return 'Từ chối khóa học';
    case 'course_revision_requested':
      return 'Yêu cầu chỉnh sửa';
    case 'course_purchased':
      return 'Mua khóa học';
    case 'system':
      return 'Hệ thống';
    default:
      return 'Thông báo';
  }
}

export default function TeacherNotificationBell() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);

  async function loadNotifications(markRead = false) {
    setLoading(true);
    try {
      const summary = await listUserNotifications(false);
      let nextNotifications = summary.notifications;
      let nextUnreadCount = summary.unreadCount;

      if (markRead) {
        const unread = nextNotifications.filter(notification => !notification.read);
        if (unread.length > 0) {
          await Promise.allSettled(unread.map(notification => markUserNotificationRead(notification.id)));
          nextNotifications = nextNotifications.map(notification => ({ ...notification, read: true }));
          nextUnreadCount = 0;
        }
      }

      setNotifications(nextNotifications);
      setUnreadCount(nextUnreadCount);
    } catch (error) {
      console.error('Khong the tai thong bao giao vien:', error);
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
    const reload = () => loadNotifications();
    window.addEventListener('bee:user-notifications-updated', reload);
    window.addEventListener('focus', reload);
    const intervalId = window.setInterval(reload, 15000);
    return () => {
      window.removeEventListener('bee:user-notifications-updated', reload);
      window.removeEventListener('focus', reload);
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function toggleOpen() {
    const shouldOpen = !open;
    setOpen(shouldOpen);
    if (shouldOpen) {
      await loadNotifications(true);
    }
  }

  async function openNotification(notification: UserNotification) {
    if (!notification.read) {
      try {
        await markUserNotificationRead(notification.id);
      } catch (error) {
        console.error('Khong the danh dau thong bao da doc:', error);
      }
      setNotifications(items =>
        items.map(item => item.id === notification.id ? { ...item, read: true } : item)
      );
      setUnreadCount(count => Math.max(0, count - 1));
    }

    if (notification.targetUrl) {
      setOpen(false);
      navigate(notification.targetUrl);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className="relative text-on-surface-variant hover:text-primary transition-colors"
        title="Thông báo"
        aria-label="Thông báo"
        aria-expanded={open}
      >
        <Bell className="w-5 h-5" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key={unreadCount}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-2 -right-2 min-w-5 h-5 px-1 bg-red-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center border-2 border-surface"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-3 w-[min(92vw,390px)] max-h-[70vh] overflow-hidden bg-surface border border-outline-variant/40 rounded-2xl shadow-2xl shadow-black/15 z-50"
          >
            <div className="px-4 py-3 border-b border-outline-variant/30 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-on-surface">Thông báo</p>
                <p className="text-xs text-on-surface-variant">
                  {unreadCount > 0 ? `${unreadCount} thông báo mới` : 'Đã đọc tất cả'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadNotifications(true)}
                className="text-xs font-bold text-primary hover:bg-primary/8 px-3 py-1.5 rounded-full transition-colors"
              >
                Làm mới
              </button>
            </div>

            <div className="max-h-[56vh] overflow-y-auto py-2">
              {loading && notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-on-surface-variant">
                  <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin text-primary" />
                  Đang tải thông báo...
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-on-surface-variant">
                  Chưa có thông báo
                </div>
              ) : (
                notifications.map(notification => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => openNotification(notification)}
                    className="w-full px-4 py-3 text-left hover:bg-surface-container transition-colors flex gap-3"
                  >
                    <span
                      className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                        notification.read ? 'bg-outline-variant' : 'bg-red-500'
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-primary mb-1">
                        {notificationTypeLabel(notification.type)}
                      </span>
                      <span className="block text-sm font-bold text-on-surface line-clamp-1">
                        {notification.title}
                      </span>
                      <span className="block text-sm text-on-surface-variant line-clamp-2">
                        {notification.body}
                      </span>
                      <span className="block text-xs text-on-surface-variant/70 mt-1">
                        {formatNotificationTime(notification.createdAt)}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

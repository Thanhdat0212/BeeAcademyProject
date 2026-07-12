import { apiClient, unwrap } from './client';
import type { ApiResponse, UserNotification, UserNotificationSummary } from '../types/api';

export async function listUserNotifications(unreadOnly = false): Promise<UserNotificationSummary> {
  const res = await apiClient.get<ApiResponse<UserNotificationSummary>>(
    '/api/notifications',
    { params: { unreadOnly } },
  );
  return unwrap(res.data);
}

export async function markUserNotificationRead(notificationId: string): Promise<UserNotification> {
  const res = await apiClient.patch<ApiResponse<UserNotification>>(
    `/api/notifications/${encodeURIComponent(notificationId)}/read`,
  );
  return unwrap(res.data);
}

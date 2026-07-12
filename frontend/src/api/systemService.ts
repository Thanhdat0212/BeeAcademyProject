import { apiClient, unwrap } from './client';
import type {
  ApiResponse,
  SystemSettings,
  SystemStatus,
  UpdateSystemSettingsPayload,
} from '../types/api';

export async function getSystemStatus(): Promise<SystemStatus> {
  const res = await apiClient.get<ApiResponse<SystemStatus>>('/api/system/status');
  return unwrap(res.data);
}

export async function getSystemSettings(): Promise<SystemSettings> {
  const res = await apiClient.get<ApiResponse<SystemSettings>>('/api/admin/system-settings');
  return unwrap(res.data);
}

export async function updateSystemSettings(
  payload: UpdateSystemSettingsPayload,
): Promise<SystemSettings> {
  const res = await apiClient.put<ApiResponse<SystemSettings>>('/api/admin/system-settings', payload);
  return unwrap(res.data);
}

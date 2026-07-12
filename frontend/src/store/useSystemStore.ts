import { create } from 'zustand';

interface SystemState {
  maintenanceMode: boolean;
  /** ISO string mốc dự kiến hoàn tất bảo trì, do backend tính - null khi tắt. */
  maintenanceUntil: string | null;
  setMaintenanceMode: (value: boolean) => void;
  setMaintenanceUntil: (value: string | null) => void;
}

export const useSystemStore = create<SystemState>((set) => ({
  maintenanceMode: false,
  maintenanceUntil: null,
  setMaintenanceMode: (value) => set({ maintenanceMode: value }),
  setMaintenanceUntil: (value) => set({ maintenanceUntil: value }),
}));

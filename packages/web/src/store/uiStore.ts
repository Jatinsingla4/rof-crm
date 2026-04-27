import { create } from 'zustand';

interface UIStore {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
  }>;
  addNotification: (notification: Omit<UIStore['notifications'][0], 'id'>) => void;
  removeNotification: (id: string) => void;
}

/**
 * UI Store (Zustand)
 * Client-side UI state (sidebar, notifications, etc.)
 */
export const useUiStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  notifications: [],
  addNotification: (notification) =>
    set((state) => ({
      notifications: [...state.notifications, { ...notification, id: Date.now().toString() }],
    })),
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}));

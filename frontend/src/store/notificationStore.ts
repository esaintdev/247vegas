import { create } from "zustand";
import apiClient from "@/api/client";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;

  fetchNotifications: (unreadOnly?: boolean) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  pollingInterval: ReturnType<typeof setInterval> | null;
  startPolling: () => void;
  stopPolling: () => void;
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  pollingInterval: null,

  fetchNotifications: async (unreadOnly = false) => {
    set({ isLoading: true });
    try {
      const url = unreadOnly
        ? "/notifications/?unread_only=true&limit=50"
        : "/notifications/?limit=50";
      const { data } = await apiClient.get<Notification[]>(url);
      set({ notifications: data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const { data } = await apiClient.get<{ count: number }>(
        "/notifications/unread-count",
      );
      set({ unreadCount: data.count });
    } catch {
      // Silent fail
    }
  },

  markAsRead: async (id) => {
    try {
      await apiClient.post(`/notifications/${id}/read`);
      const { notifications, unreadCount } = get();
      set({
        notifications: notifications.map((n) =>
          n.id === id ? { ...n, is_read: true } : n,
        ),
        unreadCount: Math.max(0, unreadCount - 1),
      });
    } catch {
      // Silent fail
    }
  },

  markAllAsRead: async () => {
    try {
      await apiClient.post("/notifications/read-all");
      set({
        notifications: get().notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
      });
    } catch {
      // Silent fail
    }
  },

  startPolling: () => {
    const existing = get().pollingInterval;
    if (existing) return;
    const interval = setInterval(() => {
      get().fetchUnreadCount();
    }, 15000); // Poll every 15 seconds
    set({ pollingInterval: interval });
  },

  stopPolling: () => {
    const { pollingInterval } = get();
    if (pollingInterval) {
      clearInterval(pollingInterval);
      set({ pollingInterval: null });
    }
  },
}));

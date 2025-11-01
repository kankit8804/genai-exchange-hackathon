"use client";

import { create } from "zustand";

interface Notification {
  id: string;
  message: string;
  isFailed?: boolean;
}

interface NotificationStore {
  notifications: Notification[];
  showNotification: (message: string, isFailed?: boolean) => void;
  removeNotification: (id: string) => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  showNotification: (message, isFailed = false) => {
    const id = Math.random().toString(36).substr(2, 9);
    set((state) => ({
      notifications: [...state.notifications, { id, message, isFailed }],
    }));

    // Auto-remove after 4s
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      }));
    }, 4000);
  },
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}));

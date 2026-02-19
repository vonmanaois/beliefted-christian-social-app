import { create } from "zustand";

type UIState = {
  signInOpen: boolean;
  preferencesOpen: boolean;
  newWordPosts: boolean;
  newPrayerPosts: boolean;
  activeHomeTab: "words" | "prayers" | "following";
  lastSeenNotificationsCount: number;
  notificationsBadgeCount: number;
  openSignIn: () => void;
  closeSignIn: () => void;
  toggleSignIn: () => void;
  openPreferences: () => void;
  closePreferences: () => void;
  togglePreferences: () => void;
  setNewWordPosts: (value: boolean) => void;
  setNewPrayerPosts: (value: boolean) => void;
  setActiveHomeTab: (value: "words" | "prayers" | "following") => void;
  setLastSeenNotificationsCount: (value: number) => void;
  incrementNotificationsBadge: (amount?: number) => void;
  setNotificationsBadgeCount: (value: number) => void;
  clearNotificationsBadge: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  signInOpen: false,
  preferencesOpen: false,
  newWordPosts: false,
  newPrayerPosts: false,
  activeHomeTab: "words",
  lastSeenNotificationsCount: 0,
  notificationsBadgeCount: 0,
  openSignIn: () => set({ signInOpen: true }),
  closeSignIn: () => set({ signInOpen: false }),
  toggleSignIn: () => set((state) => ({ signInOpen: !state.signInOpen })),
  openPreferences: () => set({ preferencesOpen: true }),
  closePreferences: () => set({ preferencesOpen: false }),
  togglePreferences: () =>
    set((state) => ({ preferencesOpen: !state.preferencesOpen })),
  setNewWordPosts: (value) => set({ newWordPosts: value }),
  setNewPrayerPosts: (value) => set({ newPrayerPosts: value }),
  setActiveHomeTab: (value) => set({ activeHomeTab: value }),
  setLastSeenNotificationsCount: (value) => set({ lastSeenNotificationsCount: value }),
  incrementNotificationsBadge: (amount = 1) =>
    set((state) => ({
      notificationsBadgeCount: state.notificationsBadgeCount + amount,
    })),
  setNotificationsBadgeCount: (value) =>
    set({ notificationsBadgeCount: Math.max(0, value) }),
  clearNotificationsBadge: () => set({ notificationsBadgeCount: 0 }),
}));

import { create } from "zustand";

type UIState = {
  signInOpen: boolean;
  preferencesOpen: boolean;
  newWordPosts: boolean;
  newPrayerPosts: boolean;
  lastSeenNotificationsCount: number;
  openSignIn: () => void;
  closeSignIn: () => void;
  toggleSignIn: () => void;
  openPreferences: () => void;
  closePreferences: () => void;
  togglePreferences: () => void;
  setNewWordPosts: (value: boolean) => void;
  setNewPrayerPosts: (value: boolean) => void;
  setLastSeenNotificationsCount: (value: number) => void;
};

export const useUIStore = create<UIState>((set) => ({
  signInOpen: false,
  preferencesOpen: false,
  newWordPosts: false,
  newPrayerPosts: false,
  lastSeenNotificationsCount: 0,
  openSignIn: () => set({ signInOpen: true }),
  closeSignIn: () => set({ signInOpen: false }),
  toggleSignIn: () => set((state) => ({ signInOpen: !state.signInOpen })),
  openPreferences: () => set({ preferencesOpen: true }),
  closePreferences: () => set({ preferencesOpen: false }),
  togglePreferences: () =>
    set((state) => ({ preferencesOpen: !state.preferencesOpen })),
  setNewWordPosts: (value) => set({ newWordPosts: value }),
  setNewPrayerPosts: (value) => set({ newPrayerPosts: value }),
  setLastSeenNotificationsCount: (value) => set({ lastSeenNotificationsCount: value }),
}));

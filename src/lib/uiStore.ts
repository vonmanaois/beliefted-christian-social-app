import { create } from "zustand";

type UIState = {
  signInOpen: boolean;
  preferencesOpen: boolean;
  openSignIn: () => void;
  closeSignIn: () => void;
  toggleSignIn: () => void;
  openPreferences: () => void;
  closePreferences: () => void;
  togglePreferences: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  signInOpen: false,
  preferencesOpen: false,
  openSignIn: () => set({ signInOpen: true }),
  closeSignIn: () => set({ signInOpen: false }),
  toggleSignIn: () => set((state) => ({ signInOpen: !state.signInOpen })),
  openPreferences: () => set({ preferencesOpen: true }),
  closePreferences: () => set({ preferencesOpen: false }),
  togglePreferences: () =>
    set((state) => ({ preferencesOpen: !state.preferencesOpen })),
}));

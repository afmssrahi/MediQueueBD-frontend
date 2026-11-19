"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { SESSION_STORAGE_KEY } from "@/lib/constants";
import type { PublicUser, Role } from "@/types";

interface SessionState {
  user: PublicUser | null;
  /** True when the user chose "keep me signed in". */
  remembered: boolean;
  signIn: (user: PublicUser, remembered?: boolean) => void;
  signOut: () => void;
  updateProfile: (patch: Partial<PublicUser>) => void;
  setRemembered: (remembered: boolean) => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      remembered: false,
      signIn: (user, remembered = false) =>
        set({ user, remembered }),
      signOut: () => set({ user: null, remembered: false }),
      updateProfile: (patch) =>
        set((state) =>
          state.user ? { user: { ...state.user, ...patch } } : state,
        ),
      setRemembered: (remembered) => set({ remembered }),
    }),
    {
      name: SESSION_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        remembered: state.remembered,
      }),
    },
  ),
);

/** The signed-in user's role, or null. */
export function useRole(): Role | null {
  return useSession((state) => state.user?.role ?? null);
}

/** The signed-in user's id, or null. */
export function useUserId(): string | null {
  return useSession((state) => state.user?.id ?? null);
}

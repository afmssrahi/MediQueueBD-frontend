"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { UI_STORAGE_KEY } from "@/lib/constants";

export type Theme = "light" | "dark";
export type TableDensity = "comfortable" | "compact";

interface UiState {
  theme: Theme;
  sidebarCollapsed: boolean;
  tableDensity: TableDensity;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setTableDensity: (density: TableDensity) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set, get) => ({
      theme: "light",
      sidebarCollapsed: false,
      tableDensity: "comfortable",
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
      toggleTheme: () => {
        const next = get().theme === "light" ? "dark" : "light";
        set({ theme: next });
        applyTheme(next);
      },
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setTableDensity: (tableDensity) => set({ tableDensity }),
    }),
    {
      name: UI_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        tableDensity: state.tableDensity,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    },
  ),
);

/** Reflect the theme on the document element. */
export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  root.style.colorScheme = theme;
}

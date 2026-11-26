"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/i18n/provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUi } from "@/stores/ui";
import {
  subscribeToDemoDbChanges,
  watchStorageForChanges,
} from "@/demo/sync";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

/**
 * Apply the persisted theme before the first paint.
 *
 * Without this the page renders light and then flips to dark once the store
 * rehydrates, which is visible on every reload.
 */
function ThemeScript() {
  React.useEffect(() => {
    const stored = useUi.getState().theme;
    if (stored === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
    }
  }, []);
  return null;
}

/**
 * Keep the screens in step with the demo database.
 *
 * Two things can change the data under a screen:
 *
 *   - a mutation made in this tab — the demo bus announces it;
 *   - a mutation made in another tab — the browser's `storage` event does.
 *
 * Either way the affected queries are invalidated, so a booking made on the
 * reception screen appears on the patient's list without a manual refresh.
 */
function DemoDatabaseSync({ queryClient }: { queryClient: QueryClient }) {
  React.useEffect(() => {
    const invalidate = (keys: string[][]) => {
      for (const key of keys) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    };

    const unsubscribe = subscribeToDemoDbChanges((change) => {
      if (change.kind === "appointments" || change.kind === "all") {
        invalidate([["appointments"], ["slots"]]);
      }
      if (change.kind === "queue" || change.kind === "all") {
        invalidate([["queue"]]);
      }
      if (change.kind === "notifications" || change.kind === "all") {
        invalidate([["notifications"]]);
      }
    });

    const stopWatching = watchStorageForChanges(() => {
      void queryClient.invalidateQueries();
    });

    return () => {
      unsubscribe();
      stopWatching();
    };
  }, [queryClient]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <TooltipProvider delayDuration={200}>
          <ThemeScript />
          <DemoDatabaseSync queryClient={queryClient} />
          {children}
          <Toaster />
        </TooltipProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

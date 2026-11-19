"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/stores/session";
import { homeRouteFor } from "@/lib/rbac";
import { useHydrated } from "@/lib/use-hydrated";
import type { Role } from "@/types";

interface RouteGuardProps {
  /** The roles allowed on this route group. */
  allow: Role[];
  children: React.ReactNode;
}

/**
 * The route guard.
 *
 * An unauthenticated visitor is sent to `/login`; an authenticated visitor
 * on the wrong role's route is sent to their own dashboard. This is a UI
 * guard only — the backend enforces the same rules once it exists.
 */
export function RouteGuard({ allow, children }: RouteGuardProps) {
  const router = useRouter();
  const user = useSession((state) => state.user);
  // The persisted session rehydrates after the first render, so the guard
  // waits for hydration before deciding.
  const hydrated = useHydrated();

  React.useEffect(() => {
    if (!hydrated) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!allow.includes(user.role)) {
      router.replace(homeRouteFor(user.role));
    }
  }, [hydrated, user, allow, router]);

  if (!hydrated || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!allow.includes(user.role)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Redirecting…
      </div>
    );
  }

  return <>{children}</>;
}

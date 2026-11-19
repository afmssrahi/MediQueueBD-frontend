"use client";

import * as React from "react";
import { useSession } from "@/stores/session";
import { can, type Permission } from "@/lib/rbac";

interface RoleGateProps {
  /** The permission required to see the children. */
  permission?: Permission;
  /** Alternative: allow these roles explicitly. */
  roles?: string[];
  children: React.ReactNode;
  /** What to render when the check fails. */
  fallback?: React.ReactNode;
}

/**
 * Renders its children only when the signed-in user holds the permission.
 *
 * This is a UI convenience, not a security boundary — the backend enforces
 * the same rules once it exists.
 */
export function RoleGate({
  permission,
  roles,
  children,
  fallback = null,
}: RoleGateProps) {
  const role = useSession((state) => state.user?.role ?? null);

  const allowed = React.useMemo(() => {
    if (!role) return false;
    if (roles && roles.includes(role)) return true;
    if (permission) return can(role, permission);
    return false;
  }, [role, roles, permission]);

  return <>{allowed ? children : fallback}</>;
}

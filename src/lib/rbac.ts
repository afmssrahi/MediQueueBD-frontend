import { ROLE_META, type Role } from "@/types";

/**
 * Role → permission map.
 *
 * The frontend uses this to decide what to render. It is a UI convenience,
 * not a security boundary — the backend will enforce the same rules.
 */

export const PERMISSIONS = [
  "appointment:book",
  "appointment:read:own",
  "appointment:read:all",
  "appointment:cancel:own",
  "appointment:manage",
  "queue:read:own",
  "queue:read:hospital",
  "queue:manage",
  "record:read:own",
  "record:read:all",
  "record:write",
  "prescription:read:own",
  "prescription:write",
  "report:read:own",
  "report:read:all",
  "report:manage",
  "diagnostic:search",
  "hospital:read",
  "hospital:register",
  "hospital:manage",
  "doctor:read",
  "doctor:manage",
  "department:manage",
  "staff:manage",
  "notification:read:own",
  "ai-summary:read",
  "ai-summary:generate",
  "admin:users",
  "admin:hospitals",
  "admin:diagnostics",
  "admin:settings",
  "analytics:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const PATIENT_PERMISSIONS: Permission[] = [
  "appointment:book",
  "appointment:read:own",
  "appointment:cancel:own",
  "queue:read:own",
  "record:read:own",
  "prescription:read:own",
  "report:read:own",
  "hospital:read",
  "doctor:read",
  "notification:read:own",
  "ai-summary:read",
  "ai-summary:generate",
];

const DOCTOR_PERMISSIONS: Permission[] = [
  "appointment:read:own",
  "appointment:read:all",
  "queue:read:own",
  "queue:read:hospital",
  "queue:manage",
  "record:read:all",
  "record:write",
  "prescription:write",
  "hospital:read",
  "doctor:read",
  "notification:read:own",
  "ai-summary:read",
  "ai-summary:generate",
  "analytics:read",
];

const HOSPITAL_STAFF_PERMISSIONS: Permission[] = [
  "appointment:read:all",
  "appointment:manage",
  "queue:read:hospital",
  "queue:manage",
  "record:read:all",
  "hospital:read",
  "doctor:read",
  "notification:read:own",
  "analytics:read",
];

const HOSPITAL_ADMIN_PERMISSIONS: Permission[] = [
  ...HOSPITAL_STAFF_PERMISSIONS,
  "hospital:manage",
  "doctor:manage",
  "department:manage",
  "staff:manage",
  "record:write",
  "prescription:write",
];

const DIAGNOSTIC_STAFF_PERMISSIONS: Permission[] = [
  "report:read:all",
  "report:manage",
  "diagnostic:search",
  "hospital:read",
  "doctor:read",
  "notification:read:own",
  "analytics:read",
];

const SYSTEM_ADMIN_PERMISSIONS: Permission[] = [
  ...HOSPITAL_ADMIN_PERMISSIONS,
  ...DIAGNOSTIC_STAFF_PERMISSIONS,
  "admin:users",
  "admin:hospitals",
  "admin:diagnostics",
  "admin:settings",
  "appointment:manage",
  "queue:manage",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  PATIENT: PATIENT_PERMISSIONS,
  DOCTOR: DOCTOR_PERMISSIONS,
  HOSPITAL_STAFF: HOSPITAL_STAFF_PERMISSIONS,
  HOSPITAL_ADMIN: HOSPITAL_ADMIN_PERMISSIONS,
  DIAGNOSTIC_STAFF: DIAGNOSTIC_STAFF_PERMISSIONS,
  SYSTEM_ADMIN: SYSTEM_ADMIN_PERMISSIONS,
};

/** True when the role holds the permission. */
export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** The landing route for a role. */
export function homeRouteFor(role: Role): string {
  return ROLE_META[role].homeRoute;
}

/** The route a user should be sent to when they land on `/`. */
export function landingRouteFor(role: Role | null | undefined): string {
  if (!role) return "/login";
  return homeRouteFor(role);
}

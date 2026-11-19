/**
 * The API route table — the contract between this frontend and the future
 * backend.
 *
 * Every path listed here becomes an Express endpoint. The mock transport
 * implements the same table against the demo database, so the UI cannot tell
 * the two apart. A unit test asserts that every route has a mock handler.
 */

export const API_ROUTES = {
  // ── Authentication ───────────────────────────────────────────────────────
  login: { method: "POST", path: "/auth/login" },
  register: { method: "POST", path: "/auth/register" },
  logout: { method: "POST", path: "/auth/logout" },
  forgotPassword: { method: "POST", path: "/auth/forgot-password" },
  resetPassword: { method: "POST", path: "/auth/reset-password" },
  demoAccounts: { method: "GET", path: "/auth/demo-accounts" },

  // ── Users ───────────────────────────────────────────────────────────────
  me: { method: "GET", path: "/users/me" },
  updateProfile: { method: "PATCH", path: "/users/me" },
  changePassword: { method: "POST", path: "/users/me/password" },
  listUsers: { method: "GET", path: "/users" },
  updateUserStatus: { method: "PATCH", path: "/users/:id/status" },

  // ── Hospitals ───────────────────────────────────────────────────────────
  listHospitals: { method: "GET", path: "/hospitals" },
  getHospital: { method: "GET", path: "/hospitals/:id" },
  createHospital: { method: "POST", path: "/hospitals" },
  listDepartments: { method: "GET", path: "/departments" },
  getDepartment: { method: "GET", path: "/departments/:id" },
  createDepartment: { method: "POST", path: "/departments" },
  updateDepartment: { method: "PATCH", path: "/departments/:id" },
  deleteDepartment: { method: "DELETE", path: "/departments/:id" },

  // ── Doctors ─────────────────────────────────────────────────────────────
  listDoctors: { method: "GET", path: "/doctors" },
  getDoctor: { method: "GET", path: "/doctors/:id" },
  createDoctor: { method: "POST", path: "/doctors" },
  updateDoctor: { method: "PATCH", path: "/doctors/:id" },
  listDoctorSchedule: { method: "GET", path: "/doctors/:id/schedule" },
  listDoctorAvailability: { method: "GET", path: "/doctors/:id/availability" },

  // ── Appointments ────────────────────────────────────────────────────────
  listAppointments: { method: "GET", path: "/appointments" },
  getAppointment: { method: "GET", path: "/appointments/:id" },
  createAppointment: { method: "POST", path: "/appointments" },
  cancelAppointment: { method: "POST", path: "/appointments/:id/cancel" },
  rescheduleAppointment: { method: "PATCH", path: "/appointments/:id/reschedule" },
  listSlots: { method: "GET", path: "/slots" },

  // ── Queue ───────────────────────────────────────────────────────────────
  getQueue: { method: "GET", path: "/queue" },
  queueAction: { method: "POST", path: "/queue/actions" },
  listQueueEvents: { method: "GET", path: "/queue/events" },
  queueSettings: { method: "GET", path: "/queue/settings" },
  updateQueueSettings: { method: "PATCH", path: "/queue/settings" },

  // ── EMR ─────────────────────────────────────────────────────────────────
  listRecords: { method: "GET", path: "/records" },
  getRecord: { method: "GET", path: "/records/:id" },
  createRecord: { method: "POST", path: "/records" },
  updateRecord: { method: "PATCH", path: "/records/:id" },
  deleteRecord: { method: "DELETE", path: "/records/:id" },
  listPrescriptions: { method: "GET", path: "/prescriptions" },
  listAllergies: { method: "GET", path: "/allergies" },
  createAllergy: { method: "POST", path: "/allergies" },
  deleteAllergy: { method: "DELETE", path: "/allergies/:id" },
  listConditions: { method: "GET", path: "/conditions" },
  createCondition: { method: "POST", path: "/conditions" },

  // ── Diagnostics ─────────────────────────────────────────────────────────
  listCenters: { method: "GET", path: "/diagnostic-centers" },
  getCenter: { method: "GET", path: "/diagnostic-centers/:id" },
  listReports: { method: "GET", path: "/reports" },
  getReport: { method: "GET", path: "/reports/:id" },
  createReport: { method: "POST", path: "/reports" },
  updateReportStatus: { method: "PATCH", path: "/reports/:id/status" },

  // ── AI summary ──────────────────────────────────────────────────────────
  listSummaries: { method: "GET", path: "/ai-summaries" },
  getSummary: { method: "GET", path: "/ai-summaries/:id" },
  generateSummary: { method: "POST", path: "/ai-summaries/generate" },
  updateSummary: { method: "PATCH", path: "/ai-summaries/:id" },

  // ── Notifications ───────────────────────────────────────────────────────
  listNotifications: { method: "GET", path: "/notifications" },
  markNotificationRead: { method: "PATCH", path: "/notifications/:id/read" },
  markAllNotificationsRead: { method: "PATCH", path: "/notifications/read-all" },
  deleteNotification: { method: "DELETE", path: "/notifications/:id" },

  // ── Statistics & system ─────────────────────────────────────────────────
  systemStats: { method: "GET", path: "/stats/system" },
  hospitalStats: { method: "GET", path: "/stats/hospital" },
  centerStats: { method: "GET", path: "/stats/center" },
  listStaff: { method: "GET", path: "/staff" },
  createStaff: { method: "POST", path: "/staff" },
  updateStaff: { method: "PATCH", path: "/staff/:id" },
  systemSettings: { method: "GET", path: "/system/settings" },
  updateSystemSettings: { method: "PATCH", path: "/system/settings" },
  resetDemoData: { method: "POST", path: "/system/reset" },
} as const;

export type RouteKey = keyof typeof API_ROUTES;

export interface RouteDefinition {
  method: string;
  path: string;
}

/** Fill `:param` placeholders from a params object. */
export function buildPath(
  route: RouteDefinition,
  params: Record<string, string | number> = {},
): string {
  return route.path.replace(/:([A-Za-z0-9_]+)/g, (_match, key: string) => {
    const value = params[key];
    if (value === undefined || value === null || value === "") {
      throw new Error(`Missing route parameter "${key}" for ${route.path}`);
    }
    return encodeURIComponent(String(value));
  });
}

/** Every route as a flat list — used by the contract test. */
export const ALL_ROUTES: RouteDefinition[] = Object.values(API_ROUTES);

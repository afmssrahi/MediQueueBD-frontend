/**
 * Patient status vocabulary.
 *
 * Ported from the queue prototype's `src/constants/statuses.js`. The labels
 * live here so a badge never renders a raw status string.
 */

export const STATUSES = {
  BOOKED: "BOOKED",
  ARRIVAL_REQUESTED: "ARRIVAL_REQUESTED",
  WAITING_FOR_ARRIVAL: "WAITING_FOR_ARRIVAL",
  WAITING: "WAITING",
  CALLED: "CALLED",
  IN_CONSULTATION: "IN_CONSULTATION",
  COMPLETED: "COMPLETED",
  LATE: "LATE",
  NO_SHOW: "NO_SHOW",
  CANCELLED: "CANCELLED",
  SKIPPED: "SKIPPED",
} as const;

export type QueueStatus = (typeof STATUSES)[keyof typeof STATUSES];

/** Statuses that remove a patient from the active serving order. */
export const TERMINAL_STATUSES: QueueStatus[] = [
  STATUSES.COMPLETED,
  STATUSES.CANCELLED,
  STATUSES.NO_SHOW,
  STATUSES.SKIPPED,
];

/** Statuses where the patient is physically inside the hospital. */
export const PHYSICALLY_PRESENT_STATUSES: QueueStatus[] = [
  STATUSES.WAITING,
  STATUSES.CALLED,
  STATUSES.IN_CONSULTATION,
];

/** Statuses where the patient has not arrived yet. */
export const AT_HOME_STATUSES: QueueStatus[] = [
  STATUSES.BOOKED,
  STATUSES.ARRIVAL_REQUESTED,
  STATUSES.WAITING_FOR_ARRIVAL,
  STATUSES.LATE,
];

export const LATE_PENALTY_POLICIES = {
  MOVE_BEHIND_CHECKED_IN: "MOVE_BEHIND_CHECKED_IN",
  KEEP_POSITION: "KEEP_POSITION",
  MARK_NO_SHOW: "MARK_NO_SHOW",
} as const;

export type LatePenaltyPolicy =
  (typeof LATE_PENALTY_POLICIES)[keyof typeof LATE_PENALTY_POLICIES];

export function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.includes(status as QueueStatus);
}

export function isPhysicallyPresent(status: string): boolean {
  return PHYSICALLY_PRESENT_STATUSES.includes(status as QueueStatus);
}

export function isAtHome(status: string): boolean {
  return AT_HOME_STATUSES.includes(status as QueueStatus);
}

/** The dictionary key for a status label. */
export function statusLabelKey(status: string): string {
  return `status.${status}`;
}

import { CENTERS, DEPARTMENTS, DOCTORS, HOSPITALS, STAFF, USERS } from "./entities";
import {
  DEFAULT_SETTINGS,
  buildAllergies,
  buildAppointments,
  buildConditions,
  buildNotifications,
  buildPrescriptions,
  buildQueues,
  buildQueueEvents,
  buildRecords,
  buildReports,
  buildSummaries,
} from "./clinical";
import type { DemoDatabase } from "../types";
import type { Doctor } from "@/types";

/**
 * The midday break for a doctor.
 *
 * A real clinic does not run the chair straight through — there is a break
 * for tea and prayer, and no appointment is offered while it is on. The
 * break is derived from the session window so every doctor gets one that
 * falls inside their own hours.
 */
export function lunchBreakFor(
  sessionStart: number,
  sessionEnd: number,
): { start: number; end: number } | null {
  const candidates = [
    { start: 12 * 60 + 30, end: 13 * 60 },
    { start: 13 * 60, end: 13 * 60 + 30 },
    { start: 19 * 60, end: 19 * 60 + 30 },
  ];

  for (const candidate of candidates) {
    if (candidate.start >= sessionStart && candidate.end <= sessionEnd) {
      return candidate;
    }
  }

  return null;
}

/** Give every doctor the break that fits their session. */
function withBreak(doctor: Doctor): Doctor {
  const breakWindow = lunchBreakFor(doctor.sessionStart, doctor.sessionEnd);

  return {
    ...doctor,
    lunchBreakStart: breakWindow?.start ?? null,
    lunchBreakEnd: breakWindow?.end ?? null,
  };
}

/**
 * Build a fresh database from the seed fixtures.
 *
 * The seed is deterministic apart from timestamps, so two resets produce the
 * same data apart from the moment they were generated.
 */
export function createSeedDatabase(): DemoDatabase {
  const appointments = buildAppointments();

  return {
    version: 1,
    seededAt: new Date().toISOString(),
    users: USERS.map((user) => ({ ...user })),
    hospitals: HOSPITALS.map((hospital) => ({ ...hospital })),
    departments: DEPARTMENTS.map((department) => ({ ...department })),
    doctors: DOCTORS.map((doctor) => ({
      ...withBreak(doctor),
      consultationHistory: [...doctor.consultationHistory],
      availableWeekdays: [...doctor.availableWeekdays],
    })),
    appointments,
    records: buildRecords(),
    prescriptions: buildPrescriptions(),
    allergies: buildAllergies(),
    conditions: buildConditions(),
    centers: CENTERS.map((center) => ({ ...center })),
    reports: buildReports(),
    notifications: buildNotifications(),
    summaries: buildSummaries(),
    queues: buildQueues(appointments),
    queueEvents: buildQueueEvents(),
    staff: STAFF.map((member) => ({ ...member })),
    settings: { ...DEFAULT_SETTINGS },
    counters: {
      appointment: 2000,
      record: 1000,
      prescription: 1000,
      report: 2000,
      notification: 100,
      summary: 100,
      hospital: 100,
      department: 100,
      doctor: 100,
      staff: 100,
      allergy: 100,
      condition: 100,
      event: 100,
    },
  };
}

export { DEFAULT_SETTINGS };
export * from "./entities";
export * from "./clinical";

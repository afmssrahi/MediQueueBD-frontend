import type { Appointment, AppointmentStatus } from "@/types";

/**
 * The appointment policy — the rules a real clinic follows.
 *
 * Pure functions only: no React, no DOM, no I/O. The same module runs in the
 * browser today and inside the Express backend tomorrow, so the rules cannot
 * drift between the two.
 *
 * The three questions this module answers:
 *
 *   1. **May this patient book this slot?** — the booking window, the clinic
 *      day, the notice period and the patient's own duplicate bookings.
 *   2. **May this appointment change?** — who is allowed to cancel or
 *      reschedule it, and how close to the appointment they have to be.
 *   3. **What may an appointment become?** — the status transitions.
 */

/** How a policy rule refused an action. */
export type RefusalCode =
  | "OUTSIDE_BOOKING_WINDOW"
  | "CLINIC_CLOSED"
  | "PAST_SLOT"
  | "LEAD_TIME_NOT_MET"
  | "SLOT_TAKEN"
  | "DUPLICATE_BOOKING"
  | "INVALID_TRANSITION"
  | "NOT_ALLOWED"
  | "ALREADY_PAST";

export interface Refusal {
  code: RefusalCode;
  /** The reason, ready to show to a person. */
  message: string;
  /** The field the message belongs to, for form errors. */
  field?: "date" | "startMinute" | "reason";
}

/** A rule check that either passes or explains itself. */
export type PolicyResult =
  | { allowed: true }
  | { allowed: false; refusal: Refusal };

/** The rules a clinic applies, taken from the system settings. */
export interface AppointmentPolicySettings {
  /** How many days ahead a patient may book. */
  appointmentLeadDays: number;
  /** How long before the slot the patient must confirm. 0 disables the rule. */
  minimumNoticeMinutes: number;
  /** How long before the appointment a patient may still change it. */
  changeCutoffMinutes: number;
}

/** The default policy — the values the demo settings start with. */
export const DEFAULT_POLICY: AppointmentPolicySettings = {
  appointmentLeadDays: 14,
  minimumNoticeMinutes: 120,
  changeCutoffMinutes: 120,
};

/**
 * The status ladder.
 *
 * An appointment walks forward through these states. `CANCELLED`, `NO_SHOW`
 * and `SKIPPED` are the ways out of the ladder, and `COMPLETED` is the end of
 * it.
 */
const STATUS_FLOW: Record<AppointmentStatus, AppointmentStatus[]> = {
  BOOKED: ["CONFIRMED", "CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["WAITING", "CALLED", "LATE", "CANCELLED", "NO_SHOW"],
  WAITING: ["CALLED", "LATE", "CANCELLED", "NO_SHOW", "SKIPPED"],
  CALLED: ["IN_CONSULTATION", "WAITING", "LATE", "CANCELLED", "NO_SHOW", "SKIPPED"],
  IN_CONSULTATION: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
  SKIPPED: ["WAITING", "BOOKED", "CONFIRMED"],
  LATE: ["WAITING", "CALLED", "CANCELLED", "NO_SHOW", "SKIPPED"],
};

/** The statuses a patient can no longer change. */
export const LOCKED_STATUSES: AppointmentStatus[] = [
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

/** True when the appointment has run its course and cannot be changed. */
export function isLocked(status: AppointmentStatus): boolean {
  return LOCKED_STATUSES.includes(status);
}

/**
 * Can the appointment move from one status to another?
 *
 * The queue reducer owns the live transitions, so this is the guard for the
 * administrative actions — the ones that jump a booking straight to `CANCELLED`
 * or `NO_SHOW`.
 */
export function canTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
): boolean {
  if (from === to) return true;
  return STATUS_FLOW[from]?.includes(to) ?? false;
}

/**
 * The booking window.
 *
 * A patient may book from today up to `appointmentLeadDays` ahead. The window
 * is inclusive on both ends.
 */
export function isWithinBookingWindow(
  date: string,
  today: string,
  leadDays: number,
): boolean {
  const target = toDayNumber(date);
  const start = toDayNumber(today);
  const end = start + Math.max(0, leadDays);

  return target >= start && target <= end;
}

/** The number of days from the epoch — used for the window arithmetic. */
function toDayNumber(isoDate: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return Number.NaN;

  const [, year, month, day] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day)) / 86_400_000;
}

/**
 * The notice period.
 *
 * A patient must confirm at least `minimumNoticeMinutes` before the slot
 * starts, so the clinic has time to prepare. A slot on another day is always
 * far enough away.
 */
export function meetsMinimumNotice(
  date: string,
  startMinute: number,
  today: string,
  nowMinute: number,
  minimumNoticeMinutes: number,
): boolean {
  if (minimumNoticeMinutes <= 0) return true;

  const todayNumber = toDayNumber(today);
  const targetNumber = toDayNumber(date);
  if (Number.isNaN(todayNumber) || Number.isNaN(targetNumber)) return false;

  // A slot on a later day is at least a day away.
  if (targetNumber > todayNumber) return true;

  // The same day: the slot has to be far enough in the future.
  return startMinute - nowMinute >= minimumNoticeMinutes;
}

/**
 * Has the appointment already started?
 *
 * A patient cannot cancel or move a booking that has begun.
 */
export function hasAppointmentStarted(
  appointment: Appointment,
  today: string,
  nowMinute: number,
): boolean {
  const todayNumber = toDayNumber(today);
  const appointmentNumber = toDayNumber(appointment.date);

  if (appointmentNumber < todayNumber) return true;
  if (appointmentNumber > todayNumber) return false;

  return nowMinute >= appointment.startMinute;
}

/**
 * Is the change still inside the cutoff?
 *
 * Staff may change an appointment up to `changeCutoffMinutes` before it
 * starts. After that only the live queue actions apply.
 */
export function isInsideChangeWindow(
  appointment: Appointment,
  today: string,
  nowMinute: number,
  changeCutoffMinutes: number,
): boolean {
  if (changeCutoffMinutes <= 0) return true;

  const todayNumber = toDayNumber(today);
  const appointmentNumber = toDayNumber(appointment.date);

  if (appointmentNumber > todayNumber) return true;
  if (appointmentNumber < todayNumber) return false;

  return appointment.startMinute - nowMinute > changeCutoffMinutes;
}

/**
 * Does the patient already have a live booking with this doctor?
 *
 * A patient may hold one live booking per doctor. Follow-ups are made by
 * rescheduling the existing booking, not by booking a second one.
 */
export function findDuplicateBooking(
  appointments: Appointment[],
  patientId: string,
  doctorId: string,
  date: string,
  ignoreAppointmentId?: string,
): Appointment | null {
  return (
    appointments.find(
      (appointment) =>
        appointment.patientId === patientId &&
        appointment.doctorId === doctorId &&
        appointment.date === date &&
        appointment.id !== ignoreAppointmentId &&
        !isLocked(appointment.status),
    ) ?? null
  );
}

/**
 * The full booking check.
 *
 * The rules are applied in the order a receptionist would apply them: the
 * window, then the clinic day, then the notice period, then whether the
 * slot is actually free, and only then whether the patient already holds a
 * booking that day.
 *
 * The slot check comes first because it is the more specific answer — a
 * patient who taps a slot that has just been taken needs to be told that,
 * not that they already have an appointment.
 */
export function checkBookingAllowed(input: {
  patientId: string;
  doctorId: string;
  date: string;
  startMinute: number;
  appointments: Appointment[];
  isClinicDay: boolean;
  /** True when another appointment already holds the slot. */
  slotIsTaken: boolean;
  today: string;
  nowMinute: number;
  settings: AppointmentPolicySettings;
}): PolicyResult {
  const { settings } = input;

  if (!isWithinBookingWindow(input.date, input.today, settings.appointmentLeadDays)) {
    return refuse("OUTSIDE_BOOKING_WINDOW", {
      message: `Appointments can only be booked up to ${settings.appointmentLeadDays} days ahead.`,
      field: "date",
    });
  }

  if (!input.isClinicDay) {
    return refuse("CLINIC_CLOSED", {
      message: "The doctor does not hold a clinic on that date.",
      field: "date",
    });
  }

  if (!meetsMinimumNotice(
    input.date,
    input.startMinute,
    input.today,
    input.nowMinute,
    settings.minimumNoticeMinutes,
  )) {
    return refuse("LEAD_TIME_NOT_MET", {
      message: `Please book at least ${settings.minimumNoticeMinutes} minutes before the slot starts.`,
      field: "startMinute",
    });
  }

  if (input.slotIsTaken) {
    return refuse("SLOT_TAKEN", {
      message:
        "This slot has just been taken. Please pick another slot.",
      field: "startMinute",
    });
  }

  const duplicate = findDuplicateBooking(
    input.appointments,
    input.patientId,
    input.doctorId,
    input.date,
  );

  if (duplicate) {
    return refuse("DUPLICATE_BOOKING", {
      message:
        "You already have an appointment with this doctor on that date. Reschedule it instead.",
      field: "date",
    });
  }

  return { allowed: true };
}

/**
 * May this person change this appointment?
 *
 * A patient may change their own booking until the cutoff. Staff may change
 * any booking in their hospital until the cutoff as well, and may cancel or
 * strike off a booking after it has started.
 */
export function checkChangeAllowed(input: {
  appointment: Appointment;
  actorId: string | null;
  actorRole: string | undefined;
  actorHospitalId?: string | null;
  actorDoctorId?: string | null;
  today: string;
  nowMinute: number;
  settings: AppointmentPolicySettings;
}): PolicyResult {
  const { appointment, actorId, actorRole } = input;

  if (isLocked(appointment.status)) {
    return refuse("INVALID_TRANSITION", {
      message: `An appointment that is already ${appointment.status.toLowerCase()} cannot be changed.`,
    });
  }

  const isOwner = actorId !== null && actorId === appointment.patientId;
  const isStaff = isStaffRole(actorRole);

  if (!isOwner && !isStaff) {
    return refuse("NOT_ALLOWED", {
      message: "You can only change your own appointments.",
    });
  }

  if (isStaff && !isOwner && !actsOnTheAppointment(input)) {
    return refuse("NOT_ALLOWED", {
      message: "You can only change the appointments of your own hospital.",
    });
  }

  // A patient may not touch a booking that has already started.
  if (
    isOwner &&
    hasAppointmentStarted(appointment, input.today, input.nowMinute)
  ) {
    return refuse("ALREADY_PAST", {
      message: "This appointment has already started. Please speak to reception.",
    });
  }

  if (
    !isInsideChangeWindow(
      appointment,
      input.today,
      input.nowMinute,
      input.settings.changeCutoffMinutes,
    )
  ) {
    return refuse("ALREADY_PAST", {
      message: `Appointments can only be changed up to ${input.settings.changeCutoffMinutes} minutes before they start.`,
    });
  }

  return { allowed: true };
}

/**
 * Is this staff member entitled to act on this appointment?
 *
 * A doctor acts on their own list. Hospital staff and administrators act
 * inside their own hospital. The system administrator runs the platform, so
 * they act everywhere.
 */
function actsOnTheAppointment(input: {
  appointment: Appointment;
  actorRole: string | undefined;
  actorHospitalId?: string | null;
  actorDoctorId?: string | null;
}): boolean {
  const { actorRole } = input;

  if (actorRole === "SYSTEM_ADMIN") return true;

  if (actorRole === "DOCTOR") {
    return (
      Boolean(input.actorDoctorId) &&
      input.actorDoctorId === input.appointment.doctorId
    );
  }

  return (
    Boolean(input.actorHospitalId) &&
    input.actorHospitalId === input.appointment.hospitalId
  );
}

/** The roles that may act on other people's appointments. */
export function isStaffRole(role: string | undefined): boolean {
  return (
    role === "DOCTOR" ||
    role === "HOSPITAL_STAFF" ||
    role === "HOSPITAL_ADMIN" ||
    role === "SYSTEM_ADMIN"
  );
}

/** Build a refusal result. */
function refuse(
  code: RefusalCode,
  refusal: Omit<Refusal, "code">,
): PolicyResult {
  return { allowed: false, refusal: { code, ...refusal } };
}

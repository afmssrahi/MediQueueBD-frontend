import type { Appointment, Doctor, Slot } from "@/types";
import { format, parseISO } from "date-fns";

/**
 * Appointment slot rules.
 *
 * Pure functions only — no React, no DOM, no I/O. The same module runs in
 * the browser today and inside the Express backend tomorrow.
 */

/** Statuses that still occupy a slot. */
export const BLOCKING_STATUSES: Appointment["status"][] = [
  "BOOKED",
  "CONFIRMED",
  "CHECKED_IN",
  "WAITING",
  "CALLED",
  "IN_CONSULTATION",
  "COMPLETED",
  "LATE",
];

/** The context a slot grid is generated in. */
export interface SlotContext {
  /** Today's date, as an ISO string. */
  today: string;
  /** The current time, in minutes since midnight. */
  nowMinute: number;
  /**
   * How much notice the clinic needs before a slot starts.
   *
   * A slot inside the notice period is closed, because the booking would be
   * refused. `0` or `undefined` disables the rule.
   */
  minimumNoticeMinutes?: number;
}

/**
 * Generate the slots a doctor offers on a date.
 *
 * The doctor's session window is cut into fixed-length slots. A slot is
 * unavailable when an appointment already occupies it, when it falls in the
 * doctor's break, or when it has already passed today.
 *
 * The `context` is what makes the grid realistic: without it the same slot
 * list is returned for every day and for every hour of the day.
 */
export function generateSlots(
  doctor: Doctor,
  date: string,
  appointments: Appointment[],
  slotDurationMinutes = 15,
  context?: SlotContext,
): Slot[] {
  const slots: Slot[] = [];

  const start = doctor.sessionStart;
  const end = doctor.sessionEnd;

  if (end <= start) return slots;

  const taken = new Map<string, string>();
  for (const appointment of appointments) {
    if (appointment.doctorId !== doctor.id) continue;
    if (appointment.date !== date) continue;
    if (!BLOCKING_STATUSES.includes(appointment.status)) continue;
    taken.set(String(appointment.startMinute), appointment.id);
  }

  for (
    let minute = start;
    minute + slotDurationMinutes <= end;
    minute += slotDurationMinutes
  ) {
    const key = String(minute);
    const appointmentId = taken.get(key) ?? null;

    let unavailableReason: Slot["unavailableReason"] = null;

    if (appointmentId) {
      unavailableReason = "BOOKED";
    } else if (isDuringBreak(doctor, minute, minute + slotDurationMinutes)) {
      unavailableReason = "BREAK";
    } else if (isInThePast(date, minute, context)) {
      unavailableReason = "PAST";
    } else if (isInsideNoticePeriod(date, minute, context)) {
      unavailableReason = "NOTICE";
    }

    slots.push({
      doctorId: doctor.id,
      date,
      startMinute: minute,
      endMinute: minute + slotDurationMinutes,
      available: unavailableReason === null,
      appointmentId,
      unavailableReason,
    });
  }

  return slots;
}

/**
 * Does the slot overlap the doctor's break?
 *
 * A slot that only partly overlaps the break is still offered — the doctor
 * can start a consultation a few minutes late — but a slot that falls inside
 * the break is closed.
 */
export function isDuringBreak(
  doctor: Doctor,
  startMinute: number,
  endMinute: number,
): boolean {
  const breakStart = doctor.lunchBreakStart;
  const breakEnd = doctor.lunchBreakEnd;

  if (breakStart === null || breakStart === undefined) return false;
  if (breakEnd === null || breakEnd === undefined) return false;
  if (breakEnd <= breakStart) return false;

  return startMinute >= breakStart && endMinute <= breakEnd;
}

/** Has the slot already passed? */
export function isInThePast(
  date: string,
  startMinute: number,
  context?: SlotContext,
): boolean {
  if (!context) return false;
  if (date < context.today) return true;
  if (date > context.today) return false;

  return startMinute <= context.nowMinute;
}

/**
 * Is the slot too close to book?
 *
 * The clinic needs a minimum amount of notice before a slot starts, so a slot
 * inside that window is closed. A slot on a later day is always far enough
 * away.
 */
export function isInsideNoticePeriod(
  date: string,
  startMinute: number,
  context?: SlotContext,
): boolean {
  const notice = context?.minimumNoticeMinutes ?? 0;
  if (!context || notice <= 0) return false;
  if (date > context.today) return false;
  if (date < context.today) return true;

  return startMinute - context.nowMinute < notice;
}

/**
 * True when the doctor works on the given date.
 *
 * `availableWeekdays` uses 0 = Sunday, matching `Date.prototype.getDay`.
 */
export function isDoctorAvailableOn(doctor: Doctor, date: string): boolean {
  try {
    const weekday = parseISO(date).getDay();
    return doctor.availableWeekdays.includes(weekday);
  } catch {
    return false;
  }
}

/**
 * The double-booking guard.
 *
 * This is a **frontend simulation only**. It stops a patient from booking a
 * slot that is visibly taken in the demo database, but it is not a security
 * boundary — the backend must validate the slot again inside a transaction
 * before a real booking is accepted.
 */
export function findSlotConflict(
  slots: Slot[],
  startMinute: number,
  appointments: Appointment[],
  options: { doctorId: string; date: string; ignoreAppointmentId?: string },
): Appointment | null {
  const slot = slots.find((item) => item.startMinute === startMinute);

  if (!slot) return null;

  return (
    appointments.find(
      (appointment) =>
        appointment.doctorId === options.doctorId &&
        appointment.date === options.date &&
        appointment.startMinute === startMinute &&
        appointment.id !== options.ignoreAppointmentId &&
        BLOCKING_STATUSES.includes(appointment.status),
    ) ?? null
  );
}

/**
 * The next booking number (token) for a doctor on a date.
 *
 * Tokens are per-doctor and per-day, and they never change once assigned.
 */
export function nextTokenNumber(
  appointments: Appointment[],
  doctorId: string,
  date: string,
): number {
  const tokens = appointments
    .filter(
      (appointment) =>
        appointment.doctorId === doctorId && appointment.date === date,
    )
    .map((appointment) => appointment.tokenNumber);

  return tokens.length === 0 ? 1 : Math.max(...tokens) + 1;
}

/** The dates a doctor can be booked on, starting from `fromDate`. */
export function bookableDates(
  doctor: Doctor,
  fromDate: string,
  days: number,
): string[] {
  const dates: string[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    const date = parseISO(fromDate);
    date.setDate(date.getDate() + offset);
    // The local calendar day, not the UTC one — `toISOString()` would roll
    // the date back for anyone east of UTC in the early hours, and the
    // weekday would then disagree with the date.
    const iso = format(date, "yyyy-MM-dd");
    if (isDoctorAvailableOn(doctor, iso)) dates.push(iso);
  }

  return dates;
}

/**
 * The next bookable date for a doctor.
 *
 * Used when a patient opens the booking screen without choosing a date: the
 * flow starts on the first day the doctor actually holds a clinic.
 */
export function nextBookableDate(
  doctor: Doctor,
  fromDate: string,
  days: number,
): string | null {
  const dates = bookableDates(doctor, fromDate, days);
  return dates[0] ?? null;
}

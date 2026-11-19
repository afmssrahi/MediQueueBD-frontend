import type { Appointment, Doctor, Slot } from "@/types";
import { parseISO } from "date-fns";

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

/**
 * Generate the slots a doctor offers on a date.
 *
 * The doctor's session window is cut into fixed-length slots. A slot is
 * unavailable when an appointment already occupies it.
 */
export function generateSlots(
  doctor: Doctor,
  date: string,
  appointments: Appointment[],
  slotDurationMinutes = 15,
): Slot[] {
  const slots: Slot[] = [];

  const start = doctor.sessionStart;
  const end = doctor.sessionEnd;

  if (end <= start) return slots;

  const taken = new Set<string>();
  for (const appointment of appointments) {
    if (appointment.doctorId !== doctor.id) continue;
    if (appointment.date !== date) continue;
    if (!BLOCKING_STATUSES.includes(appointment.status)) continue;
    taken.add(String(appointment.startMinute));
  }

  for (let minute = start; minute + slotDurationMinutes <= end; minute += slotDurationMinutes) {
    const key = String(minute);
    slots.push({
      doctorId: doctor.id,
      date,
      startMinute: minute,
      endMinute: minute + slotDurationMinutes,
      available: !taken.has(key),
      appointmentId: null,
    });
  }

  return slots;
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
    const date = new Date(parseISO(fromDate));
    date.setDate(date.getDate() + offset);
    const iso = date.toISOString().slice(0, 10);
    if (isDoctorAvailableOn(doctor, iso)) dates.push(iso);
  }

  return dates;
}

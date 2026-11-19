/**
 * Time helpers for the queue domain.
 *
 * All simulation times are **integer minutes since midnight**. Integer
 * minutes avoid float drift and keep the engines free of timezone handling.
 */

export const MINUTES_PER_DAY = 24 * 60;

/** Parse "HH:MM" into minutes since midnight. */
export function parseTime(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Format minutes since midnight as "HH:MM" (24h, stable and sortable). */
export function formatTime24(minutes: number | null | undefined): string | null {
  if (minutes === null || minutes === undefined) return null;
  const normalized =
    ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/** Format minutes since midnight as "10:08 AM". */
export function formatTime12(minutes: number | null | undefined): string | null {
  if (minutes === null || minutes === undefined) return null;
  const normalized =
    ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours24 = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, "0")} ${suffix}`;
}

/** Human-friendly duration: "35 min", "1 h 5 min". */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—";
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${mins} min`;
}

/** Signed duration used for estimate error: "+8 min", "-3 min". */
export function formatSignedDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—";
  const rounded = Math.round(minutes);
  if (rounded === 0) return "0 min";
  return `${rounded > 0 ? "+" : "-"}${formatDuration(Math.abs(rounded))}`;
}

/** Clamp a value into a range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * True when `now` is strictly past `deadline + grace`.
 *
 * A patient is NOT late before the deadline, nor during the grace period.
 */
export function isPastGrace(
  now: number,
  deadline: number | null | undefined,
  graceMinutes: number,
): boolean {
  if (deadline === null || deadline === undefined) return false;
  return now > deadline + graceMinutes;
}

/**
 * True when a late patient has passed the no-show cutoff, measured after the
 * grace period ends.
 */
export function isPastNoShowCutoff(
  now: number,
  deadline: number | null | undefined,
  graceMinutes: number,
  noShowAfterGraceMinutes: number,
): boolean {
  if (deadline === null || deadline === undefined) return false;
  return now > deadline + graceMinutes + noShowAfterGraceMinutes;
}

/** Median of a numeric array. */
export function median(values: number[]): number | null {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Arithmetic mean of a numeric array. */
export function average(values: number[]): number | null {
  if (!values || values.length === 0) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return sum / values.length;
}

import { format, parseISO } from "date-fns";

/**
 * Formatting helpers shared by every screen.
 *
 * The queue domain stores times as integer minutes since midnight, so the
 * queue screens use `formatMinute` rather than a Date.
 */

export const MINUTES_PER_DAY = 24 * 60;

/** Parse "HH:MM" into minutes since midnight. */
export function parseTime(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Format minutes since midnight as "HH:MM" (24h, sortable). */
export function formatMinute(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—";
  const normalized =
    ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/** Format minutes since midnight as "10:08 AM". */
export function formatMinute12(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—";
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

/** Format an ISO date string as "16 Nov 2026". */
export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  try {
    return format(parseISO(isoDate), "d MMM yyyy");
  } catch {
    return isoDate;
  }
}

/** Format an ISO date string as "16 November 2026". */
export function formatDateLong(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  try {
    return format(parseISO(isoDate), "d MMMM yyyy");
  } catch {
    return isoDate;
  }
}

/** Format a timestamp as "16 Nov 2026, 10:08". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "d MMM yyyy, HH:mm");
  } catch {
    return iso;
  }
}

/** Format a timestamp as a relative phrase ("3 hours ago"). */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const date = parseISO(iso);
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.round(diffMs / 60000);

    if (Math.abs(diffMinutes) < 1) return "just now";
    if (Math.abs(diffMinutes) < 60) {
      return `${Math.abs(diffMinutes)} min ${diffMinutes > 0 ? "ago" : "from now"}`;
    }
    const diffHours = Math.round(diffMinutes / 60);
    if (Math.abs(diffHours) < 24) {
      return `${Math.abs(diffHours)} h ${diffHours > 0 ? "ago" : "from now"}`;
    }
    const diffDays = Math.round(diffHours / 24);
    return `${Math.abs(diffDays)} d ${diffDays > 0 ? "ago" : "from now"}`;
  } catch {
    return iso;
  }
}

/** Format a number as Bangladeshi Taka. */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return `৳${amount.toLocaleString("en-US")}`;
}

/** Format a percentage, or an em dash when it is unknown. */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value)}%`;
}

/** Today's date as an ISO string. */
export function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** Add days to an ISO date string. */
export function addDaysIso(isoDate: string, days: number): string {
  const date = parseISO(isoDate);
  date.setDate(date.getDate() + days);
  return format(date, "yyyy-MM-dd");
}

/** The day of week for an ISO date, 0 = Sunday. */
export function weekdayOf(isoDate: string): number {
  return parseISO(isoDate).getDay();
}

/** Initials for an avatar fallback. */
export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

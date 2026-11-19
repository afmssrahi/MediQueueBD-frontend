import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Tone =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "info"
  | "muted";

/**
 * Status → tone map.
 *
 * The appointment, queue and report statuses share one table so a status
 * always looks the same wherever it appears. Labels come from the dictionary.
 */
const STATUS_TONES: Record<string, Tone> = {
  // Appointments and queue
  BOOKED: "secondary",
  CONFIRMED: "info",
  CHECKED_IN: "info",
  WAITING: "success",
  CALLED: "info",
  IN_CONSULTATION: "default",
  COMPLETED: "muted",
  CANCELLED: "muted",
  NO_SHOW: "destructive",
  SKIPPED: "destructive",
  LATE: "warning",
  ARRIVAL_REQUESTED: "info",
  WAITING_FOR_ARRIVAL: "secondary",

  // Reports
  PENDING: "secondary",
  PROCESSING: "warning",
  READY: "success",
  DELIVERED: "muted",
  REJECTED: "destructive",

  // Verification and accounts
  VERIFIED: "success",
  PENDING_VERIFICATION: "warning",
  ACTIVE: "success",
  INACTIVE: "muted",
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
  showDot?: boolean;
}

/** A status pill that is consistent across every screen. */
export function StatusBadge({
  status,
  label,
  className,
  showDot = false,
}: StatusBadgeProps) {
  const tone = STATUS_TONES[status] ?? "secondary";

  return (
    <Badge variant={tone} className={cn("gap-1.5", className)}>
      {showDot && <span className="size-1.5 rounded-full bg-current" />}
      {label ?? status}
    </Badge>
  );
}

export { STATUS_TONES };

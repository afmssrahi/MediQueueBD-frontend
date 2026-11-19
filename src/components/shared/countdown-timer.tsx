"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  /** The target time, in minutes since midnight. */
  targetMinute: number;
  /** The current time, in minutes since midnight. */
  currentMinute: number;
  className?: string;
  label?: string;
  /** Renders the time in urgent red when fewer than this many minutes remain. */
  urgentBelowMinutes?: number;
}

/**
 * A countdown rendered as `mm:ss` or `X min`.
 *
 * The queue domain works in integer minutes since midnight, so the timer
 * counts whole minutes rather than pretending to have second precision.
 */
export function CountdownTimer({
  targetMinute,
  currentMinute,
  className,
  label,
  urgentBelowMinutes = 5,
}: CountdownTimerProps) {
  const remaining = Math.max(0, targetMinute - currentMinute);
  const urgent = remaining <= urgentBelowMinutes;

  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        urgent && "font-semibold text-destructive",
        className,
      )}
    >
      {label && <span className="font-sans">{label} </span>}
      {remaining === 0 ? "0 min" : `${remaining} min`}
    </span>
  );
}

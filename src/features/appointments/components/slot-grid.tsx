"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { formatMinute12 } from "@/lib/format";
import type { Slot } from "@/types";

/**
 * The slot grid.
 *
 * One component for the booking screen and the reschedule dialog, so both
 * show the same grid with the same rules: a slot that is taken, in the past
 * or inside the doctor's break is closed, and the reason is stated rather
 * than left to guesswork.
 */
interface SlotGridProps {
  slots: Slot[];
  /** The selected slot, in minutes since midnight. */
  value: number | null;
  onSelect: (startMinute: number) => void;
  /** The slot to highlight but not to treat as taken — the current booking. */
  currentSlot?: number | null;
  disabled?: boolean;
}

export function SlotGrid({
  slots,
  value,
  onSelect,
  currentSlot = null,
  disabled = false,
}: SlotGridProps) {
  const { t } = useTranslation();

  if (slots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("appointments.noSlotsHint")}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {slots.map((slot) => {
        const isCurrent = currentSlot === slot.startMinute;
        const isSelected = value === slot.startMinute;

        // The current booking's own slot stays selectable when rescheduling,
        // so a patient can keep the time they already have.
        const isClosed = !slot.available && !isCurrent;

        return (
          <button
            key={slot.startMinute}
            type="button"
            disabled={isClosed || disabled}
            onClick={() => onSelect(slot.startMinute)}
            title={slotTitle(slot, isCurrent, t)}
            className={cn(
              "rounded-md border px-2 py-2 text-xs font-medium transition-colors",
              isClosed &&
                "cursor-not-allowed bg-muted/50 text-muted-foreground line-through",
              !isClosed && isSelected &&
                "border-primary bg-primary text-primary-foreground",
              !isClosed && !isSelected && "hover:border-primary hover:bg-accent",
              isCurrent && !isSelected && "border-dashed border-primary/60",
            )}
          >
            {formatMinute12(slot.startMinute)}
          </button>
        );
      })}
    </div>
  );
}

/** The reason a slot is closed, shown as the button's tooltip. */
function slotTitle(
  slot: Slot,
  isCurrent: boolean,
  t: (key: string) => string,
): string {
  if (isCurrent) return t("appointments.currentSlot");
  if (slot.available) return t("appointments.selectSlot");

  switch (slot.unavailableReason) {
    case "BOOKED":
      return t("appointments.slotReasonBooked");
    case "PAST":
      return t("appointments.slotReasonPast");
    case "BREAK":
      return t("appointments.slotReasonBreak");
    case "NOTICE":
      return t("appointments.slotReasonNotice");
    default:
      return t("appointments.slotReasonClosed");
  }
}

/**
 * The date picker.
 *
 * Only the dates the doctor actually holds a clinic are offered, and each one
 * says how many slots are still free.
 */
interface DatePickerProps {
  dates: { date: string; label?: string; available: number; total: number }[];
  value: string | null;
  onSelect: (date: string) => void;
  disabled?: boolean;
}

export function DatePicker({
  dates,
  value,
  onSelect,
  disabled = false,
}: DatePickerProps) {
  const { t } = useTranslation();

  if (dates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("appointments.noClinicDays")}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {dates.map((option) => {
        const isSelected = value === option.date;
        const isFull = option.available === 0;

        return (
          <button
            key={option.date}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(option.date)}
            className={cn(
              "flex flex-col items-center rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-accent",
              isFull && !isSelected && "opacity-50",
            )}
          >
            <span>{option.label ?? option.date}</span>
            {option.total > 0 && (
              <span className="text-[0.6rem] opacity-80">
                {option.available} {t("appointments.slotsFree")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** The break notice, shown under a slot grid. */
export function BreakNotice({
  breakStart,
  breakEnd,
}: {
  breakStart: number | null;
  breakEnd: number | null;
}) {
  const { t } = useTranslation();

  if (breakStart === null || breakEnd === null) return null;

  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Clock className="size-3.5" />
      {t("appointments.breakNotice", {
        start: formatMinute12(breakStart),
        end: formatMinute12(breakEnd),
      })}
    </p>
  );
}

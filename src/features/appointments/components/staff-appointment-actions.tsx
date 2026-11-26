"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  CircleSlash,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import {
  useCancelAppointment,
  useRescheduleAppointment,
  useSetAppointmentStatus,
  useSlots,
} from "@/features/appointments/hooks/use-appointments";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SlotGrid } from "@/features/appointments/components/slot-grid";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import type { Appointment } from "@/types";

/**
 * The appointment actions a member of staff has.
 *
 * A receptionist can strike a patient off, reinstate a booking that was
 * cancelled by mistake, move a booking to another slot, or cancel it with a
 * reason. The patient's own actions are simpler — they can only cancel or
 * reschedule — so the two live in separate components.
 */
export function StaffAppointmentActions({
  appointment,
  onDone,
}: {
  appointment: Appointment;
  onDone?: () => void;
}) {
  const { t } = useTranslation();
  const [noShowOpen, setNoShowOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [rescheduleOpen, setRescheduleOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");

  const cancel = useCancelAppointment();
  const setStatus = useSetAppointmentStatus();
  const reschedule = useRescheduleAppointment();

  const isLive = ["WAITING", "CALLED", "IN_CONSULTATION"].includes(
    appointment.status,
  );

  const close = () => {
    setNoShowOpen(false);
    setCancelOpen(false);
    setReason("");
  };

  const onNoShow = () => {
    setStatus.mutate(
      { id: appointment.id, status: "NO_SHOW", reason: reason.trim() },
      {
        onSuccess: () => {
          close();
          toast.success(t("appointments.markedNoShow"));
          onDone?.();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const onCancel = () => {
    cancel.mutate(
      { id: appointment.id, reason: reason.trim() || t("appointments.cancelledByStaff") },
      {
        onSuccess: () => {
          close();
          toast.success(t("appointments.cancelled"));
          onDone?.();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const onReinstate = () => {
    setStatus.mutate(
      { id: appointment.id, status: "CONFIRMED" },
      {
        onSuccess: () => {
          toast.success(t("appointments.reinstated"));
          onDone?.();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {appointment.status === "CANCELLED" ? (
        <Button variant="outline" size="sm" onClick={onReinstate}>
          <RotateCcw />
          {t("appointments.reinstate")}
        </Button>
      ) : (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRescheduleOpen(true)}
          >
            <CalendarClock />
            {t("appointments.reschedule")}
          </Button>

          {!isLive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNoShowOpen(true)}
              className="text-destructive hover:text-destructive"
            >
              <CircleSlash />
              {t("appointments.markNoShow")}
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCancelOpen(true)}
            className="text-destructive hover:text-destructive"
          >
            <XCircle />
            {t("appointments.cancel")}
          </Button>
        </>
      )}

      <ConfirmDialog
        open={noShowOpen}
        onOpenChange={setNoShowOpen}
        title={t("appointments.markNoShowTitle")}
        description={t("appointments.markNoShowHint")}
        confirmLabel={t("appointments.markNoShow")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={onNoShow}
      >
        <ReasonField
          value={reason}
          onChange={setReason}
          label={t("appointments.reason")}
          placeholder={t("appointments.noShowReasonPlaceholder")}
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={t("appointments.confirmCancel")}
        description={t("appointments.confirmCancelHint")}
        confirmLabel={t("appointments.cancel")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={onCancel}
      >
        <ReasonField
          value={reason}
          onChange={setReason}
          label={t("appointments.reason")}
          placeholder={t("appointments.cancelReasonPlaceholder")}
        />
      </ConfirmDialog>

      <RescheduleDialog
        appointment={appointment}
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        onReschedule={(date, startMinute) => {
          reschedule.mutate(
            { id: appointment.id, payload: { date, startMinute } },
            {
              onSuccess: () => {
                setRescheduleOpen(false);
                toast.success(t("appointments.rescheduled"));
                onDone?.();
              },
              onError: (error) => toast.error(error.message),
            },
          );
        }}
        isPending={reschedule.isPending}
      />
    </div>
  );
}

/** A required free-text reason. */
function ReasonField({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <Label htmlFor="appointment-reason">{label}</Label>
      <Textarea
        id="appointment-reason"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      {!value.trim() && (
        <p className="text-xs font-medium text-destructive">
          {t("appointments.reasonRequired")}
        </p>
      )}
    </div>
  );
}

/** The reschedule dialog — a date picker and the slots for that date. */
export function RescheduleDialog({
  appointment,
  open,
  onOpenChange,
  onReschedule,
  isPending,
}: {
  appointment: Appointment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReschedule: (date: string, startMinute: number) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const [date, setDate] = React.useState(appointment.date);
  const [startMinute, setStartMinute] = React.useState<number | null>(null);

  // The dialog is reused for different appointments, so its state is reset
  // when the appointment changes. React's documented way of doing that is
  // during the render, not in an effect.
  const [lastAppointmentId, setLastAppointmentId] = React.useState(
    appointment.id,
  );
  if (lastAppointmentId !== appointment.id) {
    setLastAppointmentId(appointment.id);
    setDate(appointment.date);
    setStartMinute(null);
  }

  const slots = useSlots(open ? appointment.doctorId : null, open ? date : null);

  const dates = React.useMemo(() => {
    const start = new Date();
    return Array.from({ length: 14 }, (_, index) => {
      const day = new Date(start);
      day.setDate(day.getDate() + index);
      return day.toISOString().slice(0, 10);
    });
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("appointments.reschedule")}</DialogTitle>
          <DialogDescription>
            {t("appointments.rescheduleHint")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("appointments.selectDate")}</Label>
            <div className="flex flex-wrap gap-2">
              {dates.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setDate(option);
                    setStartMinute(null);
                  }}
                  className={cnDate(date === option)}
                >
                  {formatDate(option)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("appointments.availableSlots")}</Label>
            {slots.isLoading ? (
              <p className="text-sm text-muted-foreground">
                {t("common.loading")}
              </p>
            ) : (
              <SlotGrid
                slots={slots.data?.slots ?? []}
                value={startMinute}
                onSelect={setStartMinute}
                currentSlot={appointment.startMinute}
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => {
              if (startMinute === null) return;
              onReschedule(date, startMinute);
            }}
            disabled={startMinute === null || isPending}
          >
            {isPending ? t("common.saving") : t("appointments.reschedule")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The class for a date chip. */
function cnDate(selected: boolean): string {
  return selected
    ? "rounded-md border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors"
    : "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent";
}

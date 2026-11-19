"use client";

import * as React from "react";
import { toast } from "sonner";
import { CalendarClock, XCircle } from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import {
  useCancelAppointment,
  useRescheduleAppointment,
  useSlots,
} from "@/features/appointments/hooks/use-appointments";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDate, formatMinute12, todayIso, addDaysIso } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/types";

/**
 * The cancel and reschedule actions.
 *
 * Both act on a booking the patient owns. The slot grid in the reschedule
 * dialog comes from the same service the booking screen uses, so a slot that
 * has just been taken is shown as unavailable rather than accepted.
 */
export function AppointmentActions({
  appointment,
  onDone,
}: {
  appointment: Appointment;
  onDone?: () => void;
}) {
  const { t } = useTranslation();
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [rescheduleOpen, setRescheduleOpen] = React.useState(false);

  const cancel = useCancelAppointment();
  const reschedule = useRescheduleAppointment();

  const onCancel = () => {
    cancel.mutate(
      { id: appointment.id, reason: "Cancelled by the patient" },
      {
        onSuccess: () => {
          setCancelOpen(false);
          toast.success(t("appointments.cancelled"));
          onDone?.();
        },
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setRescheduleOpen(true)}
      >
        <CalendarClock />
        {t("appointments.reschedule")}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setCancelOpen(true)}
        className="text-destructive hover:text-destructive"
      >
        <XCircle />
        {t("appointments.cancel")}
      </Button>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={t("appointments.confirmCancel")}
        description={t("appointments.confirmCancelHint")}
        confirmLabel={t("appointments.cancel")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={onCancel}
      />

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
              onError: (error) => {
                toast.error(error.message);
              },
            },
          );
        }}
        isPending={reschedule.isPending}
      />
    </div>
  );
}

/** The reschedule dialog — a date picker and the slots for that date. */
function RescheduleDialog({
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

  const slots = useSlots(open ? appointment.doctorId : null, open ? date : null);

  // The next fourteen days, which is the booking window.
  const dates = React.useMemo(() => {
    const start = todayIso();
    return Array.from({ length: 14 }, (_, index) => addDaysIso(start, index));
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
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                    date === option
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-accent",
                  )}
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
            ) : (slots.data?.slots ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("appointments.noSlotsHint")}
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {(slots.data?.slots ?? []).map((slot) => (
                  <button
                    key={slot.startMinute}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => setStartMinute(slot.startMinute)}
                    className={cn(
                      "rounded-md border px-2 py-2 text-xs font-medium transition-colors",
                      !slot.available &&
                        "cursor-not-allowed bg-muted/50 text-muted-foreground line-through",
                      slot.available &&
                        startMinute === slot.startMinute &&
                        "border-primary bg-primary text-primary-foreground",
                      slot.available &&
                        startMinute !== slot.startMinute &&
                        "hover:border-primary hover:bg-accent",
                    )}
                  >
                    {formatMinute12(slot.startMinute)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {slots.error && (
            <Alert variant="destructive">
              <AlertDescription>{slots.error.message}</AlertDescription>
            </Alert>
          )}
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

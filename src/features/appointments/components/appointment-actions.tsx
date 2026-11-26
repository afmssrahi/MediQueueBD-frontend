"use client";

import * as React from "react";
import { toast } from "sonner";
import { CalendarClock, XCircle } from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import {
  useCancelAppointment,
  useRescheduleAppointment,
} from "@/features/appointments/hooks/use-appointments";
import { RescheduleDialog } from "@/features/appointments/components/staff-appointment-actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Appointment } from "@/types";

/**
 * The cancel and reschedule actions a patient has.
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
  const [reason, setReason] = React.useState("");

  const cancel = useCancelAppointment();
  const reschedule = useRescheduleAppointment();

  const onCancel = () => {
    cancel.mutate(
      { id: appointment.id, reason: reason.trim() },
      {
        onSuccess: () => {
          setCancelOpen(false);
          setReason("");
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
      >
        <div className="space-y-2">
          <Label htmlFor="cancel-reason">{t("appointments.reason")}</Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("appointments.cancelReasonPlaceholder")}
          />
          {!reason.trim() && (
            <p className="text-xs font-medium text-destructive">
              {t("appointments.reasonRequired")}
            </p>
          )}
        </div>
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

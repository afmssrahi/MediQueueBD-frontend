"use client";

import * as React from "react";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import { useDoctors } from "@/features/doctors/hooks/use-doctors";
import { useBookAppointment, useSlots } from "@/features/appointments/hooks/use-appointments";
import { SlotGrid, BreakNotice } from "@/features/appointments/components/slot-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { APPOINTMENT_TYPES } from "@/lib/constants";
import { formatDate, todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The reception booking form.
 *
 * Staff book on behalf of a patient — at the counter, or on the phone. The
 * rules are the same as the patient's own: the same slot grid, the same
 * double-booking guard, the same booking window.
 */
export function StaffBookingDialog({
  patients,
  defaultDoctorId,
  onOpenChange,
  onBooked,
}: {
  /** The patients of this hospital. */
  patients: { id: string; name: string }[];
  defaultDoctorId?: string;
  onOpenChange: (open: boolean) => void;
  onBooked?: () => void;
}) {
  const { t } = useTranslation();

  const [patientId, setPatientId] = React.useState("");
  const [doctorId, setDoctorId] = React.useState(defaultDoctorId ?? "");
  const [date, setDate] = React.useState("");
  const [startMinute, setStartMinute] = React.useState<number | null>(null);
  const [type, setType] = React.useState<string>("New");
  const [reason, setReason] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState("Cash");

  // The desk may open the dialog for a different doctor (the doctor filter
  // on the desk). React's documented way of reacting to a changed prop is
  // during the render, not in an effect.
  const [lastDefaultDoctorId, setLastDefaultDoctorId] = React.useState(
    defaultDoctorId,
  );
  if (lastDefaultDoctorId !== defaultDoctorId) {
    setLastDefaultDoctorId(defaultDoctorId);
    setDoctorId(defaultDoctorId ?? "");
    setDate("");
    setStartMinute(null);
  }

  const doctors = useDoctors({});
  const slots = useSlots(doctorId || null, date || null);
  const book = useBookAppointment();

  const dates = React.useMemo(() => {
    const start = todayIso();
    return Array.from({ length: 14 }, (_, index) => {
      const day = new Date(start);
      day.setDate(day.getDate() + index);
      return day.toISOString().slice(0, 10);
    });
  }, []);

  const reset = () => {
    setPatientId("");
    setDoctorId(defaultDoctorId ?? "");
    setDate("");
    setStartMinute(null);
    setType("New");
    setReason("");
    setPaymentMethod("Cash");
  };

  const canSubmit = Boolean(patientId && doctorId && date && startMinute);

  const onSubmit = () => {
    if (!canSubmit || startMinute === null) return;

    book.mutate(
      {
        patientId,
        doctorId,
        date,
        startMinute,
        type,
        reason,
        paymentMethod: paymentMethod as "Cash" | "Bkash" | "Card",
        isPaid: paymentMethod !== "Cash",
      },
      {
        onSuccess: (appointment) => {
          onOpenChange(false);
          reset();
          toast.success(t("appointments.booked"), {
            description: t("appointments.bookedDescription", {
              token: appointment.tokenNumber,
            }),
          });
          onBooked?.();
        },
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  };

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) {
          onOpenChange(false);
          reset();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("appointments.staffBookTitle")}</DialogTitle>
          <DialogDescription>
            {t("appointments.staffBookHint")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="staff-patient">{t("queue.patient")}</Label>
            <Input
              id="staff-patient"
              list="staff-patient-options"
              value={patientId}
              onChange={(event) => {
                const value = event.target.value;
                const match = patients.find(
                  (patient) =>
                    patient.id === value ||
                    patient.name.toLowerCase() === value.toLowerCase(),
                );
                setPatientId(match ? match.id : value);
                if (!match) setReason("");
              }}
              placeholder={t("appointments.patientPlaceholder")}
            />
            <datalist id="staff-patient-options">
              {patients.map((patient) => (
                <option key={patient.id} value={patient.name}>
                  {patient.id}
                </option>
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground">
              {patientId && patients.some((p) => p.id === patientId)
                ? t("appointments.patientResolved", {
                    name:
                      patients.find((p) => p.id === patientId)?.name ?? patientId,
                  })
                : t("appointments.patientHint")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="staff-doctor">{t("appointments.selectDoctor")}</Label>
            <Select
              value={doctorId}
              onValueChange={(value) => {
                setDoctorId(value);
                setDate("");
                setStartMinute(null);
              }}
            >
              <SelectTrigger id="staff-doctor">
                <SelectValue placeholder={t("appointments.selectDoctor")} />
              </SelectTrigger>
              <SelectContent>
                {(doctors.data ?? []).map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    {doctor.name} — {doctor.speciality}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

          {doctorId && date && (
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
                />
              )}
              <BreakNotice
                breakStart={slots.data?.breakStart ?? null}
                breakEnd={slots.data?.breakEnd ?? null}
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="staff-type">{t("appointments.type")}</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="staff-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPOINTMENT_TYPES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff-payment">{t("appointments.payment")}</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="staff-payment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Bkash">Bkash</SelectItem>
                  <SelectItem value="Card">Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="staff-reason">{t("appointments.reason")}</Label>
            <Textarea
              id="staff-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("appointments.reasonPlaceholder")}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              reset();
            }}
          >
            {t("common.cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit || book.isPending}>
            <CalendarPlus />
            {book.isPending ? t("appointments.booking") : t("appointments.book")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

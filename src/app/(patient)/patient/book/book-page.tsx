"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarCheck, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/provider";
import { useSession } from "@/stores/session";
import { useDoctors } from "@/features/doctors/hooks/use-doctors";
import {
  useBookAppointment,
  useSlots,
} from "@/features/appointments/hooks/use-appointments";
import { PageHeader } from "@/components/shared/page-header";
import { DemoBadge } from "@/components/shared/demo-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { APPOINTMENT_TYPES } from "@/lib/constants";
import { addDaysIso, formatDate, formatMinute12, todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";

const bookingSchema = z.object({
  date: z.string().min(1, "Choose a date"),
  startMinute: z.number().min(0, "Choose a slot"),
  type: z.string().min(1),
  reason: z.string().min(3, "Describe your symptoms briefly"),
  paymentMethod: z.enum(["Cash", "Bkash", "Card"]),
});

type BookingValues = z.infer<typeof bookingSchema>;

/**
 * The booking flow.
 *
 * doctor → date → slot → confirm. Each step filters the next, and the
 * double-booking guard lives in the service layer — the slot grid reflects
 * what the demo database actually holds.
 */
export function BookAppointmentPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useSession((state) => state.user);

  // A doctor can be chosen from the public directory before the booking screen
  // opens, so the flow starts at step two instead of step one.
  const [doctorId, setDoctorId] = React.useState<string>(
    () => searchParams.get("doctor") ?? "",
  );
  const [date, setDate] = React.useState<string>("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [booked, setBooked] = React.useState<{
    token: number;
    doctorName: string;
    date: string;
    startMinute: number;
  } | null>(null);

  const doctors = useDoctors({});
  const slots = useSlots(doctorId || null, date || null);
  const book = useBookAppointment();

  const form = useForm<BookingValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      date: "",
      startMinute: 0,
      type: "New",
      reason: "",
      paymentMethod: "Bkash",
    },
  });

  const selectedDoctor = (doctors.data ?? []).find(
    (item) => item.id === doctorId,
  );

  // `useWatch` subscribes to the fields the page renders, so the slot grid and
  // the confirm dialog always show the current value.
  const [watchedDate, watchedStartMinute, watchedType, watchedPayment, watchedReason] =
    useWatch({
      control: form.control,
      name: ["date", "startMinute", "type", "paymentMethod", "reason"],
    });

  const dates = React.useMemo(() => {
    const start = todayIso();
    return Array.from({ length: 14 }, (_, index) => addDaysIso(start, index));
  }, []);

  const onSlotSelect = (minute: number) => {
    form.setValue("startMinute", minute, { shouldValidate: true });
  };

  const onSubmit = (values: BookingValues) => {
    if (!doctorId) return;

    book.mutate(
      {
        patientId: user?.id ?? "",
        doctorId,
        date: values.date,
        startMinute: values.startMinute,
        type: values.type,
        reason: values.reason,
        paymentMethod: values.paymentMethod,
        isPaid: values.paymentMethod === "Bkash" || values.paymentMethod === "Card",
      },
      {
        onSuccess: (appointment) => {
          setConfirmOpen(false);
          setBooked({
            token: appointment.tokenNumber,
            doctorName: appointment.doctorName,
            date: appointment.date,
            startMinute: appointment.startMinute,
          });
          toast.success(t("appointments.booked"), {
            description: t("appointments.bookedDescription", {
              token: appointment.tokenNumber,
            }),
          });
          router.push("/patient/appointments");
        },
        onError: (error) => {
          toast.error(error.message, {
            description: t("appointments.slotTakenHint"),
          });
        },
      },
    );
  };

  if (booked) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("appointments.booked")}
          description={t("appointments.bookedDescription", { token: booked.token })}
          actions={<DemoBadge />}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("appointments.title")}
        description={t("appointments.subtitle")}
        actions={<DemoBadge />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                1
              </span>
              {t("appointments.selectDoctor")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={doctorId}
              onValueChange={(value) => {
                setDoctorId(value);
                setDate("");
                form.setValue("startMinute", 0);
              }}
            >
              <SelectTrigger>
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
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                2
              </span>
              {t("appointments.selectDate")} · {t("appointments.availableSlots")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!doctorId ? (
              <EmptyState
                title={t("appointments.selectDoctor")}
                description={t("appointments.subtitle")}
                icon={CalendarDays}
              />
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {dates.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setDate(option);
                        form.setValue("date", option, { shouldValidate: true });
                        form.setValue("startMinute", 0);
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

                {!date ? (
                  <p className="text-sm text-muted-foreground">
                    {t("appointments.selectDate")}
                  </p>
                ) : slots.isLoading ? (
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
                        onClick={() => onSlotSelect(slot.startMinute)}
                        className={cn(
                          "rounded-md border px-2 py-2 text-xs font-medium transition-colors",
                          !slot.available &&
                            "cursor-not-allowed bg-muted/50 text-muted-foreground line-through",
                          slot.available &&
                            watchedStartMinute === slot.startMinute &&
                            "border-primary bg-primary text-primary-foreground",
                          slot.available &&
                            watchedStartMinute !== slot.startMinute &&
                            "hover:border-primary hover:bg-accent",
                        )}
                      >
                        {formatMinute12(slot.startMinute)}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                3
              </span>
              {t("appointments.confirmTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={form.handleSubmit((values) => {
                if (!doctorId) return;
                setConfirmOpen(true);
                void values;
              })}
              className="grid gap-4 md:grid-cols-2"
            >
              <div className="space-y-2">
                <Label htmlFor="date">{t("appointments.selectDate")}</Label>
                <Input
                  id="date"
                  type="date"
                  {...form.register("date")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">{t("appointments.type")}</Label>
                <Select
                  value={watchedType}
                  onValueChange={(value) => form.setValue("type", value)}
                >
                  <SelectTrigger id="type">
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

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="reason">{t("appointments.reason")}</Label>
                <Textarea
                  id="reason"
                  placeholder={t("appointments.reasonPlaceholder")}
                  {...form.register("reason")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment">{t("appointments.payment")}</Label>
                <Select
                  value={watchedPayment}
                  onValueChange={(value) =>
                    form.setValue("paymentMethod", value as BookingValues["paymentMethod"])
                  }
                >
                  <SelectTrigger id="payment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Bkash">Bkash</SelectItem>
                    <SelectItem value="Card">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end justify-end">
                <Button
                  type="submit"
                  disabled={!doctorId || !watchedStartMinute}
                >
                  <CalendarCheck />
                  {t("appointments.book")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* The confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("appointments.confirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("appointments.confirmDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm">
            <p className="font-medium">
              {selectedDoctor?.name ?? "—"}
            </p>
            <p className="text-muted-foreground">
              {formatDate(watchedDate)} · {formatMinute12(watchedStartMinute)}
            </p>
            <p className="text-muted-foreground">
              {t("appointments.type")}: {watchedType}
            </p>
            <p className="text-muted-foreground">
              {t("appointments.payment")}: {watchedPayment}
            </p>
            <p className="text-muted-foreground">
              {t("appointments.reason")}: {watchedReason}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={form.handleSubmit(onSubmit)}
              disabled={book.isPending}
            >
              {book.isPending ? t("appointments.booking") : t("appointments.book")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * The route entry point.
 *
 * `useSearchParams` is a runtime value, so the page is wrapped in a Suspense
 * boundary to let Next.js prerender the route shell.
 */
export function BookAppointmentRoute() {
  return (
    <React.Suspense fallback={null}>
      <BookAppointmentPage />
    </React.Suspense>
  );
}

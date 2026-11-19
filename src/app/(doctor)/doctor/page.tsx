"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Clock,
  FileText,
  Hourglass,
  Users,
} from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import { useSession } from "@/stores/session";
import { useAppointments } from "@/features/appointments/hooks/use-appointments";
import { useRecords } from "@/features/emr/hooks/use-emr";
import { useQueues } from "@/features/queue/hooks/use-queue";
import { useDoctors } from "@/features/doctors/hooks/use-doctors";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { DemoBadge } from "@/components/shared/demo-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, formatDuration, formatMinute12, todayIso } from "@/lib/format";

/**
 * The doctor dashboard.
 *
 * Everything is scoped to the signed-in doctor: their queue, their day, and
 * the patients they have seen.
 */
export default function DoctorDashboardPage() {
  const { t } = useTranslation();
  const user = useSession((state) => state.user);

  const doctors = useDoctors({});
  const doctor = (doctors.data ?? []).find(
    (item) => item.id === user?.doctorId,
  );

  const doctorId = doctor?.id ?? null;

  const appointments = useAppointments({ doctorId: doctorId ?? undefined });
  const records = useRecords({ doctorId: doctorId ?? undefined });
  const queues = useQueues(undefined, undefined, doctorId ?? undefined);

  const today = todayIso();
  const all = appointments.data ?? [];

  const todays = all
    .filter((item) => item.date === today)
    .sort((a, b) => a.startMinute - b.startMinute);

  const completed = todays.filter((item) => item.status === "COMPLETED").length;
  const remaining = todays.length - completed;

  const snapshot = queues.data?.queues?.[0] ?? null;
  const entries = snapshot?.entries ?? [];
  const waiting = entries.filter(
    (entry) =>
      entry.checkedInAt !== null &&
      !["COMPLETED", "CANCELLED", "NO_SHOW", "SKIPPED"].includes(entry.status),
  );
  const current = entries.find(
    (entry) =>
      entry.status === "IN_CONSULTATION" || entry.status === "CALLED",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.dashboard")}
        description={t("queue.subtitle")}
        actions={
          <>
            <DemoBadge />
            <Button asChild>
              <Link href="/doctor/queue">
                <Activity />
                {t("nav.queueBoard")}
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("nav.appointments")}
          value={todays.length.toString()}
          icon={CalendarDays}
          hint={t("common.today")}
        />
        <StatCard
          label={t("queue.actions.complete")}
          value={completed.toString()}
          icon={Users}
          hint={`${remaining} ${t("appointments.upcoming").toLowerCase()}`}
        />
        <StatCard
          label={t("queue.waitingRoom")}
          value={waiting.length.toString()}
          icon={Hourglass}
          hint={
            current
              ? `${t("queue.currentConsultation")}: ${current.patientName}`
              : t("queue.noActiveConsultation")
          }
        />
        <StatCard
          label={t("nav.patientRecords")}
          value={(records.data?.length ?? 0).toString()}
          icon={FileText}
          hint={doctor?.speciality}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{t("nav.appointments")}</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/doctor/appointments">
                {t("common.viewDetails")}
                <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {appointments.isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("common.loading")}
              </p>
            ) : todays.length === 0 ? (
              <EmptyState
                title={t("appointments.noAppointments")}
                description={t("appointments.noAppointmentsHint")}
                icon={CalendarDays}
                className="border-0"
              />
            ) : (
              <ul className="divide-y">
                {todays.slice(0, 8).map((appointment) => (
                  <li
                    key={appointment.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">
                        {formatMinute12(appointment.startMinute)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {appointment.patientName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {appointment.reason}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        status={appointment.status}
                        label={t(`status.${appointment.status}`)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {t("appointments.tokenNumber")} {appointment.tokenNumber}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("queue.currentConsultation")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {current ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-lg font-semibold text-primary">
                      #{current.queuePosition}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {current.patientName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("queue.token")} {current.tokenNumber}
                      </p>
                    </div>
                  </div>
                  <StatusBadge
                    status={current.status}
                    label={t(`status.${current.status}`)}
                    showDot
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("waitingTime.estimatedWait")}:{" "}
                    {formatDuration(current.estimatedWaitingMinutes)}
                  </p>
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href="/doctor/queue">
                      {t("common.viewDetails")}
                      <ArrowRight />
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Clock className="size-5 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {t("queue.noActiveConsultation")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("queue.physicalQueueHint")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("nav.queueBoard")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t("queue.subtitle")}
              </p>
              <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
                <Link href="/doctor/queue">
                  <Activity />
                  {t("common.viewDetails")}
                </Link>
              </Button>
            </CardContent>
          </Card>

          {doctor && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("doctors.visitingHours")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="font-medium">{doctor.name}</p>
                <p className="text-muted-foreground">{doctor.speciality}</p>
                <p className="text-muted-foreground">
                  {formatMinute12(doctor.sessionStart)} –{" "}
                  {formatMinute12(doctor.sessionEnd)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("doctors.experience")}: {doctor.experienceYears} ·{" "}
                  {t("doctors.totalPatients")}:{" "}
                  {doctor.totalPatients.toLocaleString("en-US")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(today)}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

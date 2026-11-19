"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  ClipboardList,
  FileText,
  Hourglass,
  Pill,
} from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import { useSession } from "@/stores/session";
import { useMyAppointments } from "@/features/appointments/hooks/use-appointments";
import { usePrescriptions, useRecords } from "@/features/emr/hooks/use-emr";
import { useReports } from "@/features/diagnostics/hooks/use-diagnostics";
import { useQueues } from "@/features/queue/hooks/use-queue";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { DemoBadge } from "@/components/shared/demo-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, formatMinute12, formatRelative } from "@/lib/format";
import { todayIso } from "@/lib/format";
import type { QueueSnapshot } from "@/types";

/** Find the signed-in patient's entry across every doctor's queue. */
function findQueueEntry(
  queues: QueueSnapshot[],
  patientId: string | null,
): { entry: QueueSnapshot["entries"][number]; doctorId: string } | null {
  if (!patientId) return null;

  for (const snapshot of queues) {
    const entry = snapshot.entries.find((item) => item.patientId === patientId);
    if (entry) return { entry, doctorId: snapshot.doctorId };
  }

  return null;
}

/** The patient dashboard. */
export default function PatientDashboardPage() {
  const { t } = useTranslation();
  const user = useSession((state) => state.user);
  const patientId = user?.id ?? null;

  const appointments = useMyAppointments({});
  const records = useRecords({ patientId: patientId ?? undefined });
  const prescriptions = usePrescriptions(patientId ?? undefined);
  const reports = useReports({ patientId: patientId ?? undefined });
  const queues = useQueues();

  const today = todayIso();
  const allAppointments = appointments.data ?? [];

  const upcoming = allAppointments
    .filter(
      (item) =>
        item.date >= today &&
        !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(item.status),
    )
    .sort((a, b) =>
      `${a.date}${a.startMinute}`.localeCompare(`${b.date}${b.startMinute}`),
    );

  const previous = allAppointments
    .filter(
      (item) => item.date < today || ["COMPLETED", "CANCELLED"].includes(item.status),
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  const next = upcoming[0] ?? null;

  // The patient's own queue entry, found across every doctor's queue.
  // The React Compiler memoizes this for us — a manual useMemo here cannot be
  // preserved and is rejected by the compiler lint.
  const myQueueEntry = findQueueEntry(queues.data?.queues ?? [], patientId);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("patient.overviewTitle")}
        description={t("patient.overviewSubtitle")}
        actions={
          <>
            <DemoBadge />
            <Button asChild>
              <Link href="/patient/book">
                <CalendarDays />
                {t("nav.bookAppointment")}
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("patient.nextAppointment")}
          value={
            next ? formatDate(next.date) : t("patient.noUpcoming")
          }
          icon={CalendarDays}
          hint={
            next
              ? `${next.doctorName} · ${formatMinute12(next.startMinute)}`
              : t("patient.noUpcomingHint")
          }
        />
        <StatCard
          label={t("patient.queuePosition")}
          value={
            myQueueEntry
              ? `#${myQueueEntry.entry.queuePosition}`
              : t("common.notAvailable")
          }
          icon={Activity}
          hint={
            myQueueEntry
              ? t("queue.token") + " " + myQueueEntry.entry.tokenNumber
              : t("patient.activeQueueNoneHint")
          }
        />
        <StatCard
          label={t("patient.estimatedWait")}
          value={
            myQueueEntry?.entry.estimatedWaitingMinutes !== null &&
            myQueueEntry?.entry.estimatedWaitingMinutes !== undefined
              ? `${myQueueEntry.entry.estimatedWaitingMinutes} ${t("common.minutes")}`
              : t("common.notAvailable")
          }
          icon={Hourglass}
          hint={
            myQueueEntry?.entry.isProvisional
              ? t("waitingTime.provisional")
              : undefined
          }
        />
        <StatCard
          label={t("patient.medicalHistory")}
          value={(records.data?.length ?? 0).toString()}
          icon={FileText}
          hint={`${(prescriptions.data?.length ?? 0).toString()} ${t("patient.prescriptions").toLowerCase()}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              {t("appointments.upcoming")}
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/patient/appointments">
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
            ) : upcoming.length === 0 ? (
              <EmptyState
                title={t("patient.noUpcoming")}
                description={t("patient.noUpcomingHint")}
                icon={CalendarDays}
              />
            ) : (
              <ul className="divide-y">
                {upcoming.slice(0, 5).map((appointment) => (
                  <li
                    key={appointment.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {appointment.doctorName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {appointment.hospitalName} ·{" "}
                        {formatDate(appointment.date)} ·{" "}
                        {formatMinute12(appointment.startMinute)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={appointment.status} />
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
                {t("patient.activeQueueNone")
                  ? t("nav.waitingTime")
                  : t("nav.waitingTime")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {myQueueEntry ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-lg font-semibold text-primary">
                      #{myQueueEntry.entry.queuePosition}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {myQueueEntry.entry.patientName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("queue.token")} {myQueueEntry.entry.tokenNumber}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={myQueueEntry.entry.status} showDot />
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href="/patient/queue">
                      {t("common.viewDetails")}
                      <ArrowRight />
                    </Link>
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("patient.activeQueueNoneHint")}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("patient.latestReports")}</CardTitle>
            </CardHeader>
            <CardContent>
              {(reports.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("diagnostics.noReportsHint")}
                </p>
              ) : (
                <ul className="space-y-3">
                  {(reports.data ?? []).slice(0, 3).map((report) => (
                    <li key={report.id} className="flex items-start gap-2">
                      <ClipboardList className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {report.testName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelative(report.createdAt)}
                        </p>
                      </div>
                      <StatusBadge
                        status={report.status}
                        className="ml-auto shrink-0"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {previous.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("appointments.previous")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {previous.slice(0, 4).map((appointment) => (
                <li
                  key={appointment.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Pill className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {appointment.doctorName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(appointment.date)} ·{" "}
                        {appointment.reason}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={appointment.status} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Clock,
  Hourglass,
  UserCheck,
  UserX,
} from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import { useSession } from "@/stores/session";
import { useAppointments } from "@/features/appointments/hooks/use-appointments";
import { useQueues, useQueueEvents, useHospitalStats } from "@/features/queue/hooks/use-queue";
import { useDoctors } from "@/features/doctors/hooks/use-doctors";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { DemoBadge } from "@/components/shared/demo-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDuration, formatMinute12, todayIso } from "@/lib/format";
import type { QueueSnapshot } from "@/types";

/**
 * The reception desk.
 *
 * The receptionist's job is the waiting room: who is here, who is still at
 * home, and what the next few hours look like. Every number comes from the
 * queue engine against the demo database.
 */
export default function HospitalDashboardPage() {
  const { t } = useTranslation();
  const user = useSession((state) => state.user);
  const hospitalId = user?.hospitalId ?? undefined;

  const appointments = useAppointments({ hospitalId });
  const queues = useQueues(hospitalId);
  const events = useQueueEvents();
  const stats = useHospitalStats(hospitalId);
  const doctors = useDoctors({ hospitalId });

  const today = todayIso();
  const todays = (appointments.data ?? []).filter((item) => item.date === today);

  const snapshots = queues.data?.queues ?? [];
  const entries = snapshots.flatMap((snapshot) =>
    snapshot.entries.map((entry) => ({ entry, snapshot })),
  );

  const waiting = entries.filter(
    ({ entry }) =>
      entry.checkedInAt !== null &&
      !["COMPLETED", "CANCELLED", "NO_SHOW", "SKIPPED"].includes(entry.status),
  );
  const atHome = entries.filter(
    ({ entry }) =>
      entry.checkedInAt === null &&
      !["COMPLETED", "CANCELLED", "NO_SHOW", "SKIPPED"].includes(entry.status),
  );

  const completed = todays.filter((item) => item.status === "COMPLETED").length;
  const noShow = todays.filter((item) => item.status === "NO_SHOW").length;

  // The hospital's own doctors, so the waiting-room list can name them.
  const doctorNames = new Map(
    (doctors.data ?? []).map((doctor) => [doctor.id, doctor.name]),
  );

  // Only this hospital's events — the queue log spans the whole platform.
  const hospitalDoctorIds = new Set((doctors.data ?? []).map((d) => d.id));
  const recentEvents = (events.data ?? [])
    .filter((event) => event.doctorId && hospitalDoctorIds.has(event.doctorId))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("hospitalStaff.title")}
        description={t("hospitalStaff.subtitle")}
        actions={
          <>
            <DemoBadge />
            <Button asChild>
              <Link href="/hospital/queue">
                <Activity />
                {t("hospitalStaff.openQueue")}
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("hospitalStaff.waitingNow")}
          value={waiting.length.toString()}
          icon={Hourglass}
          hint={`${atHome.length} ${t("queue.virtualQueue").toLowerCase()}`}
        />
        <StatCard
          label={t("hospitalStaff.appointmentsToday")}
          value={todays.length.toString()}
          icon={CalendarDays}
          hint={`${completed} ${t("queue.actions.complete").toLowerCase()}`}
        />
        <StatCard
          label={t("hospitalStaff.completedToday")}
          value={completed.toString()}
          icon={UserCheck}
          hint={t("common.today")}
        />
        <StatCard
          label={t("hospitalStaff.noShowToday")}
          value={noShow.toString()}
          icon={UserX}
          hint={
            stats.data
              ? `${stats.data.metrics.noShowRate?.toFixed(0) ?? 0}%`
              : undefined
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              {t("hospitalStaff.waitingRoom")}
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/hospital/queue">
                {t("common.viewDetails")}
                <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {waiting.length === 0 ? (
              <EmptyState
                title={t("queue.noQueueEntries")}
                description={t("hospitalStaff.checkInHint")}
                icon={UserCheck}
                className="border-0"
              />
            ) : (
              <ul className="divide-y">
                {waiting.slice(0, 8).map(({ entry, snapshot }) => (
                  <li
                    key={entry.appointmentId}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                        #{entry.queuePosition}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {entry.patientName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {doctorNames.get(snapshot.doctorId) ?? snapshot.doctorId} ·{" "}
                          {t("queue.token")} {entry.tokenNumber}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDuration(entry.estimatedWaitingMinutes)}
                      </span>
                      <StatusBadge
                        status={entry.status}
                        label={t(`status.${entry.status}`)}
                      />
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
                {t("hospitalStaff.recentActivity")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("hospitalStaff.noActivity")}
                </p>
              ) : (
                <ul className="space-y-3">
                  {recentEvents.map((event) => (
                    <li key={event.id} className="flex items-start gap-2">
                      <Clock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm">{event.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatMinute12(event.minute)} · {event.actor}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("queue.waitingRoom")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <QueueByDoctor snapshots={snapshots} doctorNames={doctorNames} />
              <p className="text-xs text-muted-foreground">
                {t("hospitalStaff.checkInHint")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** A one-line waiting-room summary per doctor. */
function QueueByDoctor({
  snapshots,
  doctorNames,
}: {
  snapshots: QueueSnapshot[];
  doctorNames: Map<string, string>;
}) {
  const { t } = useTranslation();

  if (snapshots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("hospitalStaff.noDoctors")}</p>
    );
  }

  return (
    <ul className="space-y-2">
      {snapshots.map((snapshot) => {
        const waiting = snapshot.entries.filter(
          (entry) =>
            entry.checkedInAt !== null &&
            !["COMPLETED", "CANCELLED", "NO_SHOW", "SKIPPED"].includes(
              entry.status,
            ),
        ).length;

        return (
          <li
            key={snapshot.doctorId}
            className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
          >
            <span className="truncate text-sm">
              {doctorNames.get(snapshot.doctorId) ?? snapshot.doctorId}
            </span>
            <Badge variant={waiting > 0 ? "info" : "muted"}>
              {waiting} {t("hospitalStaff.waitingNow").toLowerCase()}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}

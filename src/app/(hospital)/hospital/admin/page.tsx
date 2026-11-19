"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Building2,
  CalendarDays,
  Stethoscope,
  Users,
  UserX,
} from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import { useSession } from "@/stores/session";
import { useDoctors } from "@/features/doctors/hooks/use-doctors";
import { useDepartments } from "@/features/hospitals/hooks/use-hospitals";
import { useAppointments } from "@/features/appointments/hooks/use-appointments";
import { useStaff } from "@/features/admin/hooks/use-admin";
import { useHospitalStats } from "@/features/queue/hooks/use-queue";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { DemoBadge } from "@/components/shared/demo-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { BarSeriesChart } from "@/components/shared/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMinute12, formatPercent, todayIso } from "@/lib/format";

/**
 * The hospital administrator dashboard.
 *
 * Every number is scoped to the signed-in administrator's hospital, so the
 * administrator never sees another hospital's data.
 */
export default function HospitalAdminDashboardPage() {
  const { t } = useTranslation();
  const user = useSession((state) => state.user);
  const hospitalId = user?.hospitalId ?? undefined;

  const doctors = useDoctors({ hospitalId });
  const departments = useDepartments(hospitalId);
  const staff = useStaff(hospitalId);
  const appointments = useAppointments({ hospitalId });
  const stats = useHospitalStats(hospitalId);

  const today = todayIso();
  const allAppointments = appointments.data ?? [];
  const todays = allAppointments.filter((item) => item.date === today);

  const activeDoctors = (doctors.data ?? []).filter((item) => item.active);
  const noShowRate = stats.data?.metrics.noShowRate ?? null;
  const waitingRoomOccupancy = stats.data?.metrics.waitingRoomOccupancy ?? 0;

  const perDay = (stats.data?.appointmentsPerDay ?? []).map((item) => ({
    date: formatDate(item.date),
    count: item.count,
  }));

  const busiestHours = (stats.data?.busiestHours ?? []).map((item) => ({
    hour: `${String(item.hour).padStart(2, "0")}:00`,
    count: item.count,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("hospitalAdmin.title")}
        description={t("hospitalAdmin.subtitle")}
        actions={<DemoBadge />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("hospitalAdmin.activeDoctors")}
          value={activeDoctors.length.toString()}
          icon={Stethoscope}
          hint={t("hospitalAdmin.departmentCount", {
            count: (departments.data ?? []).length,
          })}
        />
        <StatCard
          label={t("hospitalAdmin.pendingAppointments")}
          value={(stats.data?.pendingAppointments ?? 0).toString()}
          icon={CalendarDays}
          hint={t("common.today")}
        />
        <StatCard
          label={t("hospitalAdmin.waitingNow")}
          value={waitingRoomOccupancy.toString()}
          icon={Users}
          hint={t("hospitalAdmin.queueOccupancy")}
        />
        <StatCard
          label={t("hospitalAdmin.noShowRate")}
          value={formatPercent(noShowRate)}
          icon={UserX}
          hint={t("common.today")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              {t("hospitalAdmin.appointmentsPerDay")}
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/hospital/admin/analytics">
                {t("common.viewDetails")}
                <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {perDay.length === 0 ? (
              <EmptyState
                title={t("common.emptyState.title")}
                description={t("common.emptyState.description")}
                icon={Activity}
                className="border-0"
              />
            ) : (
              <BarSeriesChart
                data={perDay}
                labelKey="date"
                valueKey="count"
                seriesLabel={t("hospitalAdmin.appointmentsPerDay")}
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("hospitalAdmin.busiestHours")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {busiestHours.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("common.notAvailable")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {busiestHours.map((slot) => (
                    <li
                      key={slot.hour}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="font-medium">{slot.hour}</span>
                      <Badge variant="secondary">{slot.count}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("common.today")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t("nav.appointments")}
                </span>
                <span className="font-medium">{todays.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t("queue.actions.complete")}
                </span>
                <span className="font-medium">
                  {todays.filter((item) => item.status === "COMPLETED").length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t("diagnostics.delivered")}
                </span>
                <span className="font-medium">
                  {todays.filter((item) => item.status === "NO_SHOW").length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Every card states which section it links to. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SectionLink
          href="/hospital/admin/doctors"
          icon={Stethoscope}
          title={t("hospitalAdmin.doctorManagement")}
          description={t("doctors.doctorCount", {
            count: (doctors.data ?? []).length,
          })}
        />
        <SectionLink
          href="/hospital/admin/departments"
          icon={Building2}
          title={t("hospitalAdmin.departmentManagement")}
          description={t("hospitalAdmin.departmentCount", {
            count: (departments.data ?? []).length,
          })}
        />
        <SectionLink
          href="/hospital/admin/staff"
          icon={Users}
          title={t("hospitalAdmin.staffManagement")}
          description={t("hospitalAdmin.staffCount", {
            count: (staff.data ?? []).length,
          })}
        />
        <SectionLink
          href="/hospital/admin/queue"
          icon={Activity}
          title={t("hospitalAdmin.queueOverview")}
          description={t("hospitalAdmin.waitingNow")}
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {t("hospitalAdmin.appointmentOverview")}
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/hospital/admin/appointments">
              {t("common.viewDetails")}
              <ArrowRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {todays.length === 0 ? (
            <EmptyState
              title={t("appointments.noAppointments")}
              description={t("appointments.noAppointmentsHint")}
              icon={CalendarDays}
              className="border-0"
            />
          ) : (
            <ul className="divide-y">
              {todays.slice(0, 6).map((appointment) => (
                <li
                  key={appointment.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {appointment.patientName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {appointment.doctorName} · {appointment.reason}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      status={appointment.status}
                      label={t(`status.${appointment.status}`)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {formatMinute12(appointment.startMinute)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** A card that points at one section of the administration area. */
function SectionLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full transition-colors hover:border-primary/60">
        <CardContent className="space-y-2 p-5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

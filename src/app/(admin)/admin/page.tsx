"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Building2,
  HeartPulse,
  MessageSquareWarning,
  Settings,
  Stethoscope,
  Users,
} from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import { useSystemStats, useAdminHospitals } from "@/features/admin/hooks/use-admin";
import { useCenters } from "@/features/diagnostics/hooks/use-diagnostics";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { DemoBadge } from "@/components/shared/demo-badge";
import { BarSeriesChart, PieSeriesChart } from "@/components/shared/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, formatPercent } from "@/lib/format";

/**
 * The system administrator dashboard.
 *
 * A platform-wide view: users, hospitals, diagnostic centres and the daily
 * appointment volume, all read from the demo database.
 */
export default function AdminDashboardPage() {
  const { t } = useTranslation();
  const stats = useSystemStats();
  const hospitals = useAdminHospitals();
  const centers = useCenters();

  const perDay = (stats.data?.appointmentsPerDay ?? []).map((item) => ({
    date: formatDate(item.date),
    count: item.count,
  }));

  const usersByRole = Object.entries(stats.data?.usersByRole ?? {}).map(
    ([role, count]) => ({ role: t(`roles.${role}`), count }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.title")}
        description={t("admin.subtitle")}
        actions={<DemoBadge />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("admin.totalUsers")}
          value={(stats.data?.totalUsers ?? 0).toString()}
          icon={Users}
          hint={`${stats.data?.activeUsers ?? 0} ${t("admin.activeUsers").toLowerCase()}`}
        />
        <StatCard
          label={t("admin.totalHospitals")}
          value={(stats.data?.totalHospitals ?? 0).toString()}
          icon={Building2}
          hint={`${stats.data?.verifiedHospitals ?? 0} ${t("admin.verifiedHospitals").toLowerCase()}`}
        />
        <StatCard
          label={t("admin.totalCenters")}
          value={(stats.data?.totalCenters ?? 0).toString()}
          icon={HeartPulse}
          hint={`${(centers.data ?? []).length} ${t("diagnostics.centerCount", { count: (centers.data ?? []).length })}`}
        />
        <StatCard
          label={t("admin.totalAppointments")}
          value={(stats.data?.totalAppointments ?? 0).toString()}
          icon={Activity}
          hint={`${stats.data?.appointmentsToday ?? 0} ${t("admin.appointmentsToday").toLowerCase()}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              {t("adminAnalytics.appointmentsPerDay")}
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/analytics">
                {t("common.viewDetails")}
                <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <BarSeriesChart
              data={perDay}
              labelKey="date"
              valueKey="count"
              seriesLabel={t("adminAnalytics.appointmentsPerDay")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("admin.usersByRole")}</CardTitle>
          </CardHeader>
          <CardContent>
            <PieSeriesChart data={usersByRole} labelKey="role" valueKey="count" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SectionLink
          href="/admin/users"
          icon={Users}
          title={t("admin.userDirectory")}
          description={t("admin.userCount", { count: stats.data?.totalUsers ?? 0 })}
        />
        <SectionLink
          href="/admin/hospitals"
          icon={Building2}
          title={t("admin.hospitalDirectory")}
          description={t("hospitals.hospitalCount", {
            count: (hospitals.data ?? []).length,
          })}
        />
        <SectionLink
          href="/admin/diagnostics"
          icon={HeartPulse}
          title={t("admin.centerDirectory")}
          description={t("diagnostics.centerCount", {
            count: (centers.data ?? []).length,
          })}
        />
        <SectionLink
          href="/admin/settings"
          icon={Settings}
          title={t("admin.systemSettings")}
          description={t("adminSettings.subtitle")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SectionLink
          href="/admin/scenarios"
          icon={MessageSquareWarning}
          title={t("admin.queueScenarios")}
          description={t("admin.queueScenariosHint")}
        />
        <SectionLink
          href="/admin/analytics"
          icon={Stethoscope}
          title={t("adminAnalytics.title")}
          description={t("adminAnalytics.subtitle")}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.systemHealth")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <HealthFigure
            label={t("adminAnalytics.completed")}
            value={(stats.data?.completedAppointments ?? 0).toString()}
          />
          <HealthFigure
            label={t("adminAnalytics.cancelled")}
            value={(stats.data?.cancelledAppointments ?? 0).toString()}
          />
          <HealthFigure
            label={t("adminAnalytics.noShow")}
            value={(stats.data?.noShowAppointments ?? 0).toString()}
          />
          <HealthFigure
            label={t("admin.noShowRate")}
            value={formatPercent(stats.data?.noShowRate)}
          />
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

/** One headline figure inside the system-health card. */
function HealthFigure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  Clock,
  FileText,
  Hourglass,
  PackageCheck,
  Users,
} from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import { useSession } from "@/stores/session";
import { useCenterStats, useReports } from "@/features/diagnostics/hooks/use-diagnostics";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { DemoBadge } from "@/components/shared/demo-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { BarSeriesChart } from "@/components/shared/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, formatRelative } from "@/lib/format";

/**
 * The diagnostic centre staff dashboard.
 *
 * The centre sees its own reports only — the service layer scopes the list to
 * the signed-in user's centre.
 */
export default function DiagnosticDashboardPage() {
  const { t } = useTranslation();
  const user = useSession((state) => state.user);
  const centerId = user?.diagnosticCenterId ?? undefined;

  const reports = useReports(centerId ? { centerId } : {});
  const stats = useCenterStats(centerId);

  const all = reports.data ?? [];
  const pending = all.filter((item) => item.status === "PENDING");
  const processing = all.filter((item) => item.status === "PROCESSING");
  const ready = all.filter((item) => item.status === "READY");

  const perDay = (stats.data?.reportsPerDay ?? []).map((item) => ({
    date: formatDate(item.date),
    count: item.count,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("diagnosticAdmin.title")}
        description={t("diagnosticAdmin.subtitle")}
        actions={<DemoBadge />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("diagnosticAdmin.reportsInQueue")}
          value={(stats.data?.inQueue ?? 0).toString()}
          icon={Hourglass}
          hint={`${processing.length} ${t("diagnosticAdmin.processing").toLowerCase()}`}
        />
        <StatCard
          label={t("diagnosticAdmin.readyForDelivery")}
          value={(stats.data?.readyForDelivery ?? 0).toString()}
          icon={PackageCheck}
          hint={`${ready.length} ${t("diagnosticAdmin.ready").toLowerCase()}`}
        />
        <StatCard
          label={t("diagnosticAdmin.deliveredToday")}
          value={(stats.data?.deliveredToday ?? 0).toString()}
          icon={FileText}
          hint={t("common.today")}
        />
        <StatCard
          label={t("diagnosticAdmin.averageProcessing")}
          value={`${stats.data?.averageProcessingHours ?? 0} h`}
          icon={Clock}
          hint={t("diagnosticAdmin.reportsInQueue")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              {t("diagnosticAdmin.recentReports")}
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/diagnostic/reports">
                {t("common.viewDetails")}
                <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {all.length === 0 ? (
              <EmptyState
                title={t("diagnostics.noReports")}
                description={t("diagnostics.noReportsHint")}
                icon={ClipboardList}
                className="border-0"
              />
            ) : (
              <ul className="divide-y">
                {all.slice(0, 8).map((report) => (
                  <li
                    key={report.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {report.patientName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {report.testName} · {report.reportType}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        status={report.status}
                        label={t(`status.${report.status}`)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {formatRelative(report.createdAt)}
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
                {t("diagnostics.reports")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BarSeriesChart
                data={perDay}
                labelKey="date"
                valueKey="count"
                seriesLabel={t("diagnostics.reports")}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("diagnosticAdmin.patientLookup")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("diagnosticAdmin.findPatient")}
              </p>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href="/diagnostic/patients">
                  <Users />
                  {t("common.search")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("diagnosticAdmin.reportsInQueue")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <EmptyState
              title={t("diagnostics.noReports")}
              description={t("diagnostics.noReportsHint")}
              icon={ClipboardList}
              className="border-0"
            />
          ) : (
            <ul className="divide-y">
              {pending.slice(0, 6).map((report) => (
                <li
                  key={report.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {report.patientName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {report.testName}
                      {report.referredBy ? ` · ${report.referredBy}` : ""}
                    </p>
                  </div>
                  <StatusBadge
                    status={report.status}
                    label={t(`status.${report.status}`)}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { HeartPulse, MapPin, Phone, Star } from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import { useCenter } from "@/features/diagnostics/hooks/use-diagnostics";
import { PageHeader } from "@/components/shared/page-header";
import { DemoBadge } from "@/components/shared/demo-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { MapPlaceholder } from "@/components/shared/map-placeholder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

/** The diagnostic centre profile. */
function DiagnosticCenterDetail() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const centerId = params?.id ?? "";

  const center = useCenter(centerId);

  if (center.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("common.loading")} />
      </div>
    );
  }

  if (!center.data) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("diagnostics.title")} actions={<DemoBadge />} />
        <EmptyState
          title={t("common.noResults")}
          description={t("diagnostics.noCenters")}
          icon={HeartPulse}
        />
      </div>
    );
  }

  const { center: record, reports } = center.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={record.name}
        description={record.address}
        actions={<DemoBadge />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Star className="size-3.5" />
                  {t("hospitals.rating")}
                </div>
                <p className="text-lg font-semibold tracking-tight">
                  {record.rating.toFixed(1)}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <HeartPulse className="size-3.5" />
                  {t("diagnostics.reports")}
                </div>
                <p className="text-lg font-semibold tracking-tight">
                  {reports.length}
                </p>
              </div>
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("hospitals.verification")}
                </div>
                <StatusBadge
                  status={record.verificationStatus}
                  label={record.verificationStatus}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("diagnostics.services")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-wrap gap-2">
                {record.services.map((service) => (
                  <li key={service}>
                    <Badge variant="outline">{service}</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("diagnostics.reports")}</CardTitle>
            </CardHeader>
            <CardContent>
              {reports.length === 0 ? (
                <EmptyState
                  title={t("diagnostics.noReports")}
                  description={t("diagnostics.noReportsHint")}
                  icon={HeartPulse}
                  className="border-0"
                />
              ) : (
                <ul className="divide-y">
                  {reports.slice(0, 10).map((report) => (
                    <li
                      key={report.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {report.testName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {report.reportType}
                          {report.collectedDate
                            ? ` · ${formatDate(report.collectedDate)}`
                            : ""}
                        </p>
                      </div>
                      <StatusBadge status={report.status} label={report.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("hospitals.contactDetails")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  {record.address}
                  <br />
                  <span className="text-xs text-muted-foreground">
                    {record.division}
                  </span>
                </span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="size-4 shrink-0 text-muted-foreground" />
                {record.phone}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("diagnostics.license")}: {record.licenseNumber}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("maps.coordinates")}: {record.coordinates.latitude.toFixed(4)},{" "}
                {record.coordinates.longitude.toFixed(4)}
              </p>
            </CardContent>
          </Card>

          <MapPlaceholder coordinates={record.coordinates} label={record.name} />

          <Button variant="outline" asChild>
            <Link href="/maps">
              <MapPin />
              {t("hospitals.viewMap")}
            </Link>
          </Button>

          <Button variant="outline" asChild>
            <Link href="/diagnostic-centers">
              {t("diagnostics.backToDirectory")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * The route entry point.
 *
 * `useParams` is a runtime value, so the page is wrapped in a Suspense
 * boundary to let Next.js prerender the route shell.
 */
export default function DiagnosticCenterDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <DiagnosticCenterDetail />
    </React.Suspense>
  );
}

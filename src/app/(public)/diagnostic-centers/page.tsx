"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslation } from "@/i18n/provider";
import { useCenters } from "@/features/diagnostics/hooks/use-diagnostics";
import { PageHeader } from "@/components/shared/page-header";
import { DemoBadge } from "@/components/shared/demo-badge";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DIVISIONS, REPORT_TYPES } from "@/lib/constants";
import type { DiagnosticCenter } from "@/types";

/**
 * The public diagnostic centre directory.
 *
 * The division and service filters are applied by the service layer, so they
 * keep working against the real API.
 */
export default function DiagnosticCentersPage() {
  const { t } = useTranslation();
  const [division, setDivision] = React.useState("");
  const [service, setService] = React.useState("");

  const centers = useCenters({
    ...(division ? { division } : {}),
    ...(service ? { service } : {}),
  });

  const columns: Column<DiagnosticCenter>[] = [
    {
      key: "name",
      header: t("diagnostics.centers"),
      sortValue: (row) => row.name,
      cell: (row) => (
        <div>
          <Link
            href={`/diagnostic-centers/${row.id}`}
            className="font-medium hover:underline"
          >
            {row.name}
          </Link>
          <p className="text-xs text-muted-foreground">{row.address}</p>
        </div>
      ),
    },
    {
      key: "division",
      header: t("hospitals.division"),
      sortValue: (row) => row.division,
      cell: (row) => <span className="text-sm">{row.division}</span>,
    },
    {
      key: "services",
      header: t("diagnostics.services"),
      sortValue: (row) => row.services.join(" "),
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.services.join(", ")}
        </span>
      ),
    },
    {
      key: "license",
      header: t("diagnostics.license"),
      sortValue: (row) => row.licenseNumber,
      cell: (row) => (
        <span className="font-mono text-xs">{row.licenseNumber}</span>
      ),
    },
    {
      key: "rating",
      header: t("hospitals.rating"),
      sortValue: (row) => row.rating,
      cell: (row) => <span className="text-sm">{row.rating.toFixed(1)}</span>,
    },
    {
      key: "verification",
      header: t("hospitals.verification"),
      sortValue: (row) => row.verificationStatus,
      cell: (row) => (
        <StatusBadge
          status={row.verificationStatus}
          label={t(`status.${row.verificationStatus}`)}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("diagnostics.title")}
        description={t("diagnostics.subtitle")}
        actions={<DemoBadge />}
      />

      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            rows={centers.data ?? []}
            rowKey={(row) => row.id}
            isLoading={centers.isLoading}
            searchable
            searchPlaceholder={t("common.searchPlaceholder")}
            searchFields={(row) =>
              `${row.name} ${row.address} ${row.division} ${row.services.join(" ")}`
            }
            emptyTitle={t("diagnostics.noCenters")}
            emptyDescription={t("hospitals.noHospitalsHint")}
            defaultSort={{ key: "name", direction: "asc" }}
            toolbar={
              <>
                <Select
                  value={division}
                  onValueChange={(value) =>
                    setDivision(value === "all" ? "" : value)
                  }
                >
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder={t("hospitals.allDivisions")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t("hospitals.allDivisions")}
                    </SelectItem>
                    {DIVISIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={service}
                  onValueChange={(value) =>
                    setService(value === "all" ? "" : value)
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder={t("diagnostics.allServices")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t("diagnostics.allServices")}
                    </SelectItem>
                    {REPORT_TYPES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            }
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {t("diagnostics.centerCount", { count: (centers.data ?? []).length })}
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/maps">{t("publicPortal.browseMaps")}</Link>
        </Button>
      </div>
    </div>
  );
}

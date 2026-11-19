"use client";

import * as React from "react";
import { useTranslation } from "@/i18n/provider";
import { PageHeader } from "@/components/shared/page-header";
import { DemoBadge } from "@/components/shared/demo-badge";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { useMyAppointments } from "@/features/appointments/hooks/use-appointments";
import { AppointmentActions } from "@/features/appointments/components/appointment-actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatMinute12, todayIso } from "@/lib/format";
import type { Appointment } from "@/types";

/** The patient's appointment list — upcoming and previous. */
function AppointmentsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useMyAppointments({});

  const today = todayIso();
  const all = data ?? [];

  const upcoming = all
    .filter(
      (item) =>
        item.date >= today &&
        !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(item.status),
    )
    .sort((a, b) =>
      `${a.date}${a.startMinute}`.localeCompare(`${b.date}${b.startMinute}`),
    );

  const previous = all
    .filter((item) => !upcoming.includes(item))
    .sort((a, b) => b.date.localeCompare(a.date));

  const columns: Column<Appointment>[] = [
    {
      key: "date",
      header: t("appointments.dateTime"),
      sortValue: (row) => `${row.date} ${String(row.startMinute).padStart(4, "0")}`,
      cell: (row) => (
        <div>
          <p className="font-medium">{formatDate(row.date)}</p>
          <p className="text-xs text-muted-foreground">
            {formatMinute12(row.startMinute)}
          </p>
        </div>
      ),
    },
    {
      key: "doctor",
      header: t("appointments.doctorName"),
      sortValue: (row) => row.doctorName,
      cell: (row) => (
        <div>
          <p className="font-medium">{row.doctorName}</p>
          <p className="text-xs text-muted-foreground">{row.hospitalName}</p>
        </div>
      ),
    },
    {
      key: "reason",
      header: t("appointments.reason"),
      sortValue: (row) => row.reason,
      cell: (row) => <span className="text-sm">{row.reason}</span>,
    },
    {
      key: "token",
      header: t("appointments.tokenNumber"),
      sortValue: (row) => row.tokenNumber,
      cell: (row) => (
        <span className="font-mono text-sm">
          {String(row.tokenNumber).padStart(2, "0")}
        </span>
      ),
    },
    {
      key: "fee",
      header: t("appointments.fee"),
      sortValue: (row) => row.fee,
      cell: (row) => (
        <span className="text-sm">৳{row.fee}</span>
      ),
    },
    {
      key: "status",
      header: t("common.status"),
      sortValue: (row) => row.status,
      cell: (row) => (
        <StatusBadge
          status={row.status}
          label={t(`status.${row.status}`)}
        />
      ),
    },
    {
      key: "actions",
      header: t("common.actions"),
      cell: (row) => (
        // Only a booking that has not happened yet can be changed.
        ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(row.status) ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <AppointmentActions appointment={row} />
        )
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("appointments.myAppointments")}
        description={t("appointments.title")}
        actions={<DemoBadge />}
      />

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">
            {t("appointments.upcoming")} ({upcoming.length})
          </TabsTrigger>
          <TabsTrigger value="previous">
            {t("appointments.previous")} ({previous.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          <Card>
            <CardContent className="pt-6">
              <DataTable
                columns={columns}
                rows={upcoming}
                rowKey={(row) => row.id}
                isLoading={isLoading}
                searchable
                searchPlaceholder={t("common.searchPlaceholder")}
                searchFields={(row) =>
                  `${row.doctorName} ${row.hospitalName} ${row.reason} ${row.tokenNumber}`
                }
                emptyTitle={t("appointments.noAppointments")}
                emptyDescription={t("appointments.noAppointmentsHint")}
                defaultSort={{ key: "date", direction: "asc" }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="previous">
          <Card>
            <CardContent className="pt-6">
              <DataTable
                columns={columns}
                rows={previous}
                rowKey={(row) => row.id}
                isLoading={isLoading}
                searchable
                searchPlaceholder={t("common.searchPlaceholder")}
                searchFields={(row) =>
                  `${row.doctorName} ${row.hospitalName} ${row.reason} ${row.status}`
                }
                emptyTitle={t("appointments.noAppointments")}
                emptyDescription={t("appointments.noAppointmentsHint")}
                defaultSort={{ key: "date", direction: "desc" }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function PatientAppointmentsPage() {
  return (
    <React.Suspense fallback={null}>
      <AppointmentsPage />
    </React.Suspense>
  );
}

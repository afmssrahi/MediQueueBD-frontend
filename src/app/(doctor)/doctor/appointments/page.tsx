"use client";

import * as React from "react";
import { useTranslation } from "@/i18n/provider";
import { useSession } from "@/stores/session";
import { useDoctors } from "@/features/doctors/hooks/use-doctors";
import { useAppointments } from "@/features/appointments/hooks/use-appointments";
import { PageHeader } from "@/components/shared/page-header";
import { DemoBadge } from "@/components/shared/demo-badge";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatMinute12, todayIso } from "@/lib/format";
import type { Appointment } from "@/types";

/** The doctor's appointment list. */
export default function DoctorAppointmentsPage() {
  const { t } = useTranslation();
  const user = useSession((state) => state.user);
  const doctors = useDoctors({});

  const doctor = (doctors.data ?? []).find(
    (item) => item.id === user?.doctorId,
  );

  const appointments = useAppointments({ doctorId: doctor?.id });

  const today = todayIso();
  const all = appointments.data ?? [];

  const upcoming = all
    .filter(
      (item) =>
        item.date >= today &&
        !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(item.status),
    )
    .sort((a, b) =>
      `${a.date}${String(a.startMinute).padStart(4, "0")}`.localeCompare(
        `${b.date}${String(b.startMinute).padStart(4, "0")}`,
      ),
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
      key: "patient",
      header: t("queue.patient"),
      sortValue: (row) => row.patientName,
      cell: (row) => (
        <div>
          <p className="font-medium">{row.patientName}</p>
          <p className="text-xs text-muted-foreground">{row.reason}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: t("appointments.type"),
      sortValue: (row) => row.type,
      cell: (row) => <span className="text-sm">{row.type}</span>,
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
      key: "status",
      header: t("common.status"),
      sortValue: (row) => row.status,
      cell: (row) => (
        <StatusBadge status={row.status} label={t(`status.${row.status}`)} />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.appointments")}
        description={t("appointments.subtitle")}
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
                isLoading={appointments.isLoading}
                searchable
                searchPlaceholder={t("common.searchPlaceholder")}
                searchFields={(row) =>
                  `${row.patientName} ${row.reason} ${row.type} ${row.tokenNumber}`
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
                isLoading={appointments.isLoading}
                searchable
                searchPlaceholder={t("common.searchPlaceholder")}
                searchFields={(row) =>
                  `${row.patientName} ${row.reason} ${row.status}`
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

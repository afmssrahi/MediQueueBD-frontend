"use client";

import * as React from "react";
import { CalendarPlus, CalendarX2, Filter, UserCheck } from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import { useSession } from "@/stores/session";
import { useAppointments } from "@/features/appointments/hooks/use-appointments";
import { usePatients } from "@/features/appointments/hooks/use-patients";
import { useDoctors } from "@/features/doctors/hooks/use-doctors";
import { StaffAppointmentActions } from "@/features/appointments/components/staff-appointment-actions";
import { StaffBookingDialog } from "@/features/appointments/components/staff-booking-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { DemoBadge } from "@/components/shared/demo-badge";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatMinute12, todayIso } from "@/lib/format";
import type { Appointment } from "@/types";

/**
 * The appointment desk.
 *
 * One component, two routes: the receptionist's screen and the hospital
 * administrator's screen. The list is always scoped to the signed-in user's
 * hospital, so neither role ever sees another hospital's bookings.
 *
 * The desk can do everything a real front desk does — book for a patient at
 * the counter, move a booking to another slot, cancel one with a reason, and
 * strike a patient off as a no-show.
 */
export function AppointmentDesk() {
  const { t } = useTranslation();
  const user = useSession((state) => state.user);
  const hospitalId = user?.hospitalId ?? undefined;

  const [doctorFilter, setDoctorFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [scope, setScope] = React.useState<"today" | "upcoming" | "all">("today");
  const [bookOpen, setBookOpen] = React.useState(false);

  const doctors = useDoctors({ hospitalId });
  const appointments = useAppointments({ hospitalId });
  const patients = usePatients(hospitalId);

  const today = todayIso();

  // The fallback array is memoised so it does not become a new reference on
  // every render — the memo below depends on it.
  const all = React.useMemo(() => appointments.data ?? [], [appointments.data]);

  const scoped = React.useMemo(() => {
    let rows = all;

    if (scope === "today") {
      rows = rows.filter((item) => item.date === today);
    } else if (scope === "upcoming") {
      rows = rows.filter(
        (item) =>
          item.date >= today &&
          !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(item.status),
      );
    }

    if (doctorFilter !== "all") {
      rows = rows.filter((item) => item.doctorId === doctorFilter);
    }

    if (statusFilter !== "all") {
      rows = rows.filter((item) => item.status === statusFilter);
    }

    return [...rows].sort((a, b) =>
      `${a.date}${String(a.startMinute).padStart(4, "0")}`.localeCompare(
        `${b.date}${String(b.startMinute).padStart(4, "0")}`,
      ),
    );
  }, [all, scope, doctorFilter, statusFilter, today]);

  const todays = all.filter((item) => item.date === today);

  const columns: Column<Appointment>[] = [
    {
      key: "dateTime",
      header: t("appointments.dateTime"),
      sortValue: (row) =>
        `${row.date} ${String(row.startMinute).padStart(4, "0")}`,
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
      key: "doctor",
      header: t("appointments.doctorName"),
      sortValue: (row) => row.doctorName,
      cell: (row) => (
        <div>
          <p className="text-sm">{row.doctorName}</p>
          <p className="text-xs text-muted-foreground">{row.type}</p>
        </div>
      ),
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
      key: "payment",
      header: t("appointments.payment"),
      sortValue: (row) => row.paymentMethod,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <span className="text-sm">{row.paymentMethod}</span>
          {row.isPaid ? (
            <Badge variant="success">{t("appointments.paid")}</Badge>
          ) : (
            <Badge variant="muted">{t("appointments.unpaid")}</Badge>
          )}
        </div>
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
      cell: (row) => <StaffAppointmentActions appointment={row} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("appointments.receptionTitle")}
        description={t("appointments.receptionSubtitle")}
        actions={
          <>
            <DemoBadge />
            <Button onClick={() => setBookOpen(true)}>
              <CalendarPlus />
              {t("appointments.staffBook")}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("appointments.today")}
          value={todays.length.toString()}
          icon={UserCheck}
          hint={t("common.today")}
        />
        <StatCard
          label={t("appointments.awaiting")}
          value={todays
            .filter((item) => ["BOOKED", "CONFIRMED"].includes(item.status))
            .length.toString()}
          icon={Filter}
          hint={t("appointments.awaitingHint")}
        />
        <StatCard
          label={t("appointments.completed")}
          value={todays
            .filter((item) => item.status === "COMPLETED")
            .length.toString()}
          icon={UserCheck}
          hint={t("common.today")}
        />
        <StatCard
          label={t("appointments.noShow")}
          value={todays
            .filter((item) => item.status === "NO_SHOW")
            .length.toString()}
          icon={CalendarX2}
          hint={t("common.today")}
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Select
              value={scope}
              onValueChange={(value) =>
                setScope(value as "today" | "upcoming" | "all")
              }
            >
              <SelectTrigger className="w-[10rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">{t("appointments.today")}</SelectItem>
                <SelectItem value="upcoming">
                  {t("appointments.upcoming")}
                </SelectItem>
                <SelectItem value="all">{t("appointments.allDates")}</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={doctorFilter}
              onValueChange={setDoctorFilter}
            >
              <SelectTrigger className="w-[14rem]">
                <SelectValue placeholder={t("appointments.doctorName")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("appointments.allDoctors")}</SelectItem>
                {(doctors.data ?? []).map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    {doctor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
            >
              <SelectTrigger className="w-[12rem]">
                <SelectValue placeholder={t("common.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("appointments.allStatuses")}</SelectItem>
                {[
                  "BOOKED",
                  "CONFIRMED",
                  "CHECKED_IN",
                  "WAITING",
                  "CALLED",
                  "IN_CONSULTATION",
                  "COMPLETED",
                  "CANCELLED",
                  "NO_SHOW",
                ].map((status) => (
                  <SelectItem key={status} value={status}>
                    {t(`status.${status}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="ml-auto text-sm text-muted-foreground">
              {scoped.length} {t("appointments.appointmentsCount")}
            </span>
          </div>

          <DataTable
            columns={columns}
            rows={scoped}
            rowKey={(row) => row.id}
            isLoading={appointments.isLoading}
            searchable
            searchPlaceholder={t("common.searchPlaceholder")}
            searchFields={(row) =>
              `${row.patientName} ${row.doctorName} ${row.reason} ${row.tokenNumber} ${row.hospitalName}`
            }
            emptyTitle={t("appointments.noAppointments")}
            emptyDescription={t("appointments.noAppointmentsHint")}
            defaultSort={{ key: "dateTime", direction: "asc" }}
            pageSize={15}
          />
        </CardContent>
      </Card>

      {bookOpen && (
        <StaffBookingDialog
          patients={patients.data ?? []}
          onOpenChange={setBookOpen}
        />
      )}
    </div>
  );
}

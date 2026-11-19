"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Award,
  CalendarCheck,
  GraduationCap,
  Languages,
  Star,
  Stethoscope,
} from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import { useDoctor, useDoctorAvailability, useDoctorSchedule } from "@/features/doctors/hooks/use-doctors";
import { PageHeader } from "@/components/shared/page-header";
import { DemoBadge } from "@/components/shared/demo-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatMinute12 } from "@/lib/format";
import type { AvailabilityDay } from "@/features/doctors/services/doctor.service";

/**
 * The doctor profile.
 *
 * The availability heatmap is generated from the doctor's clinic days and the
 * slots already taken in the demo database, so it moves when an appointment is
 * booked.
 */
function DoctorDetail() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const doctorId = params?.id ?? "";

  const doctor = useDoctor(doctorId);
  const schedule = useDoctorSchedule(doctorId);
  const availability = useDoctorAvailability(doctorId);

  if (doctor.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("common.loading")} />
      </div>
    );
  }

  if (!doctor.data) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("doctors.title")} actions={<DemoBadge />} />
        <EmptyState
          title={t("common.noResults")}
          description={t("doctors.noDoctorsHint")}
          icon={Stethoscope}
        />
      </div>
    );
  }

  const { doctor: record, hospitals, departments } = doctor.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={record.name}
        description={`${record.title} · ${record.speciality}`}
        actions={<DemoBadge />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
              <Figure
                icon={Award}
                label={t("doctors.experience")}
                value={`${record.experienceYears} yr`}
              />
              <Figure
                icon={CalendarCheck}
                label={t("doctors.consultationFee")}
                value={formatCurrency(record.consultationFee)}
              />
              <Figure
                icon={Star}
                label={t("hospitals.rating")}
                value={record.rating.toFixed(1)}
              />
              <Figure
                icon={Stethoscope}
                label={t("doctors.totalPatients")}
                value={record.totalPatients.toString()}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("doctors.about")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="text-muted-foreground">{record.bio}</p>

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <GraduationCap className="size-4 text-muted-foreground" />
                <span className="font-medium">
                  {t("doctors.qualifications")}:
                </span>
                <span className="text-muted-foreground">
                  {record.qualification}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Languages className="size-4 text-muted-foreground" />
                <span className="font-medium">{t("doctors.languages")}:</span>
                <span className="text-muted-foreground">
                  {record.languages.join(", ")}
                </span>
              </div>

              <p className="text-xs text-muted-foreground">
                {t("doctors.registration")}: {record.registrationNumber}
              </p>
            </CardContent>
          </Card>

          {/* The availability heatmap */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("doctors.availability")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {availability.data === undefined ? (
                <p className="text-sm text-muted-foreground">
                  {t("common.loading")}
                </p>
              ) : availability.data.length === 0 ? (
                <EmptyState
                  title={t("common.emptyState.title")}
                  description={t("common.emptyState.description")}
                  icon={CalendarCheck}
                  className="border-0"
                />
              ) : (
                <div className="grid grid-cols-7 gap-2">
                  {availability.data.map((day) => (
                    <AvailabilityCell key={day.date} day={day} />
                  ))}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <LegendSwatch
                  label={t("doctors.availabilityOpen")}
                  className="bg-success/30 border-success/50"
                />
                <LegendSwatch
                  label={t("doctors.availabilityBusy")}
                  className="bg-warning/30 border-warning/50"
                />
                <LegendSwatch
                  label={t("doctors.availabilityFull")}
                  className="bg-muted border-border"
                />
              </div>
            </CardContent>
          </Card>

          {/* The clinic schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("doctors.visitingHours")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">
                <span className="text-muted-foreground">
                  {t("doctors.visitingHours")}:{" "}
                </span>
                {formatMinute12(record.sessionStart)} –{" "}
                {formatMinute12(record.sessionEnd)}
              </p>

              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                  {t("doctors.clinicDays")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((day) => {
                    const active = record.availableWeekdays.includes(day.value);
                    return (
                      <Badge
                        key={day.value}
                        variant={active ? "default" : "muted"}
                      >
                        {day.label}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              {(schedule.data?.schedule ?? []).length > 0 && (
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                    {t("doctors.nextAvailable")}
                  </p>
                  <ul className="space-y-1.5">
                    {(schedule.data?.schedule ?? [])
                      .filter((day) => day.available > 0)
                      .slice(0, 5)
                      .map((day) => (
                        <li
                          key={day.date}
                          className="flex items-center justify-between text-sm"
                        >
                          <span>{formatDate(day.date)}</span>
                          <span className="text-xs text-muted-foreground">
                            {t("doctors.slotsFree", {
                              available: day.available,
                              total: day.total,
                            })}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("hospitals.departments")}</CardTitle>
            </CardHeader>
            <CardContent>
              {departments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("common.notAvailable")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {departments.map((department) => (
                    <li key={department.id} className="rounded-lg border p-3">
                      <p className="text-sm font-medium">{department.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {department.floor}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("hospitals.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              {hospitals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("common.notAvailable")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {hospitals.map((hospital) => (
                    <li key={hospital.id} className="rounded-lg border p-3">
                      <Link
                        href={`/hospitals/${hospital.id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {hospital.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {hospital.address}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Button variant="outline" asChild>
            <Link href="/doctors">{t("doctors.backToDirectory")}</Link>
          </Button>

          <Button asChild>
            <Link href={`/patient/book?doctor=${record.id}`}>
              <CalendarCheck />
              {t("doctors.bookWith")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/** The weekday names, in the order the domain uses (0 = Sunday). */
const WEEKDAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

/** One day of the availability heatmap. */
function AvailabilityCell({ day }: { day: AvailabilityDay }) {
  const { t } = useTranslation();

  const tone =
    day.level === "open"
      ? "bg-success/30 border-success/50"
      : day.level === "busy"
        ? "bg-warning/30 border-warning/50"
        : "bg-muted border-border";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-lg border p-2 text-center",
        tone,
      )}
      title={t("doctors.slotsFree", {
        available: day.available,
        total: day.total,
      })}
    >
      <span className="text-[0.65rem] text-muted-foreground">
        {formatDate(day.date).split(" ")[0]}
      </span>
      <span className="text-sm font-semibold">{day.available}</span>
      <span className="text-[0.6rem] text-muted-foreground">
        /{day.total}
      </span>
    </div>
  );
}

/** One entry in the heatmap legend. */
function LegendSwatch({ label, className }: { label: string; className: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-3 rounded border", className)} />
      {label}
    </span>
  );
}

/**
 * The route entry point.
 *
 * `useParams` is a runtime value, so the page is wrapped in a Suspense
 * boundary to let Next.js prerender the route shell.
 */
export default function DoctorDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <DoctorDetail />
    </React.Suspense>
  );
}

/** One labelled figure in the facts row. */
function Figure({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}

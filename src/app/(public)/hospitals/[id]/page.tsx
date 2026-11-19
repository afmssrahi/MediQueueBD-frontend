"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  BedDouble,
  Building2,
  Calendar,
  CheckCircle2,
  MapPin,
  Phone,
  Stethoscope,
} from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import { useHospital } from "@/features/hospitals/hooks/use-hospitals";
import { PageHeader } from "@/components/shared/page-header";
import { DemoBadge } from "@/components/shared/demo-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { MapPlaceholder } from "@/components/shared/map-placeholder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatMinute12 } from "@/lib/format";

/**
 * The hospital profile.
 *
 * Everything on this page comes from the demo database through the service
 * layer, so the same screen works against the real API without a change.
 */
function HospitalDetail() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const hospitalId = params?.id ?? "";

  const hospital = useHospital(hospitalId);

  if (hospital.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("common.loading")} />
      </div>
    );
  }

  if (!hospital.data) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("hospitals.title")} actions={<DemoBadge />} />
        <EmptyState
          title={t("common.noResults")}
          description={t("hospitals.noHospitalsHint")}
          icon={Building2}
        />
      </div>
    );
  }

  const {
    hospital: record,
    departments: detailDepartments,
    doctors: detailDoctors,
  } = hospital.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={record.name}
        description={record.description}
        actions={<DemoBadge />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* The key facts */}
          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
              <Fact
                icon={BedDouble}
                label={t("hospitals.bedCount")}
                value={record.bedCount.toString()}
              />
              <Fact
                icon={Calendar}
                label={t("hospitals.established")}
                value={record.establishedYear.toString()}
              />
              <Fact
                icon={Stethoscope}
                label={t("hospitals.departments")}
                value={detailDepartments.length.toString()}
              />
              <Fact
                icon={CheckCircle2}
                label={t("hospitals.verification")}
                value={record.verificationStatus}
                badge
              />
            </CardContent>
          </Card>

          {/* Departments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("hospitals.departments")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {detailDepartments.length === 0 ? (
                <EmptyState
                  title={t("common.emptyState.title")}
                  description={t("common.emptyState.description")}
                  icon={Building2}
                  className="border-0"
                />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {detailDepartments.map((department) => (
                    <li key={department.id} className="rounded-lg border p-3">
                      <p className="text-sm font-medium">{department.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {department.floor} ·{" "}
                        {t("hospitalAdmin.rooms")} {department.roomCount}
                      </p>
                      {department.headDoctorId && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("hospitalAdmin.headDoctor")}:{" "}
                          {detailDoctors.find(
                            (doctor) => doctor.id === department.headDoctorId,
                          )?.name ?? department.headDoctorId}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Doctors */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">
                {t("hospitals.doctorsHere")}
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/doctors">{t("doctors.title")}</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {detailDoctors.length === 0 ? (
                <EmptyState
                  title={t("hospitalStaff.noDoctors")}
                  description={t("common.emptyState.description")}
                  icon={Stethoscope}
                  className="border-0"
                />
              ) : (
                <ul className="divide-y">
                  {detailDoctors.map((doctor) => (
                    <li
                      key={doctor.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/doctors/${doctor.id}`}
                          className="truncate text-sm font-medium hover:underline"
                        >
                          {doctor.name}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">
                          {doctor.speciality} · {doctor.qualification}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(doctor.consultationFee)}
                        </span>
                        <Badge variant="secondary">
                          {formatMinute12(doctor.sessionStart)} –{" "}
                          {formatMinute12(doctor.sessionEnd)}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Facilities */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("hospitals.facilities")}</CardTitle>
            </CardHeader>
            <CardContent>
              {record.facilities.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("common.notAvailable")}
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {record.facilities.map((facility) => (
                    <li key={facility}>
                      <Badge variant="outline">{facility}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* The side column — contact, map and registration */}
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
                {t("hospitals.registrationNumber")}: {record.registrationNumber}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("maps.coordinates")}: {record.coordinates.latitude.toFixed(4)},{" "}
                {record.coordinates.longitude.toFixed(4)}
              </p>
            </CardContent>
          </Card>

          <MapPlaceholder
            coordinates={record.coordinates}
            label={record.name}
          />

          <Button variant="outline" asChild>
            <Link href="/maps">
              <MapPin />
              {t("hospitals.viewMap")}
            </Link>
          </Button>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("hospitals.aboutHospital")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>{record.description}</p>
              <p>
                {t("hospitals.rating")}: {record.rating.toFixed(1)} ·{" "}
                {t("hospitals.established")}: {record.establishedYear}
              </p>
              <p className="text-xs">
                {t("hospitals.registeredDescription")}
              </p>
            </CardContent>
          </Card>

          <Button variant="outline" asChild>
            <Link href="/hospitals">{t("hospitals.backToDirectory")}</Link>
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
export default function HospitalDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <HospitalDetail />
    </React.Suspense>
  );
}

/** One labelled figure in the facts row. */
function Fact({
  icon: Icon,
  label,
  value,
  badge = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  badge?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      {badge ? (
        <StatusBadge status={value} label={value} />
      ) : (
        <p className="text-lg font-semibold tracking-tight">{value}</p>
      )}
    </div>
  );
}

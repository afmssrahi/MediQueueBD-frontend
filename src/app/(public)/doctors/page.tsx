"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslation } from "@/i18n/provider";
import { useSession } from "@/stores/session";
import { useDoctors } from "@/features/doctors/hooks/use-doctors";
import { useHospitals } from "@/features/hospitals/hooks/use-hospitals";
import { PageHeader } from "@/components/shared/page-header";
import { DemoBadge } from "@/components/shared/demo-badge";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SPECIALITIES } from "@/lib/constants";
import { formatCurrency, formatMinute12 } from "@/lib/format";
import type { Doctor } from "@/types";

/**
 * The public doctor directory.
 *
 * The speciality, hospital and sort filters are applied by the service layer,
 * so they keep working once the real API replaces the demo database.
 */
export default function DoctorsPage() {
  const { t } = useTranslation();
  const user = useSession((state) => state.user);
  const [speciality, setSpeciality] = React.useState("");
  const [hospitalId, setHospitalId] = React.useState("");
  const [sort, setSort] = React.useState<"name" | "rating" | "experience" | "fee">(
    "name",
  );

  const doctors = useDoctors({
    ...(speciality ? { speciality } : {}),
    ...(hospitalId ? { hospitalId } : {}),
    sort,
  });
  const hospitals = useHospitals();

  const columns: Column<Doctor>[] = [
    {
      key: "name",
      header: t("doctors.title"),
      sortValue: (row) => row.name,
      cell: (row) => (
        <div>
          <Link
            href={`/doctors/${row.id}`}
            className="font-medium hover:underline"
          >
            {row.name}
          </Link>
          <p className="text-xs text-muted-foreground">{row.title}</p>
        </div>
      ),
    },
    {
      key: "speciality",
      header: t("doctors.speciality"),
      sortValue: (row) => row.speciality,
      cell: (row) => <span className="text-sm">{row.speciality}</span>,
    },
    {
      key: "experience",
      header: t("doctors.experience"),
      sortValue: (row) => row.experienceYears,
      cell: (row) => (
        <span className="text-sm">{row.experienceYears} yr</span>
      ),
    },
    {
      key: "fee",
      header: t("doctors.consultationFee"),
      sortValue: (row) => row.consultationFee,
      cell: (row) => (
        <span className="text-sm">{formatCurrency(row.consultationFee)}</span>
      ),
    },
    {
      key: "hours",
      header: t("doctors.visitingHours"),
      sortValue: (row) => row.sessionStart,
      cell: (row) => (
        <span className="text-sm">
          {formatMinute12(row.sessionStart)} – {formatMinute12(row.sessionEnd)}
        </span>
      ),
    },
    {
      key: "rating",
      header: t("hospitals.rating"),
      sortValue: (row) => row.rating,
      cell: (row) => <span className="text-sm">{row.rating.toFixed(1)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("doctors.title")}
        description={t("doctors.subtitle")}
        actions={<DemoBadge />}
      />

      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            rows={doctors.data ?? []}
            rowKey={(row) => row.id}
            isLoading={doctors.isLoading}
            searchable
            searchPlaceholder={t("common.searchPlaceholder")}
            searchFields={(row) =>
              `${row.name} ${row.speciality} ${row.qualification}`
            }
            emptyTitle={t("doctors.noDoctors")}
            emptyDescription={t("doctors.noDoctorsHint")}
            defaultSort={{ key: "name", direction: "asc" }}
            toolbar={
              <>
                <Select
                  value={speciality}
                  onValueChange={(value) =>
                    setSpeciality(value === "all" ? "" : value)
                  }
                >
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder={t("doctors.allSpecialities")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t("doctors.allSpecialities")}
                    </SelectItem>
                    {SPECIALITIES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={hospitalId}
                  onValueChange={(value) =>
                    setHospitalId(value === "all" ? "" : value)
                  }
                >
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder={t("doctors.allHospitals")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t("doctors.allHospitals")}
                    </SelectItem>
                    {(hospitals.data ?? []).map((hospital) => (
                      <SelectItem key={hospital.id} value={hospital.id}>
                        {hospital.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={sort}
                  onValueChange={(value) => setSort(value as typeof sort)}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder={t("common.sort")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">{t("common.name")}</SelectItem>
                    <SelectItem value="rating">{t("hospitals.rating")}</SelectItem>
                    <SelectItem value="experience">
                      {t("doctors.experience")}
                    </SelectItem>
                    <SelectItem value="fee">
                      {t("doctors.consultationFee")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </>
            }
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {t("doctors.doctorCount", { count: (doctors.data ?? []).length })}
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href={user ? "/patient/book" : "/login"}>
            {user ? t("doctors.bookNow") : t("auth.signIn")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/provider";
import { useHospitals, useRegisterHospital } from "@/features/hospitals/hooks/use-hospitals";
import { PageHeader } from "@/components/shared/page-header";
import { DemoBadge } from "@/components/shared/demo-badge";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DIVISIONS } from "@/lib/constants";
import type { Hospital } from "@/types";

const registrationSchema = z.object({
  name: z.string().min(2, "Enter the hospital name"),
  division: z.string().min(1, "Choose a division"),
  address: z.string().min(5, "Enter the address"),
  phone: z.string().min(6, "Enter a phone number"),
  email: z.string().optional(),
  type: z.enum(["General", "Specialty", "Clinic"]),
  bedCount: z.number().min(0),
  establishedYear: z.number().min(1800).max(2100),
  registrationNumber: z.string().optional(),
  facilities: z.string().optional(),
  description: z.string().optional(),
});

type RegistrationValues = z.infer<typeof registrationSchema>;

/**
 * The public hospital directory.
 *
 * The filters run on the server through the service layer, so the same
 * filters will work against the real API without a UI change.
 */
export default function HospitalsPage() {
  const { t } = useTranslation();
  const [division, setDivision] = React.useState("");
  const [type, setType] = React.useState("");
  const [sort, setSort] = React.useState<"name" | "rating" | "beds">("name");

  const filters = {
    ...(division ? { division } : {}),
    ...(type ? { type } : {}),
    sort,
  };

  const hospitals = useHospitals(filters);
  const registerHospital = useRegisterHospital();

  const form = useForm<RegistrationValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      name: "",
      division: "",
      address: "",
      phone: "",
      email: "",
      type: "General",
      bedCount: 50,
      establishedYear: 2020,
      registrationNumber: "",
      facilities: "",
      description: "",
    },
  });

  // `useWatch` subscribes to the select fields, so the React Compiler can
  // memoise this component safely.
  const [watchedDivision, watchedType] = useWatch({
    control: form.control,
    name: ["division", "type"],
  });

  const onRegister = (values: RegistrationValues) => {
    registerHospital.mutate(
      {
        name: values.name,
        division: values.division,
        address: values.address,
        phone: values.phone,
        email: values.email || undefined,
        type: values.type,
        bedCount: values.bedCount,
        establishedYear: values.establishedYear,
        registrationNumber: values.registrationNumber || undefined,
        description: values.description || undefined,
        facilities: values.facilities
          ? values.facilities
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
          : undefined,
      },
      {
        onSuccess: (hospital) => {
          toast.success(t("hospitals.registered"), {
            description: hospital.name,
          });
          form.reset();
        },
      },
    );
  };

  const columns: Column<Hospital>[] = [
    {
      key: "name",
      header: t("hospitals.title"),
      sortValue: (row) => row.name,
      cell: (row) => (
        <div>
          <HospitalNameLink id={row.id} name={row.name} />
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
      key: "type",
      header: t("hospitals.hospitalType"),
      sortValue: (row) => row.type,
      cell: (row) => <span className="text-sm">{row.type}</span>,
    },
    {
      key: "beds",
      header: t("hospitals.bedCount"),
      sortValue: (row) => row.bedCount,
      cell: (row) => <span className="text-sm">{row.bedCount}</span>,
    },
    {
      key: "established",
      header: t("hospitals.established"),
      sortValue: (row) => row.establishedYear,
      cell: (row) => <span className="text-sm">{row.establishedYear}</span>,
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

  const hasFilters = Boolean(division || type);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("hospitals.title")}
        description={t("hospitals.subtitle")}
        actions={<DemoBadge />}
      />

      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            rows={hospitals.data ?? []}
            rowKey={(row) => row.id}
            isLoading={hospitals.isLoading}
            searchable
            searchPlaceholder={t("hospitals.searchPlaceholder")}
            searchFields={(row) => `${row.name} ${row.address} ${row.division}`}
            emptyTitle={t("hospitals.noHospitals")}
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
                  value={type}
                  onValueChange={(value) =>
                    setType(value === "all" ? "" : value)
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder={t("hospitals.allTypes")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("hospitals.allTypes")}</SelectItem>
                    <SelectItem value="General">
                      {t("hospitals.typeGeneral")}
                    </SelectItem>
                    <SelectItem value="Specialty">
                      {t("hospitals.typeSpecialty")}
                    </SelectItem>
                    <SelectItem value="Clinic">
                      {t("hospitals.typeClinic")}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={sort}
                  onValueChange={(value) =>
                    setSort(value as typeof sort)
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder={t("common.sort")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">{t("common.name")}</SelectItem>
                    <SelectItem value="rating">{t("hospitals.rating")}</SelectItem>
                    <SelectItem value="beds">{t("hospitals.bedCount")}</SelectItem>
                  </SelectContent>
                </Select>

                {hasFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDivision("");
                      setType("");
                    }}
                  >
                    <X />
                    {t("common.clearFilters")}
                  </Button>
                )}
              </>
            }
          />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {t("hospitals.hospitalCount", { count: (hospitals.data ?? []).length })}
      </p>

      {/* The hospital registration form. */}
      <Card id="register">
        <CardHeader>
          <CardTitle className="text-base">{t("hospitals.registerTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("hospitals.registerSubtitle")}
          </p>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit(onRegister)}
            className="grid gap-4 md:grid-cols-2"
          >
            <Field
              label={t("hospitals.hospitalName")}
              error={form.formState.errors.name?.message}
            >
              <Input {...form.register("name")} />
            </Field>

            <Field
              label={t("hospitals.division")}
              error={form.formState.errors.division?.message}
            >
              <Select
                value={watchedDivision}
                onValueChange={(value) =>
                  form.setValue("division", value, { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("form.selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {DIVISIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label={t("common.address")}
              className="md:col-span-2"
              error={form.formState.errors.address?.message}
            >
              <Textarea {...form.register("address")} />
            </Field>

            <Field
              label={t("common.phone")}
              error={form.formState.errors.phone?.message}
            >
              <Input {...form.register("phone")} />
            </Field>

            <Field
              label={t("common.email")}
              error={form.formState.errors.email?.message}
            >
              <Input type="email" {...form.register("email")} />
            </Field>

            <Field label={t("hospitals.hospitalType")}>
              <Select
                value={watchedType}
                onValueChange={(value) =>
                  form.setValue("type", value as RegistrationValues["type"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="General">
                    {t("hospitals.typeGeneral")}
                  </SelectItem>
                  <SelectItem value="Specialty">
                    {t("hospitals.typeSpecialty")}
                  </SelectItem>
                  <SelectItem value="Clinic">
                    {t("hospitals.typeClinic")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field
              label={t("hospitals.bedCount")}
              error={form.formState.errors.bedCount?.message}
            >
              <Input type="number" {...form.register("bedCount", { valueAsNumber: true })} />
            </Field>

            <Field
              label={t("hospitals.established")}
              error={form.formState.errors.establishedYear?.message}
            >
              <Input
                type="number"
                {...form.register("establishedYear", { valueAsNumber: true })}
              />
            </Field>

            <Field
              label={t("hospitals.registrationNumber")}
              error={form.formState.errors.registrationNumber?.message}
            >
              <Input {...form.register("registrationNumber")} />
            </Field>

            <Field
              label={t("hospitals.facilities")}
              className="md:col-span-2"
              hint={t("hospitals.facilitiesHint")}
              error={form.formState.errors.facilities?.message}
            >
              <Input {...form.register("facilities")} />
            </Field>

            <Field
              label={t("common.description")}
              className="md:col-span-2"
              error={form.formState.errors.description?.message}
            >
              <Textarea {...form.register("description")} />
            </Field>

            <div className="flex justify-end md:col-span-2">
              <Button type="submit" disabled={registerHospital.isPending}>
                <Plus />
                {registerHospital.isPending
                  ? t("common.loading")
                  : t("hospitals.registerTitle")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/** A labelled form field with its inline validation message. */
function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

/** The hospital name, linked to its profile. */
function HospitalNameLink({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/hospitals/${id}`} className="font-medium hover:underline">
      {name}
    </Link>
  );
}

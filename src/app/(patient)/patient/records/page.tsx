"use client";

import * as React from "react";
import { useTranslation } from "@/i18n/provider";
import { useSession } from "@/stores/session";
import {
  useAllergies,
  useConditions,
  usePrescriptions,
  useRecords,
} from "@/features/emr/hooks/use-emr";
import { PageHeader } from "@/components/shared/page-header";
import { DemoBadge } from "@/components/shared/demo-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/format";
import type { Allergy, MedicalRecord, Prescription } from "@/types";

/** The patient's medical record view. */
export default function PatientRecordsPage() {
  const { t } = useTranslation();
  const patientId = useSession((state) => state.user?.id ?? null);
  const user = useSession((state) => state.user);

  const records = useRecords({ patientId: patientId ?? undefined });
  const prescriptions = usePrescriptions(patientId ?? undefined);
  const allergies = useAllergies(patientId ?? undefined);
  const conditions = useConditions(patientId ?? undefined);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("emr.title")}
        description={t("emr.subtitle")}
        actions={<DemoBadge />}
      />

      {/* The medical profile summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("emr.medicalProfile")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ProfileField label={t("auth.fullName")} value={user?.name} />
          <ProfileField label={t("auth.dateOfBirth")} value={user?.dateOfBirth ? formatDate(user.dateOfBirth) : undefined} />
          <ProfileField label={t("auth.gender")} value={user?.gender ?? undefined} />
          <ProfileField label={t("auth.bloodGroup")} value={user?.bloodGroup ?? undefined} />
        </CardContent>
      </Card>

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">
            {t("emr.history")} ({(records.data ?? []).length})
          </TabsTrigger>
          <TabsTrigger value="prescriptions">
            {t("emr.prescriptionHistory")} ({(prescriptions.data ?? []).length})
          </TabsTrigger>
          <TabsTrigger value="allergies">
            {t("emr.allergyInformation")} ({(allergies.data ?? []).length})
          </TabsTrigger>
          <TabsTrigger value="conditions">
            {t("emr.existingConditions")} ({(conditions.data ?? []).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <Card>
            <CardContent className="pt-6">
              {(records.data ?? []).length === 0 ? (
                <EmptyState
                  title={t("emr.noRecords")}
                  description={t("emr.noRecordsHint")}
                />
              ) : (
                <ol className="relative space-y-6 border-l pl-6">
                  {(records.data ?? []).map((record) => (
                    <li key={record.id} className="relative">
                      <span className="absolute -left-[31px] flex size-3 items-center justify-center rounded-full border-2 border-background bg-primary" />
                      <RecordItem record={record} />
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prescriptions">
          <Card>
            <CardContent className="space-y-4 pt-6">
              {(prescriptions.data ?? []).length === 0 ? (
                <EmptyState
                  title={t("emr.noPrescriptions")}
                  description={t("emr.noRecordsHint")}
                />
              ) : (
                (prescriptions.data ?? []).map((prescription) => (
                  <PrescriptionItem key={prescription.id} prescription={prescription} />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="allergies">
          <Card>
            <CardContent className="pt-6">
              {(allergies.data ?? []).length === 0 ? (
                <EmptyState
                  title={t("emr.noAllergies")}
                  description={t("emr.noAllergiesHint")}
                />
              ) : (
                <ul className="space-y-3">
                  {(allergies.data ?? []).map((allergy) => (
                    <AllergyItem key={allergy.id} allergy={allergy} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conditions">
          <Card>
            <CardContent className="pt-6">
              {(conditions.data ?? []).length === 0 ? (
                <EmptyState
                  title={t("emr.noConditions")}
                  description={t("emr.noRecordsHint")}
                />
              ) : (
                <ul className="space-y-3">
                  {(conditions.data ?? []).map((condition) => (
                    <li
                      key={condition.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{condition.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {condition.code ? `${condition.code} · ` : ""}
                          {formatDate(condition.diagnosedAt)}
                        </p>
                      </div>
                      <Badge
                        variant={
                          condition.status === "Chronic" ? "warning" : "secondary"
                        }
                      >
                        {condition.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

function RecordItem({ record }: { record: MedicalRecord }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">{record.diagnosis}</p>
        <Badge variant="secondary">{record.visitType}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        {t("emr.chiefComplaint")}: {record.chiefComplaint}
      </p>
      {record.notes && (
        <p className="text-sm text-muted-foreground">{record.notes}</p>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{formatDate(record.date)}</span>
        <span>{record.doctorName}</span>
        {record.vitals.bloodPressure && (
          <span>
            {t("emr.bloodPressure")}: {record.vitals.bloodPressure}
          </span>
        )}
        {record.vitals.temperature && (
          <span>
            {t("emr.temperature")}: {record.vitals.temperature}
          </span>
        )}
      </div>
    </div>
  );
}

function PrescriptionItem({
  prescription,
}: {
  prescription: Prescription;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{prescription.doctorName}</p>
        <span className="text-xs text-muted-foreground">
          {formatDate(prescription.date)}
        </span>
      </div>
      <ul className="mt-3 space-y-2">
        {prescription.items.map((item) => (
          <li key={item.id} className="text-sm">
            <span className="font-medium">{item.medicine}</span>{" "}
            <span className="text-muted-foreground">
              {item.dose} · {item.frequency} · {item.duration}
            </span>
          </li>
        ))}
      </ul>
      {prescription.advice && (
        <p className="mt-3 rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
          {prescription.advice}
        </p>
      )}
    </div>
  );
}

function AllergyItem({ allergy }: { allergy: Allergy }) {
  const { t } = useTranslation();

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
      <div>
        <p className="text-sm font-medium">{allergy.substance}</p>
        <p className="text-xs text-muted-foreground">
          {allergy.reaction} · {t("emr.recordedBy")} {allergy.recordedBy}
        </p>
      </div>
      <Badge variant="destructive">{allergy.severity}</Badge>
    </li>
  );
}

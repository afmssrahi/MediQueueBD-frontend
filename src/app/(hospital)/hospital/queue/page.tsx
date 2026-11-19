"use client";

import * as React from "react";
import { useTranslation } from "@/i18n/provider";
import { useSession } from "@/stores/session";
import { useDoctors } from "@/features/doctors/hooks/use-doctors";
import { useQueues } from "@/features/queue/hooks/use-queue";
import { QueueBoard } from "@/features/queue/components/queue-board";
import { PageHeader } from "@/components/shared/page-header";
import { DemoBadge } from "@/components/shared/demo-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Stethoscope } from "lucide-react";

/**
 * The reception desk's queue board.
 *
 * The hospital has many doctors, so the receptionist picks one and works that
 * doctor's queue — check in, call, skip, override. The same board component
 * backs the doctor's own queue screen.
 */
export default function HospitalQueuePage() {
  const { t } = useTranslation();
  const user = useSession((state) => state.user);
  const hospitalId = user?.hospitalId ?? undefined;

  const doctors = useDoctors({ hospitalId });
  const queues = useQueues(hospitalId);

  const [selectedDoctorId, setSelectedDoctorId] = React.useState<string>("");

  const hospitalDoctors = doctors.data ?? [];

  // The first doctor is selected by default so the board is never empty.
  const activeDoctorId =
    selectedDoctorId ||
    hospitalDoctors.find((item) => item.active)?.id ||
    hospitalDoctors[0]?.id ||
    "";

  const snapshots = queues.data?.queues ?? [];
  const activeSnapshot = snapshots.find(
    (item) => item.doctorId === activeDoctorId,
  );

  if (hospitalDoctors.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("nav.queueBoard")}
          description={t("queue.subtitle")}
          actions={<DemoBadge />}
        />
        <EmptyState
          title={t("hospitalStaff.noDoctors")}
          description={t("queue.noQueueEntriesHint")}
          icon={Stethoscope}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.queueBoard")}
        description={t("queue.subtitle")}
        actions={<DemoBadge />}
      />

      {/* The doctor picker — one board per doctor. */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 pt-6">
          {hospitalDoctors.map((doctor) => {
            const waiting =
              snapshots
                .find((item) => item.doctorId === doctor.id)
                ?.entries.filter(
                  (entry) =>
                    entry.checkedInAt !== null &&
                    ![
                      "COMPLETED",
                      "CANCELLED",
                      "NO_SHOW",
                      "SKIPPED",
                    ].includes(entry.status),
                ).length ?? 0;

            return (
              <Button
                key={doctor.id}
                variant={doctor.id === activeDoctorId ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDoctorId(doctor.id)}
              >
                {doctor.name}
                {waiting > 0 && (
                  <span className="rounded bg-background/20 px-1.5 text-xs">
                    {waiting}
                  </span>
                )}
              </Button>
            );
          })}
        </CardContent>
      </Card>

      {activeSnapshot ? (
        <QueueBoard doctorId={activeDoctorId} hospitalId={hospitalId} />
      ) : (
        <EmptyState
          title={t("queue.noQueueEntries")}
          description={t("queue.noQueueEntriesHint")}
          icon={Stethoscope}
        />
      )}
    </div>
  );
}

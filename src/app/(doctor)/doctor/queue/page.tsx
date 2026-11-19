"use client";

import * as React from "react";
import { useTranslation } from "@/i18n/provider";
import { useSession } from "@/stores/session";
import { useDoctors } from "@/features/doctors/hooks/use-doctors";
import { QueueBoard } from "@/features/queue/components/queue-board";
import { PageHeader } from "@/components/shared/page-header";
import { DemoBadge } from "@/components/shared/demo-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Stethoscope } from "lucide-react";

/** The doctor's queue board. */
export default function DoctorQueuePage() {
  const { t } = useTranslation();
  const user = useSession((state) => state.user);
  const doctors = useDoctors({});

  const doctor = (doctors.data ?? []).find(
    (item) => item.id === user?.doctorId,
  );

  if (!doctor) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("nav.queueBoard")} actions={<DemoBadge />} />
        <EmptyState
          title={t("common.notAvailable")}
          description={t("common.noResults")}
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

      <Alert variant="info">
        <AlertDescription>{t("queue.tokenNeverChanges")}</AlertDescription>
      </Alert>

      <QueueBoard doctorId={doctor.id} />
    </div>
  );
}

"use client";

import * as React from "react";
import { AlertTriangle, Clock, Info, MapPin } from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import { useSession } from "@/stores/session";
import { useQueues } from "@/features/queue/hooks/use-queue";
import { PageHeader } from "@/components/shared/page-header";
import { DemoBadge } from "@/components/shared/demo-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { CountdownTimer } from "@/components/shared/countdown-timer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { formatDuration, formatMinute12 } from "@/lib/format";
import type { QueueSnapshot } from "@/types";

/** Find the signed-in patient's entry across every doctor's queue. */
function findQueueEntry(
  queues: QueueSnapshot[],
  patientId: string | null,
): { entry: QueueSnapshot["entries"][number]; snapshot: QueueSnapshot } | null {
  if (!patientId) return null;

  for (const snapshot of queues) {
    const found = snapshot.entries.find((item) => item.patientId === patientId);
    if (found) return { entry: found, snapshot };
  }

  return null;
}

/**
 * The patient waiting-time view.
 *
 * Every number here comes from the queue engine and is a simulation. The
 * panel says so explicitly, and the reason codes explain what moved the
 * estimate.
 */
export default function PatientQueuePage() {
  const { t } = useTranslation();
  const patientId = useSession((state) => state.user?.id ?? null);
  const { data, isLoading } = useQueues();

  // The React Compiler memoizes this for us — a manual useMemo here cannot be
  // preserved and is rejected by the compiler lint.
  const entry = findQueueEntry(data?.queues ?? [], patientId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("waitingTime.title")} />
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("waitingTime.title")}
          description={t("waitingTime.subtitle")}
          actions={<DemoBadge />}
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-muted">
              <Clock className="size-5 text-muted-foreground" />
            </div>
            <p className="font-medium">{t("patient.activeQueueNone")}</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {t("patient.activeQueueNoneHint")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { entry: queueEntry, snapshot } = entry;
  const currentMinute = snapshot.currentMinute;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("waitingTime.title")}
        description={t("waitingTime.subtitle")}
        actions={<DemoBadge />}
      />

      <Alert variant="info">
        <Info />
        <AlertTitle>{t("common.simulated")}</AlertTitle>
        <AlertDescription>{t("waitingTime.disclaimers")}</AlertDescription>
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="space-y-1 p-5">
            <p className="text-sm text-muted-foreground">
              {t("queue.position")}
            </p>
            <p className="text-3xl font-semibold tracking-tight">
              #{queueEntry.queuePosition}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("queue.token")} {queueEntry.tokenNumber}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1 p-5">
            <p className="text-sm text-muted-foreground">
              {t("waitingTime.estimatedWait")}
            </p>
            <p className="text-3xl font-semibold tracking-tight">
              {queueEntry.estimatedWaitingMinutes === null
                ? "—"
                : formatDuration(queueEntry.estimatedWaitingMinutes)}
            </p>
            {queueEntry.isProvisional && (
              <Badge variant="warning" className="mt-1">
                {t("waitingTime.provisional")}
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1 p-5">
            <p className="text-sm text-muted-foreground">
              {t("waitingTime.estimatedStart")}
            </p>
            <p className="text-3xl font-semibold tracking-tight">
              {formatMinute12(queueEntry.estimatedConsultationStart)}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("common.status")}:{" "}
              <StatusBadge
                status={queueEntry.status}
                label={t(`status.${queueEntry.status}`)}
                className="mt-0.5"
              />
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1 p-5">
            <p className="text-sm text-muted-foreground">
              {t("waitingTime.recommendedArrival")}
            </p>
            <p className="text-3xl font-semibold tracking-tight">
              {formatMinute12(queueEntry.recommendedArrivalTime)}
            </p>
            {queueEntry.arrivalDeadline !== null && (
              <p className="text-xs text-muted-foreground">
                {t("waitingTime.commitment")}:{" "}
                {formatMinute12(queueEntry.arrivalDeadline)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("waitingTime.recommendedDeparture")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {queueEntry.recommendedDepartureTime !== null &&
            queueEntry.estimatedTravelMinutes !== null ? (
              <div className="flex items-center gap-3">
                <MapPin className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-lg font-semibold">
                    {formatMinute12(queueEntry.recommendedDepartureTime)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("maps.distance")} ≈{" "}
                    {formatDuration(queueEntry.estimatedTravelMinutes)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="font-medium">
                  {t("waitingTime.travelUnavailable")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("waitingTime.travelUnavailableHint")}
                </p>
              </div>
            )}

            {queueEntry.arrivalDeadline !== null && (
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">
                  {t("waitingTime.countdownToLate")}
                </p>
                <CountdownTimer
                  targetMinute={queueEntry.arrivalDeadline}
                  currentMinute={currentMinute}
                  className="text-lg"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("waitingTime.reasons")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {queueEntry.estimateReasons.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("common.unknown")}
              </p>
            ) : (
              <ul className="space-y-2">
                {queueEntry.estimateReasons.map((reason) => (
                  <li
                    key={reason}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    <span className="font-mono text-xs">{reason}</span>
                  </li>
                ))}
              </ul>
            )}

            {queueEntry.isProvisional && (
              <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                {t("waitingTime.provisionalHint")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

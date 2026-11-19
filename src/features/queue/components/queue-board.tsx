"use client";

import * as React from "react";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Coffee,
  PlayCircle,
  SkipForward,
  UserCheck,
} from "lucide-react";
import { useTranslation } from "@/i18n/provider";
import { useQueueAction, useQueues } from "@/features/queue/hooks/use-queue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDuration, formatMinute12 } from "@/lib/format";
import type { QueueEntry } from "@/types";

/**
 * The queue board.
 *
 * One doctor at a time: the current consultation, the physical waiting queue
 * and the virtual appointment queue. Every action goes through the queue
 * reducer, so a check-in moves the estimates exactly as the domain rules say.
 */
interface QueueBoardProps {
  doctorId: string;
  hospitalId?: string;
}

export function QueueBoard({ doctorId, hospitalId }: QueueBoardProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useQueues(hospitalId, undefined, doctorId);
  const runAction = useQueueAction();

  const [reasonDialog, setReasonDialog] = React.useState<{
    action: "OVERRIDE_POSITION" | "OVERRIDE_STATUS" | "CANCEL_PATIENT" | "SKIP_PATIENT";
    entry: QueueEntry;
  } | null>(null);
  const [reason, setReason] = React.useState("");
  const [newPosition, setNewPosition] = React.useState(1);
  const [remainingOpen, setRemainingOpen] = React.useState<QueueEntry | null>(
    null,
  );
  const [remainingMinutes, setRemainingMinutes] = React.useState("");

  const snapshot = data?.queues?.[0] ?? null;
  const entries = snapshot?.entries ?? [];

  const current = entries.find(
    (entry) =>
      entry.status === "IN_CONSULTATION" || entry.status === "CALLED",
  );
  const physical = entries.filter(
    (entry) =>
      entry.checkedInAt !== null &&
      !["COMPLETED", "CANCELLED", "NO_SHOW", "SKIPPED"].includes(entry.status),
  );
  const virtual = entries.filter(
    (entry) =>
      entry.checkedInAt === null &&
      !["COMPLETED", "CANCELLED", "NO_SHOW", "SKIPPED"].includes(entry.status),
  );

  const act = (action: Parameters<typeof runAction.mutate>[0]) =>
    runAction.mutate(action);

  const openReasonDialog = (
    action: "OVERRIDE_POSITION" | "OVERRIDE_STATUS" | "CANCEL_PATIENT" | "SKIP_PATIENT",
    entry: QueueEntry,
  ) => {
    setReason("");
    setNewPosition(entry.queuePosition);
    setReasonDialog({ action, entry });
  };

  const submitReason = () => {
    if (!reasonDialog || !reason.trim()) return;

    act({
      action: reasonDialog.action,
      patientId: reasonDialog.entry.appointmentId,
      doctorId,
      hospitalId,
      reason: reason.trim(),
      ...(reasonDialog.action === "OVERRIDE_POSITION"
        ? { newPosition: newPosition }
        : {}),
    });

    setReasonDialog(null);
  };

  return (
    <div className="space-y-6">
      {/* The current consultation */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {t("queue.currentConsultation")}
          </CardTitle>
          {snapshot && (
            <Badge variant="outline">
              {formatMinute12(snapshot.currentMinute)}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : !current ? (
            <EmptyState
              title={t("queue.noActiveConsultation")}
              description={t("queue.physicalQueueHint")}
              icon={UserCheck}
              className="border-0"
            />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-lg font-semibold text-primary">
                  #{current.queuePosition}
                </div>
                <div>
                  <p className="font-medium">{current.patientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("queue.token")} {current.tokenNumber} ·{" "}
                    {formatMinute12(current.estimatedConsultationStart)}
                  </p>
                </div>
                <StatusBadge
                  status={current.status}
                  label={t(`status.${current.status}`)}
                  showDot
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {current.status === "CALLED" && (
                  <Button
                    size="sm"
                    onClick={() =>
                      act({
                        action: "START_CONSULTATION",
                        patientId: current.appointmentId,
                        doctorId,
                        hospitalId,
                      })
                    }
                  >
                    <PlayCircle />
                    {t("queue.actions.start")}
                  </Button>
                )}
                {current.status === "IN_CONSULTATION" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRemainingMinutes(
                          current.estimatedWaitingMinutes?.toString() ?? "",
                        );
                        setRemainingOpen(current);
                      }}
                    >
                      <Coffee />
                      {t("queue.actions.setRemaining")}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        act({
                          action: "COMPLETE_CONSULTATION",
                          patientId: current.appointmentId,
                          doctorId,
                          hospitalId,
                        })
                      }
                    >
                      <CheckCircle2 />
                      {t("queue.actions.complete")}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* The physical waiting queue */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">{t("queue.physicalQueue")}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {t("queue.physicalQueueHint")}
            </p>
          </div>
          <Button
            size="sm"
            disabled={runAction.isPending || physical.length === 0}
            onClick={() => act({ action: "CALL_NEXT", doctorId, hospitalId })}
          >
            <BellRing />
            {t("queue.actions.callNext")}
          </Button>
        </CardHeader>
        <CardContent>
          {physical.length === 0 ? (
            <EmptyState
              title={t("queue.noQueueEntries")}
              description={t("queue.noQueueEntriesHint")}
              icon={UserCheck}
              className="border-0"
            />
          ) : (
            <QueueTable
              entries={physical}
              onCall={(entry) =>
                act({
                  action: "CALL_PATIENT",
                  patientId: entry.appointmentId,
                  doctorId,
                  hospitalId,
                })
              }
              onStart={(entry) =>
                act({
                  action: "START_CONSULTATION",
                  patientId: entry.appointmentId,
                  doctorId,
                  hospitalId,
                })
              }
              onSkip={(entry) => openReasonDialog("SKIP_PATIENT", entry)}
              onOverride={(entry) => openReasonDialog("OVERRIDE_POSITION", entry)}
              onLate={(entry) =>
                act({
                  action: "MARK_LATE",
                  patientId: entry.appointmentId,
                  doctorId,
                  hospitalId,
                })
              }
              onNoShow={(entry) =>
                act({
                  action: "MARK_NO_SHOW",
                  patientId: entry.appointmentId,
                  doctorId,
                  hospitalId,
                })
              }
              onCancel={(entry) => openReasonDialog("CANCEL_PATIENT", entry)}
            />
          )}
        </CardContent>
      </Card>

      {/* The virtual appointment queue */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("queue.virtualQueue")}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("queue.virtualQueueHint")}
          </p>
        </CardHeader>
        <CardContent>
          {virtual.length === 0 ? (
            <EmptyState
              title={t("queue.noQueueEntries")}
              description={t("queue.noQueueEntriesHint")}
              className="border-0"
            />
          ) : (
            <QueueTable
              entries={virtual}
              onCheckIn={(entry) =>
                act({
                  action: "CHECK_IN",
                  patientId: entry.appointmentId,
                  doctorId,
                  hospitalId,
                })
              }
              onSkip={(entry) => openReasonDialog("SKIP_PATIENT", entry)}
              onOverride={(entry) => openReasonDialog("OVERRIDE_POSITION", entry)}
              onLate={(entry) =>
                act({
                  action: "MARK_LATE",
                  patientId: entry.appointmentId,
                  doctorId,
                  hospitalId,
                })
              }
              onNoShow={(entry) =>
                act({
                  action: "MARK_NO_SHOW",
                  patientId: entry.appointmentId,
                  doctorId,
                  hospitalId,
                })
              }
              onCancel={(entry) => openReasonDialog("CANCEL_PATIENT", entry)}
            />
          )}
        </CardContent>
      </Card>

      {/* The override reason dialog — a reason is always required. */}
      <ConfirmDialog
        open={reasonDialog !== null}
        onOpenChange={(open) => !open && setReasonDialog(null)}
        title={t("queue.overrideReason")}
        description={t("queue.overrideReasonHint")}
        confirmLabel={t("common.confirm")}
        cancelLabel={t("common.cancel")}
        destructive={reasonDialog?.action === "CANCEL_PATIENT"}
        onConfirm={submitReason}
      >
        <div className="space-y-3">
          {reasonDialog?.action === "OVERRIDE_POSITION" && (
            <div className="space-y-2">
              <Label htmlFor="new-position">
                {t("queue.overridePositionLabel")}
              </Label>
              <Input
                id="new-position"
                type="number"
                min={1}
                value={newPosition}
                onChange={(event) =>
                  setNewPosition(Number(event.target.value) || 1)
                }
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="override-reason">{t("queue.overrideReason")}</Label>
            <Textarea
              id="override-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("queue.overrideReasonHint")}
            />
            {!reason.trim() && (
              <p className="text-xs font-medium text-destructive">
                {t("queue.overrideReasonRequired")}
              </p>
            )}
          </div>
        </div>
      </ConfirmDialog>

      {/* The remaining-time override */}
      <Dialog
        open={remainingOpen !== null}
        onOpenChange={(open) => !open && setRemainingOpen(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("queue.actions.setRemaining")}</DialogTitle>
            <DialogDescription>
              {t("queue.remainingMinutes")}
            </DialogDescription>
          </DialogHeader>
          <Input
            type="number"
            min={0}
            value={remainingMinutes}
            onChange={(event) => setRemainingMinutes(event.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemainingOpen(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => {
                if (!remainingOpen) return;
                act({
                  action: "SET_REMAINING_OVERRIDE",
                  patientId: remainingOpen.appointmentId,
                  doctorId,
                  hospitalId,
                  minutes:
                    remainingMinutes.trim() === ""
                      ? null
                      : Number(remainingMinutes),
                });
                setRemainingOpen(null);
              }}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface QueueTableProps {
  entries: QueueEntry[];
  /** Only the physical queue can call or start a consultation. */
  onCall?: (entry: QueueEntry) => void;
  onStart?: (entry: QueueEntry) => void;
  /** Only the virtual queue can check a patient in. */
  onCheckIn?: (entry: QueueEntry) => void;
  onSkip: (entry: QueueEntry) => void;
  onOverride: (entry: QueueEntry) => void;
  onLate: (entry: QueueEntry) => void;
  onNoShow: (entry: QueueEntry) => void;
  onCancel: (entry: QueueEntry) => void;
}

/** The rows of one queue segment. */
function QueueTable({
  entries,
  onCall,
  onStart,
  onCheckIn,
  onSkip,
  onOverride,
  onLate,
  onNoShow,
  onCancel,
}: QueueTableProps) {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[46rem] text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 font-medium">{t("queue.position")}</th>
            <th className="px-3 py-2 font-medium">{t("queue.token")}</th>
            <th className="px-3 py-2 font-medium">{t("queue.patient")}</th>
            <th className="px-3 py-2 font-medium">{t("queue.arrival")}</th>
            <th className="px-3 py-2 font-medium">{t("queue.deadline")}</th>
            <th className="px-3 py-2 font-medium">{t("queue.estimate")}</th>
            <th className="px-3 py-2 font-medium">{t("common.status")}</th>
            <th className="px-3 py-2 text-right font-medium">
              {t("common.actions")}
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.appointmentId} className="border-b last:border-0">
              <td className="px-3 py-2 font-semibold">#{entry.queuePosition}</td>
              <td className="px-3 py-2 font-mono text-xs">
                {String(entry.tokenNumber).padStart(2, "0")}
              </td>
              <td className="px-3 py-2 font-medium">{entry.patientName}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {entry.checkedInAt === null
                  ? "—"
                  : formatMinute12(entry.checkedInAt)}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {entry.arrivalDeadline === null
                  ? "—"
                  : formatMinute12(entry.arrivalDeadline)}
              </td>
              <td className="px-3 py-2">
                <span className="font-medium">
                  {formatDuration(entry.estimatedWaitingMinutes)}
                </span>
                {entry.isProvisional && (
                  <Badge variant="warning" className="ml-2">
                    {t("waitingTime.provisional")}
                  </Badge>
                )}
              </td>
              <td className="px-3 py-2">
                <StatusBadge
                  status={entry.status}
                  label={t(`status.${entry.status}`)}
                />
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap justify-end gap-1">
                  {entry.status === "WAITING" && onCall && onStart && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onCall(entry)}
                      >
                        {t("queue.actions.call")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onStart(entry)}
                      >
                        {t("queue.actions.start")}
                      </Button>
                    </>
                  )}
                  {entry.status === "BOOKED" && onCheckIn && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onCheckIn(entry)}
                    >
                      <UserCheck />
                      {t("queue.actions.checkIn")}
                    </Button>
                  )}
                  {entry.status === "BOOKED" &&
                    entry.arrivalRequestSentAt === null && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onLate(entry)}
                      >
                        <AlertTriangle />
                        {t("queue.actions.markLate")}
                      </Button>
                    )}
                  {entry.status !== "COMPLETED" &&
                    entry.status !== "CANCELLED" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onNoShow(entry)}
                        >
                          {t("queue.actions.markNoShow")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onSkip(entry)}
                        >
                          <SkipForward />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOverride(entry)}
                        >
                          {t("queue.actions.overridePosition")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onCancel(entry)}
                        >
                          {t("common.cancel")}
                        </Button>
                      </>
                    )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

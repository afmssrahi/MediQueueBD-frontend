"use client";

import * as React from "react";
import { useTranslation } from "@/i18n/provider";
import { useSession } from "@/stores/session";
import {
  useAiCitations,
  useAiExport,
  useAiHistory,
  useAiPatientLink,
  useAiServiceHealth,
  useAiSync,
  useAiTimeline,
  useAiUpload,
} from "@/features/ai-summary/hooks/use-ai-summary";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/format";
import type { AiCitation, AiTimelineEntry } from "@/types";
import { ExternalLink, FileUp, Loader2, Sparkles } from "lucide-react";

/**
 * The patient's AI summary screen.
 *
 * Three things live here:
 *
 *  1. **Upload** — the patient sends a prescription or a medical record, and
 *     the service reads it and writes a summary.
 *  2. **The history side note** — the cumulative summary of everything the
 *     patient has uploaded, folded into one paragraph.
 *  3. **The timeline and the references** — every entry, and the published
 *     papers each one leans on.
 *
 * The screen talks to the standalone AI summary service. When that service is
 * not running, the service-status notice explains what to do rather than
 * showing a broken page.
 */
export default function PatientSummaryPage() {
  const { t } = useTranslation();
  const patientId = useSession((state) => state.user?.id ?? null);

  const health = useAiServiceHealth();
  // The AI service knows the patient by its own id — the link resolves it.
  const link = useAiPatientLink(patientId);
  const aiPatientId = link.data?.id ?? null;

  const history = useAiHistory(aiPatientId);
  const timeline = useAiTimeline(aiPatientId);
  const citations = useAiCitations(aiPatientId);
  const exportBundle = useAiExport(aiPatientId);
  const upload = useAiUpload();
  const sync = useAiSync();

  const [files, setFiles] = React.useState<File[]>([]);
  const [note, setNote] = React.useState("");

  const handleUpload = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!aiPatientId || files.length === 0) return;

      upload.mutate(
        { patientId: aiPatientId, files, note: note.trim() || undefined },
        {
          onSuccess: () => {
            setFiles([]);
            setNote("");
          },
        },
      );
    },
    [aiPatientId, files, note, upload],
  );

  const serviceDown = health.isError;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("aiSummary.title")}
        description={t("aiSummary.subtitle")}
      />

      {serviceDown && (
        <Alert variant="warning">
          <FileUp />
          <AlertTitle>{t("aiSummary.serviceOffline")}</AlertTitle>
          <AlertDescription>
            {t("aiSummary.serviceOfflineHint")}
          </AlertDescription>
        </Alert>
      )}

      {/* ── the service status ─────────────────────────────────────────────── */}
      {health.data && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">
            {t("aiSummary.extractor")}: {health.data.provider.active}
          </Badge>
          <Badge variant="outline">{health.data.database}</Badge>
          {health.data.provider.mode === "mock" && (
            <Badge variant="warning">{t("aiSummary.demoMode")}</Badge>
          )}
          {health.data.literature.enabled && (
            <span>
              {t("aiSummary.references")}: {health.data.literature.sources.join(", ")}
            </span>
          )}
        </div>
      )}

      {/* ── upload ─────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("aiSummary.uploadTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ai-files">{t("aiSummary.uploadLabel")}</Label>
              <Input
                id="ai-files"
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={(event) =>
                  setFiles(Array.from(event.target.files ?? []))
                }
                className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground"
              />
              <p className="text-xs text-muted-foreground">
                {t("aiSummary.uploadHint")}
              </p>
              {files.length > 0 && (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {files.map((file) => (
                    <li key={`${file.name}-${file.size}`}>
                      {file.name} · {(file.size / 1024).toFixed(1)} KB
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-note">{t("aiSummary.noteLabel")}</Label>
              <Textarea
                id="ai-note"
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t("aiSummary.notePlaceholder")}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                disabled={upload.isPending || files.length === 0 || !aiPatientId}
              >
                {upload.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <FileUp />
                )}
                {upload.isPending
                  ? t("aiSummary.uploading")
                  : t("aiSummary.uploadButton")}
              </Button>

              {upload.isSuccess && (
                <span className="text-sm text-success">
                  {t("aiSummary.uploadDone")}
                </span>
              )}

              {upload.isError && (
                <span className="text-sm text-destructive">
                  {upload.error.message}
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── the history side note ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("aiSummary.historyTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {history.isLoading && (
            <p className="text-sm text-muted-foreground">
              {t("aiSummary.loading")}
            </p>
          )}

          {history.isError && (
            <ErrorState
              title={t("aiSummary.historyError")}
              onRetry={() => void history.refetch()}
            />
          )}

          {history.data && (
            <>
              <p className="rounded-lg border-l-4 border-primary bg-muted/40 p-4 text-sm">
                {history.data.summary}
              </p>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>
                  {t("aiSummary.entryCount", {
                    count: history.data.timeline.length,
                  })}
                </span>
                {history.data.timeline.length > 0 && (
                  <span>
                    {t("aiSummary.pendingReview", {
                      count: history.data.timeline.filter((entry) => entry.needsReview)
                        .length,
                    })}
                  </span>
                )}
                {history.data.generatedAt && (
                  <span>
                    {t("aiSummary.generatedOn")}:{" "}
                    {formatDate(history.data.generatedAt)}
                  </span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── the timeline and the references ────────────────────────────────── */}
      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">
            {t("aiSummary.timelineTab")} ({(timeline.data ?? []).length})
          </TabsTrigger>
          <TabsTrigger value="citations">
            {t("aiSummary.citationsTab")} ({(citations.data ?? []).length})
          </TabsTrigger>
          <TabsTrigger value="sync">{t("aiSummary.syncTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          {timeline.isLoading && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  {t("aiSummary.loading")}
                </p>
              </CardContent>
            </Card>
          )}

          {timeline.data && timeline.data.length === 0 && (
            <EmptyState
              title={t("aiSummary.noTimeline")}
              description={t("aiSummary.noTimelineHint")}
              icon={FileUp}
            />
          )}

          {timeline.data && timeline.data.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <ol className="relative space-y-6 border-l pl-6">
                  {timeline.data.map((entry) => (
                    <li key={entry.summaryId} className="relative">
                      <span className="absolute -left-[31px] flex size-3 items-center justify-center rounded-full border-2 border-background bg-primary" />
                      <TimelineEntry entry={entry} />
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="citations">
          {citations.data && citations.data.length === 0 ? (
            <EmptyState
              title={t("aiSummary.noCitations")}
              description={t("aiSummary.noCitationsHint")}
              icon={Sparkles}
            />
          ) : (
            <Card>
              <CardContent className="space-y-3 pt-6">
                {(citations.data ?? []).map((citation) => (
                  <CitationItem key={citation.id} citation={citation} />
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sync">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("aiSummary.syncTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("aiSummary.syncHint")}
              </p>

              {exportBundle.data && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <SyncCount
                    label={t("aiSummary.conditions")}
                    value={exportBundle.data.payload.conditions.length}
                  />
                  <SyncCount
                    label={t("aiSummary.allergies")}
                    value={exportBundle.data.payload.allergies.length}
                  />
                  <SyncCount
                    label={t("aiSummary.prescriptions")}
                    value={exportBundle.data.payload.prescriptions.length}
                  />
                  <SyncCount
                    label={t("aiSummary.records")}
                    value={exportBundle.data.payload.records.length}
                  />
                </div>
              )}

              <Button
                onClick={() =>
                  patientId &&
                  aiPatientId &&
                  sync.mutate({ aiPatientId, mainPatientId: patientId })
                }
                disabled={sync.isPending || !patientId || !aiPatientId}
                variant="outline"
              >
                {sync.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Sparkles />
                )}
                {sync.isPending ? t("aiSummary.syncing") : t("aiSummary.syncButton")}
              </Button>

              {sync.isSuccess && (
                <p className="text-sm text-success">
                  {t("aiSummary.syncDone", {
                    count:
                      sync.data.result.created.conditions +
                      sync.data.result.created.allergies +
                      sync.data.result.created.prescriptions +
                      sync.data.result.created.records,
                  })}
                </p>
              )}

              {sync.isSuccess && (
                <p className="text-xs text-muted-foreground">
                  {sync.data.result.message}
                </p>
              )}

              {sync.isError && (
                <p className="text-sm text-destructive">
                  {sync.error.message}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** One entry in the timeline. */
function TimelineEntry({ entry }: { entry: AiTimelineEntry }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">{entry.headline}</p>
        <Badge variant={entry.needsReview ? "warning" : "success"}>
          {entry.needsReview
            ? t("aiSummary.needsReview")
            : t("aiSummary.reviewed")}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        {entry.filename} · {formatDate(entry.uploadedAt)}
        {entry.provider ? ` · ${entry.provider}` : ""}
      </p>

      <p className="text-sm text-muted-foreground">{entry.summary}</p>

      {entry.keyFindings.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {entry.keyFindings.map((finding) => (
            <li key={finding}>{finding}</li>
          ))}
        </ul>
      )}

      {entry.medications.length > 0 && (
        <div className="rounded-lg border p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("aiSummary.currentMedications")}
          </p>
          <ul className="mt-1 space-y-0.5 text-sm">
            {entry.medications.map((medication) => (
              <li key={medication}>{medication}</li>
            ))}
          </ul>
        </div>
      )}

      {entry.allergies.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-xs uppercase tracking-wide text-destructive">
            {t("aiSummary.allergies")}
          </p>
          <ul className="mt-1 space-y-0.5 text-sm">
            {entry.allergies.map((allergy) => (
              <li key={allergy}>{allergy}</li>
            ))}
          </ul>
        </div>
      )}

      {entry.citations.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("aiSummary.referenceCount", { count: entry.citations.length })}
        </p>
      )}
    </div>
  );
}

/** One literature reference. */
function CitationItem({ citation }: { citation: AiCitation }) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <a
          href={citation.url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          {citation.title}
          <ExternalLink className="size-3.5" />
        </a>
        {citation.isOpenAccess && (
          <Badge variant="secondary">{t("aiSummary.openAccess")}</Badge>
        )}
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        {[
          citation.authors,
          citation.journal,
          citation.year,
          citation.pmid ? `PMID ${citation.pmid}` : null,
          citation.doi ? `DOI ${citation.doi}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {citation.why && (
        <p className="mt-1 text-xs text-muted-foreground">{citation.why}</p>
      )}
    </div>
  );
}

/** A count in the sync panel. */
function SyncCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

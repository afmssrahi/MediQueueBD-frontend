"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { aiSummaryService } from "../services/ai-summary.service";
import { aiRecordSyncService } from "../services/ai-record-sync.service";
import { emrKeys } from "@/features/emr/hooks/use-emr";
import { useSession } from "@/stores/session";

/**
 * The query keys for the AI summary service.
 *
 * The `all` key is used to invalidate everything after an upload or a review,
 * so the history, the timeline and the citation list never drift apart.
 */
export const aiSummaryKeys = {
  all: ["ai-service"] as const,
  health: () => ["ai-service", "health"] as const,
  patient: (mainPatientId: string) =>
    ["ai-service", "patient", mainPatientId] as const,
  history: (patientId: string) => ["ai-service", "history", patientId] as const,
  timeline: (patientId: string) =>
    ["ai-service", "timeline", patientId] as const,
  citations: (patientId: string) =>
    ["ai-service", "citations", patientId] as const,
  document: (id: string) => ["ai-service", "document", id] as const,
  export: (patientId: string) => ["ai-service", "export", patientId] as const,
};

/** Is the service alive, and which extractor is it using? */
export function useAiServiceHealth() {
  return useQuery({
    queryKey: aiSummaryKeys.health(),
    queryFn: () => aiSummaryService.health(),
    // The service may not be running — the page shows a friendly notice
    // rather than an error screen.
    retry: false,
    staleTime: 60_000,
  });
}

/**
 * Link the signed-in patient to the AI summary service.
 *
 * The two systems use different ids for the same person. This resolves the
 * AI service's id from the main system's id, once — the endpoint is
 * create-or-match, so repeating it is harmless and the result is cached for
 * the session.
 *
 * Everything else in this file works in terms of the **AI** patient id, which
 * is the one the service understands.
 */
export function useAiPatientLink(mainPatientId: string | null) {
  const user = useSession((state) => state.user);

  return useQuery({
    queryKey: aiSummaryKeys.patient(mainPatientId ?? ""),
    queryFn: () =>
      aiSummaryService.ensurePatient({
        name: user?.name ?? "Patient",
        externalId: mainPatientId as string,
      }),
    enabled: Boolean(mainPatientId),
    // The link never changes for a patient — no need to ask again.
    staleTime: Infinity,
    retry: false,
  });
}

/**
 * The cumulative patient history — the side note on the profile.
 *
 * @param patientId
 * @param enabled whether the patient id is known yet
 */
export function useAiHistory(patientId: string | null, enabled = true) {
  return useQuery({
    queryKey: aiSummaryKeys.history(patientId ?? ""),
    queryFn: () => aiSummaryService.history(patientId as string),
    enabled: enabled && Boolean(patientId),
  });
}

/**
 * The chronological roll-up across every upload.
 *
 * @param patientId
 * @param enabled whether the patient id is known yet
 */
export function useAiTimeline(patientId: string | null, enabled = true) {
  return useQuery({
    queryKey: aiSummaryKeys.timeline(patientId ?? ""),
    queryFn: () => aiSummaryService.timeline(patientId as string),
    enabled: enabled && Boolean(patientId),
  });
}

/**
 * Every literature reference the patient's summaries cite.
 *
 * @param patientId
 * @param enabled whether the patient id is known yet
 */
export function useAiCitations(patientId: string | null, enabled = true) {
  return useQuery({
    queryKey: aiSummaryKeys.citations(patientId ?? ""),
    queryFn: () => aiSummaryService.citations(patientId as string),
    enabled: enabled && Boolean(patientId),
  });
}

/**
 * Upload a prescription or medical record.
 *
 * Every AI query is invalidated afterwards, so the history, the timeline and
 * the citations all reflect the new document.
 */
export function useAiUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      patientId,
      files,
      note,
    }: {
      patientId: string;
      files: File[];
      note?: string;
    }) => aiSummaryService.upload(patientId, files, note),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: aiSummaryKeys.all });
      void queryClient.invalidateQueries({
        queryKey: aiSummaryKeys.history(variables.patientId),
      });
    },
  });
}

/** Sign off or edit a summary. */
export function useAiReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        needsReview: boolean;
        reviewedBy?: string;
        editedSummary?: string;
      };
    }) => aiSummaryService.review(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: aiSummaryKeys.all });
    },
  });
}

/** The payload that folds the AI findings into the medical record. */
export function useAiExport(patientId: string | null) {
  return useQuery({
    queryKey: aiSummaryKeys.export(patientId ?? ""),
    queryFn: () => aiSummaryService.export(patientId as string),
    enabled: Boolean(patientId),
  });
}

/**
 * File the AI findings into the medical record.
 *
 * The payload comes from the AI summary service and is filed by the main
 * MediQueue API. Both the AI queries and the medical-record queries are
 * invalidated afterwards, so the profile and the record never drift apart.
 */
export function useAiSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { aiPatientId: string; mainPatientId: string }) =>
      aiRecordSyncService.sync(params),
    onSuccess: (_result, params) => {
      void queryClient.invalidateQueries({ queryKey: aiSummaryKeys.all });
      void queryClient.invalidateQueries({
        queryKey: aiSummaryKeys.export(params.aiPatientId),
      });
      // The medical record just changed — the profile screens read from it.
      void queryClient.invalidateQueries({ queryKey: emrKeys.all });
    },
  });
}

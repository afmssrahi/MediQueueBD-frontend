"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiSummaryService } from "../services/ai-summary.service";

export const aiSummaryKeys = {
  all: ["ai-summaries"] as const,
  list: (patientId?: string) =>
    ["ai-summaries", "list", patientId ?? "all"] as const,
  detail: (id: string) => ["ai-summaries", "detail", id] as const,
};

/** The summaries generated for a patient. */
export function useSummaries(patientId?: string) {
  return useQuery({
    queryKey: aiSummaryKeys.list(patientId),
    queryFn: () => aiSummaryService.list(patientId),
  });
}

/** One summary. */
export function useSummary(id: string | null) {
  return useQuery({
    queryKey: aiSummaryKeys.detail(id ?? ""),
    queryFn: () => aiSummaryService.getById(id as string),
    enabled: Boolean(id),
  });
}

/**
 * Generate a summary.
 *
 * The delay is simulated on the client so the staged progress animation is
 * real. The result is always a demo script, never a model output.
 */
export function useGenerateSummary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patientId: string) => {
      await new Promise((resolve) => setTimeout(resolve, 1400));
      return aiSummaryService.generate(patientId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: aiSummaryKeys.all });
    },
  });
}

/** Edit or review a summary. */
export function useUpdateSummary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { reviewed?: boolean; editedSummary?: string; summary?: string };
    }) => aiSummaryService.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: aiSummaryKeys.all });
    },
  });
}

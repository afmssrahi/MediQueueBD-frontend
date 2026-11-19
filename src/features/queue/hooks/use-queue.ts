"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  queueService,
  type QueueActionRequest,
  type QueueSettings,
} from "../services/queue.service";
import { useSession } from "@/stores/session";

export const queueKeys = {
  all: ["queue"] as const,
  list: (hospitalId?: string, date?: string, doctorId?: string) =>
    [
      "queue",
      "list",
      hospitalId ?? "all",
      date ?? "today",
      doctorId ?? "all",
    ] as const,
  events: (doctorId?: string) =>
    ["queue", "events", doctorId ?? "all"] as const,
  settings: ["queue", "settings"] as const,
  stats: (hospitalId?: string, doctorId?: string) =>
    ["queue", "stats", hospitalId ?? "all", doctorId ?? "all"] as const,
};

/** The live queues. */
export function useQueues(
  hospitalId?: string,
  date?: string,
  doctorId?: string,
) {
  return useQuery({
    queryKey: queueKeys.list(hospitalId, date, doctorId),
    queryFn: () => queueService.getQueues(hospitalId, date, doctorId),
    // The queue is live — poll so the board keeps up with the demo data.
    refetchInterval: 30_000,
  });
}

/** The queue event history. */
export function useQueueEvents(doctorId?: string) {
  return useQuery({
    queryKey: queueKeys.events(doctorId),
    queryFn: () => queueService.getEvents({ doctorId }),
  });
}

/** The queue rules. */
export function useQueueSettings() {
  return useQuery({
    queryKey: queueKeys.settings,
    queryFn: () => queueService.getSettings(),
  });
}

/** Update the queue rules. */
export function useUpdateQueueSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Partial<QueueSettings>) =>
      queueService.updateSettings(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queueKeys.all });
    },
  });
}

/** Hospital-wide statistics derived from the queue. */
export function useHospitalStats(hospitalId?: string, doctorId?: string) {
  return useQuery({
    queryKey: queueKeys.stats(hospitalId, doctorId),
    queryFn: () => queueService.getHospitalStats(hospitalId, doctorId),
  });
}

/**
 * Run a queue action.
 *
 * Every mutation invalidates the queue, the slot list and the appointments —
 * a check-in changes all three.
 */
export function useQueueAction() {
  const queryClient = useQueryClient();
  const userId = useSession((state) => state.user?.id ?? null);

  return useMutation({
    mutationFn: (payload: QueueActionRequest) =>
      queueService.runAction({
        ...payload,
        operator: payload.operator ?? userId ?? "OPERATOR",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queueKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["slots"] });
    },
  });
}

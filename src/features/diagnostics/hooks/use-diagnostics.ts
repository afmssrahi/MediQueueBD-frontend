"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  diagnosticsService,
  type CenterFilters,
  type CreateReportRequest,
  type ReportFilters,
} from "../services/diagnostics.service";
import type { DiagnosticReport } from "@/types";

export const diagnosticsKeys = {
  all: ["diagnostics"] as const,
  centers: (filters: CenterFilters) =>
    ["diagnostics", "centers", filters] as const,
  center: (id: string) => ["diagnostics", "center", id] as const,
  reports: (filters: ReportFilters) =>
    ["diagnostics", "reports", filters] as const,
  stats: (centerId?: string) =>
    ["diagnostics", "stats", centerId ?? "all"] as const,
};

/** The diagnostic centre directory. */
export function useCenters(filters: CenterFilters = {}) {
  return useQuery({
    queryKey: diagnosticsKeys.centers(filters),
    queryFn: () => diagnosticsService.listCenters(filters),
  });
}

/** One diagnostic centre with its reports. */
export function useCenter(id: string | null) {
  return useQuery({
    queryKey: diagnosticsKeys.center(id ?? ""),
    queryFn: () => diagnosticsService.getCenter(id as string),
    enabled: Boolean(id),
  });
}

/** The report list. */
export function useReports(filters: ReportFilters = {}) {
  return useQuery({
    queryKey: diagnosticsKeys.reports(filters),
    queryFn: () => diagnosticsService.listReports(filters),
  });
}

/** The diagnostic centre's daily statistics. */
export function useCenterStats(centerId?: string) {
  return useQuery({
    queryKey: diagnosticsKeys.stats(centerId),
    queryFn: () => diagnosticsService.getStats(centerId),
  });
}

/** Upload a report (local preview simulation). */
export function useCreateReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateReportRequest) =>
      diagnosticsService.createReport(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: diagnosticsKeys.all });
    },
  });
}

/** Move a report through its status lifecycle. */
export function useUpdateReportStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      status,
      summary,
    }: {
      id: string;
      status: DiagnosticReport["status"];
      summary?: string;
    }) => diagnosticsService.updateReportStatus(id, status, summary),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: diagnosticsKeys.all });
    },
  });
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  emrService,
  type RecordFilters,
  type SaveRecordRequest,
} from "../services/emr.service";
import { useSession } from "@/stores/session";

export const emrKeys = {
  all: ["emr"] as const,
  records: (filters: RecordFilters) => ["emr", "records", filters] as const,
  prescriptions: (patientId?: string) =>
    ["emr", "prescriptions", patientId ?? "all"] as const,
  allergies: (patientId?: string) =>
    ["emr", "allergies", patientId ?? "all"] as const,
  conditions: (patientId?: string) =>
    ["emr", "conditions", patientId ?? "all"] as const,
};

/** A patient's consultation records. */
export function useRecords(filters: RecordFilters = {}) {
  return useQuery({
    queryKey: emrKeys.records(filters),
    queryFn: () => emrService.listRecords(filters),
  });
}

/** A patient's prescriptions. */
export function usePrescriptions(patientId?: string) {
  return useQuery({
    queryKey: emrKeys.prescriptions(patientId),
    queryFn: () => emrService.listPrescriptions({ patientId }),
  });
}

/** A patient's allergies. */
export function useAllergies(patientId?: string) {
  return useQuery({
    queryKey: emrKeys.allergies(patientId),
    queryFn: () => emrService.listAllergies(patientId),
  });
}

/** A patient's chronic conditions. */
export function useConditions(patientId?: string) {
  return useQuery({
    queryKey: emrKeys.conditions(patientId),
    queryFn: () => emrService.listConditions(patientId),
  });
}

/** Add a medical record. */
export function useCreateRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SaveRecordRequest) => emrService.createRecord(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: emrKeys.all });
    },
  });
}

/** Edit a medical record. */
export function useUpdateRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<SaveRecordRequest>;
    }) => emrService.updateRecord(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: emrKeys.all });
    },
  });
}

/** Delete a medical record. */
export function useDeleteRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => emrService.deleteRecord(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: emrKeys.all });
    },
  });
}

/** Add an allergy. */
export function useCreateAllergy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: emrService.createAllergy,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: emrKeys.all });
    },
  });
}

/** Remove an allergy. */
export function useDeleteAllergy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => emrService.deleteAllergy(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: emrKeys.all });
    },
  });
}

/** The signed-in patient's id. */
export function usePatientId(): string | null {
  return useSession((state) => state.user?.id ?? null);
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  doctorService,
  type AvailabilityDay,
  type DoctorFilters,
} from "../services/doctor.service";
import type { Doctor } from "@/types";

export const doctorKeys = {
  all: ["doctors"] as const,
  list: (filters: DoctorFilters) => ["doctors", "list", filters] as const,
  detail: (id: string) => ["doctors", "detail", id] as const,
  schedule: (id: string) => ["doctors", "schedule", id] as const,
  availability: (id: string) => ["doctors", "availability", id] as const,
};

/** The doctor directory. */
export function useDoctors(filters: DoctorFilters = {}) {
  return useQuery({
    queryKey: doctorKeys.list(filters),
    queryFn: () => doctorService.list(filters),
  });
}

/** One doctor with their hospitals and departments. */
export function useDoctor(id: string | null) {
  return useQuery({
    queryKey: doctorKeys.detail(id ?? ""),
    queryFn: () => doctorService.getById(id as string),
    enabled: Boolean(id),
  });
}

/** A doctor's clinic schedule for the next two weeks. */
export function useDoctorSchedule(id: string | null) {
  return useQuery({
    queryKey: doctorKeys.schedule(id ?? ""),
    queryFn: () => doctorService.getSchedule(id as string),
    enabled: Boolean(id),
  });
}

/** A doctor's daily availability, used for the heatmap. */
export function useDoctorAvailability(id: string | null): {
  data: AvailabilityDay[] | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const query = useQuery({
    queryKey: doctorKeys.availability(id ?? ""),
    queryFn: () => doctorService.getAvailability(id as string),
    enabled: Boolean(id),
  });

  return {
    data: query.data?.availability,
    isLoading: query.isLoading,
    error: query.error,
  };
}

/** Add a doctor (hospital administration). */
export function useCreateDoctor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: doctorService.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: doctorKeys.all });
    },
  });
}

/** Edit a doctor (hospital administration). */
export function useUpdateDoctor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<Doctor>;
    }) => doctorService.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: doctorKeys.all });
    },
  });
}

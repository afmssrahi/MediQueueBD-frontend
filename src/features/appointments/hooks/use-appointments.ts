"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  appointmentService,
  type AppointmentFilters,
  type BookAppointmentRequest,
  type RescheduleRequest,
} from "../services/appointment.service";
import { useSession } from "@/stores/session";

export const appointmentKeys = {
  all: ["appointments"] as const,
  list: (filters: AppointmentFilters) =>
    ["appointments", "list", filters] as const,
  detail: (id: string) => ["appointments", "detail", id] as const,
  slots: (doctorId: string, date: string) =>
    ["appointments", "slots", doctorId, date] as const,
};

/** A list of appointments, filtered by the service. */
export function useAppointments(filters: AppointmentFilters = {}) {
  return useQuery({
    queryKey: appointmentKeys.list(filters),
    queryFn: () => appointmentService.list(filters),
  });
}

/** The signed-in patient's appointments. */
export function useMyAppointments(filters: AppointmentFilters = {}) {
  const patientId = usePatientId();
  return useAppointments({
    ...filters,
    patientId: patientId ?? undefined,
  });
}

/** The signed-in patient's id. */
export function usePatientId(): string | null {
  return useSession((state) => state.user?.id ?? null);
}

/** One appointment. */
export function useAppointment(id: string | null) {
  return useQuery({
    queryKey: appointmentKeys.detail(id ?? ""),
    queryFn: () => appointmentService.getById(id as string),
    enabled: Boolean(id),
  });
}

/** The slots a doctor offers on a date. */
export function useSlots(doctorId: string | null, date: string | null) {
  return useQuery({
    queryKey: appointmentKeys.slots(doctorId ?? "", date ?? ""),
    queryFn: () => appointmentService.getSlots(doctorId as string, date as string),
    enabled: Boolean(doctorId && date),
  });
}

/** Book an appointment. */
export function useBookAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BookAppointmentRequest) =>
      appointmentService.book(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appointmentKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["queue"] });
      void queryClient.invalidateQueries({ queryKey: ["slots"] });
    },
  });
}

/** Cancel an appointment. */
export function useCancelAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      appointmentService.cancel(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appointmentKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["slots"] });
    },
  });
}

/** Reschedule an appointment. */
export function useRescheduleAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RescheduleRequest }) =>
      appointmentService.reschedule(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appointmentKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["slots"] });
    },
  });
}

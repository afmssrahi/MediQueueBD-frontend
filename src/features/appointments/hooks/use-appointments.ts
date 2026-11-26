"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  appointmentService,
  type AppointmentFilters,
  type BookAppointmentRequest,
  type RescheduleRequest,
} from "../services/appointment.service";
import { useSession } from "@/stores/session";
import type { AppointmentStatus } from "@/types";

export const appointmentKeys = {
  all: ["appointments"] as const,
  list: (filters: AppointmentFilters) =>
    ["appointments", "list", filters] as const,
  detail: (id: string) => ["appointments", "detail", id] as const,
  slots: (doctorId: string, date: string) =>
    ["appointments", "slots", doctorId, date] as const,
};

/**
 * Invalidate everything a booking touches.
 *
 * A booking changes the appointment list, the slot grid (the slot is now
 * taken) and the queue (the patient is now in it). Leaving any of them stale
 * is what makes a prototype feel broken.
 */
function invalidateAppointmentState(
  queryClient: ReturnType<typeof useQueryClient>,
): void {
  void queryClient.invalidateQueries({ queryKey: appointmentKeys.all });
  void queryClient.invalidateQueries({ queryKey: ["slots"] });
  void queryClient.invalidateQueries({ queryKey: ["queue"] });
  void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  void queryClient.invalidateQueries({ queryKey: ["admin"] });
}

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
    // The slot grid is the part of the app that goes stale the fastest —
    // another patient may take the slot while the grid is open.
    staleTime: 5_000,
    refetchInterval: 30_000,
  });
}

/** Book an appointment. */
export function useBookAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BookAppointmentRequest) =>
      appointmentService.book(payload),
    onSuccess: () => {
      invalidateAppointmentState(queryClient);
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
      invalidateAppointmentState(queryClient);
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
      invalidateAppointmentState(queryClient);
    },
  });
}

/**
 * Change the status of an appointment.
 *
 * Used by the hospital screens — striking a patient off as a no-show, or
 * reinstating a booking that was cancelled by mistake.
 */
export function useSetAppointmentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: AppointmentStatus;
      reason?: string;
    }) => appointmentService.setStatus(id, status, reason),
    onSuccess: () => {
      invalidateAppointmentState(queryClient);
    },
  });
}

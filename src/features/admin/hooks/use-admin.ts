"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminService,
  type SystemStats,
} from "../services/admin.service";

export const adminKeys = {
  all: ["admin"] as const,
  stats: ["admin", "stats"] as const,
  users: (filters: { role?: string; active?: boolean; search?: string }) =>
    ["admin", "users", filters] as const,
  hospitals: ["admin", "hospitals"] as const,
  staff: (hospitalId?: string) =>
    ["admin", "staff", hospitalId ?? "all"] as const,
  settings: ["admin", "settings"] as const,
};

/** Platform-wide statistics. */
export function useSystemStats() {
  return useQuery({
    queryKey: adminKeys.stats,
    queryFn: () => adminService.getSystemStats(),
  });
}

/** The user directory. */
export function useUsers(
  filters: { role?: string; active?: boolean; search?: string } = {},
) {
  return useQuery({
    queryKey: adminKeys.users(filters),
    queryFn: () => adminService.listUsers(filters),
  });
}

/** The hospital directory (administration view). */
export function useAdminHospitals() {
  return useQuery({
    queryKey: adminKeys.hospitals,
    queryFn: () => adminService.listHospitals(),
  });
}

/** The staff list of a hospital. */
export function useStaff(hospitalId?: string) {
  return useQuery({
    queryKey: adminKeys.staff(hospitalId),
    queryFn: () => adminService.listStaff(hospitalId),
  });
}

/** The system settings. */
export function useSystemSettings() {
  return useQuery({
    queryKey: adminKeys.settings,
    queryFn: () => adminService.getSettings(),
  });
}

/** Save the system settings. */
export function useUpdateSystemSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: adminService.updateSettings,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.all });
    },
  });
}

/** Add a staff member. */
export function useCreateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: adminService.createStaff,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.all });
    },
  });
}

/** Edit a staff member. */
export function useUpdateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof adminService.updateStaff>[1];
    }) => adminService.updateStaff(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.all });
    },
  });
}

/** Activate or deactivate a user account. */
export function useUpdateUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      adminService.updateUserStatus(id, active),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.all });
    },
  });
}

/** Reset the demo database. */
export function useResetDemoData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => adminService.resetDemoData(),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

export type { SystemStats };

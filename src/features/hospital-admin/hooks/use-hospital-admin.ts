"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  hospitalAdminService,
  type CreateStaffRequest,
  type StaffMember,
  type UpdateStaffRequest,
} from "../services/hospital-admin.service";

export const hospitalAdminKeys = {
  all: ["hospital-admin"] as const,
  doctors: (hospitalId: string) =>
    ["hospital-admin", "doctors", hospitalId] as const,
  departments: (hospitalId: string) =>
    ["hospital-admin", "departments", hospitalId] as const,
  staff: (hospitalId: string) =>
    ["hospital-admin", "staff", hospitalId] as const,
};

/** The hospital's doctors. */
export function useHospitalDoctors(hospitalId: string | undefined) {
  return useQuery({
    queryKey: hospitalAdminKeys.doctors(hospitalId ?? ""),
    queryFn: () => hospitalAdminService.listDoctors(hospitalId as string),
    enabled: Boolean(hospitalId),
  });
}

/** The hospital's departments. */
export function useHospitalDepartments(hospitalId: string | undefined) {
  return useQuery({
    queryKey: hospitalAdminKeys.departments(hospitalId ?? ""),
    queryFn: () => hospitalAdminService.listDepartments(hospitalId as string),
    enabled: Boolean(hospitalId),
  });
}

/** The hospital's staff list. */
export function useHospitalStaff(hospitalId: string | undefined) {
  return useQuery({
    queryKey: hospitalAdminKeys.staff(hospitalId ?? ""),
    queryFn: () => hospitalAdminService.listStaff(hospitalId as string),
    enabled: Boolean(hospitalId),
  });
}

/** Add a staff member. */
export function useAddHospitalStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateStaffRequest) =>
      hospitalAdminService.createStaff(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hospitalAdminKeys.all });
    },
  });
}

/** Edit a staff member. */
export function useEditHospitalStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateStaffRequest;
    }) => hospitalAdminService.updateStaff(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hospitalAdminKeys.all });
    },
  });
}

export type { StaffMember };

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  hospitalService,
  type CreateHospitalRequest,
  type HospitalFilters,
} from "../services/hospital.service";
import { departmentService } from "../services/hospital.service";

export const hospitalKeys = {
  all: ["hospitals"] as const,
  list: (filters: HospitalFilters) => ["hospitals", "list", filters] as const,
  detail: (id: string) => ["hospitals", "detail", id] as const,
  departments: (hospitalId?: string) =>
    ["hospitals", "departments", hospitalId ?? "all"] as const,
};

/** The hospital directory. */
export function useHospitals(filters: HospitalFilters = {}) {
  return useQuery({
    queryKey: hospitalKeys.list(filters),
    queryFn: () => hospitalService.list(filters),
  });
}

/** One hospital with its departments and doctors. */
export function useHospital(id: string | null) {
  return useQuery({
    queryKey: hospitalKeys.detail(id ?? ""),
    queryFn: () => hospitalService.getById(id as string),
    enabled: Boolean(id),
  });
}

/** The departments of a hospital, or all departments. */
export function useDepartments(hospitalId?: string) {
  return useQuery({
    queryKey: hospitalKeys.departments(hospitalId),
    queryFn: () => departmentService.list(hospitalId),
  });
}

/** Submit a hospital registration (demo form). */
export function useRegisterHospital() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateHospitalRequest) =>
      hospitalService.register(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hospitalKeys.all });
    },
  });
}

/** Add a department (hospital administration). */
export function useCreateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: departmentService.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hospitalKeys.all });
    },
  });
}

/** Edit a department (hospital administration). */
export function useUpdateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof departmentService.update>[1];
    }) => departmentService.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hospitalKeys.all });
    },
  });
}

/** Remove a department (hospital administration). */
export function useDeleteDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => departmentService.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hospitalKeys.all });
    },
  });
}

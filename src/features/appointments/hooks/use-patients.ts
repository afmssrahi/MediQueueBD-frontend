"use client";

import { useQuery } from "@tanstack/react-query";
import { API_ROUTES } from "@/api/routes";
import { request } from "@/services/request";
import { useSession } from "@/stores/session";
import type { PublicUser } from "@/types";

export const patientKeys = {
  all: ["patients"] as const,
  list: (hospitalId?: string) => ["patients", "list", hospitalId ?? "all"] as const,
};

/**
 * The patients of the signed-in user's hospital.
 *
 * This is the reception desk's patient list — the people the desk books
 * appointments for at the counter.
 */
export function usePatients(hospitalId?: string) {
  const user = useSession((state) => state.user);
  const scope = hospitalId ?? user?.hospitalId ?? undefined;

  return useQuery({
    queryKey: patientKeys.list(scope),
    queryFn: async () => {
      const { data } = await request<PublicUser[]>({
        method: API_ROUTES.listPatients.method,
        path: API_ROUTES.listPatients.path,
        query: { hospitalId: scope },
      });
      return data;
    },
    enabled: Boolean(scope),
  });
}

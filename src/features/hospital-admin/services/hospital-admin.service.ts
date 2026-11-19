import { API_ROUTES, buildPath } from "@/api/routes";
import { request } from "@/services/request";
import type { Department, Doctor, HospitalStaff } from "@/types";

/**
 * The hospital administration service.
 *
 * It is the only module that knows which endpoints the administration area
 * calls. The endpoints themselves are shared with the system administration
 * area — they are the same routes in `src/api/routes.ts`, so the future
 * backend implements them once.
 */

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: HospitalStaff["role"];
  shift: string;
  active: boolean;
  joinedAt: string;
}

export interface CreateStaffRequest {
  hospitalId: string;
  name: string;
  email?: string;
  phone?: string;
  role?: HospitalStaff["role"];
  shift?: string;
}

export interface UpdateStaffRequest {
  name?: string;
  role?: HospitalStaff["role"];
  shift?: string;
  active?: boolean;
}

export const hospitalAdminService = {
  async listDoctors(hospitalId: string): Promise<Doctor[]> {
    const { data } = await request<Doctor[]>({
      method: API_ROUTES.listDoctors.method,
      path: API_ROUTES.listDoctors.path,
      query: { hospitalId },
    });
    return data;
  },

  async listDepartments(hospitalId: string): Promise<Department[]> {
    const { data } = await request<Department[]>({
      method: API_ROUTES.listDepartments.method,
      path: API_ROUTES.listDepartments.path,
      query: { hospitalId },
    });
    return data;
  },

  async listStaff(hospitalId: string): Promise<StaffMember[]> {
    const { data } = await request<StaffMember[]>({
      method: API_ROUTES.listStaff.method,
      path: API_ROUTES.listStaff.path,
      query: { hospitalId },
    });
    return data;
  },

  async createStaff(payload: CreateStaffRequest): Promise<StaffMember> {
    const { data } = await request<StaffMember>({
      method: API_ROUTES.createStaff.method,
      path: API_ROUTES.createStaff.path,
      body: payload,
    });
    return data;
  },

  async updateStaff(
    id: string,
    payload: UpdateStaffRequest,
  ): Promise<StaffMember> {
    const { data } = await request<StaffMember>({
      method: API_ROUTES.updateStaff.method,
      path: buildPath(API_ROUTES.updateStaff, { id }),
      body: payload,
    });
    return data;
  },
};

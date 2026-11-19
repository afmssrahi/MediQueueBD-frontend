import { API_ROUTES, buildPath } from "@/api/routes";
import { request } from "@/services/request";
import type { Department, Doctor, Hospital } from "@/types";

/** The hospital directory service. */

export interface HospitalFilters {
  search?: string;
  division?: string;
  type?: string;
  speciality?: string;
  sort?: "name" | "rating" | "beds" | "established";
}

export interface HospitalDetail {
  hospital: Hospital;
  departments: Department[];
  doctors: Doctor[];
}

export interface CreateHospitalRequest {
  name: string;
  division: string;
  address: string;
  phone?: string;
  email?: string;
  type?: Hospital["type"];
  bedCount?: number;
  establishedYear?: number;
  description?: string;
  registrationNumber?: string;
  facilities?: string[];
}

export const hospitalService = {
  async list(filters: HospitalFilters = {}): Promise<Hospital[]> {
    const { data } = await request<Hospital[]>({
      method: API_ROUTES.listHospitals.method,
      path: API_ROUTES.listHospitals.path,
      query: { ...filters },
    });
    return data;
  },

  async getById(id: string): Promise<HospitalDetail> {
    const { data } = await request<HospitalDetail>({
      method: API_ROUTES.getHospital.method,
      path: buildPath(API_ROUTES.getHospital, { id }),
    });
    return data;
  },

  async register(payload: CreateHospitalRequest): Promise<Hospital> {
    const { data } = await request<Hospital>({
      method: API_ROUTES.createHospital.method,
      path: API_ROUTES.createHospital.path,
      body: payload,
    });
    return data;
  },
};

export const departmentService = {
  async list(hospitalId?: string): Promise<Department[]> {
    const { data } = await request<Department[]>({
      method: API_ROUTES.listDepartments.method,
      path: API_ROUTES.listDepartments.path,
      query: { hospitalId },
    });
    return data;
  },

  async getById(id: string): Promise<{ department: Department; doctors: Doctor[] }> {
    const { data } = await request<{ department: Department; doctors: Doctor[] }>({
      method: API_ROUTES.getDepartment.method,
      path: buildPath(API_ROUTES.getDepartment, { id }),
    });
    return data;
  },

  async create(payload: {
    hospitalId: string;
    name: string;
    floor?: string;
    headDoctorId?: string | null;
    roomCount?: number;
  }): Promise<Department> {
    const { data } = await request<Department>({
      method: API_ROUTES.createDepartment.method,
      path: API_ROUTES.createDepartment.path,
      body: payload,
    });
    return data;
  },

  async update(
    id: string,
    payload: Partial<{
      name: string;
      floor: string;
      headDoctorId: string | null;
      roomCount: number;
    }>,
  ): Promise<Department> {
    const { data } = await request<Department>({
      method: API_ROUTES.updateDepartment.method,
      path: buildPath(API_ROUTES.updateDepartment, { id }),
      body: payload,
    });
    return data;
  },

  async remove(id: string): Promise<void> {
    await request({
      method: API_ROUTES.deleteDepartment.method,
      path: buildPath(API_ROUTES.deleteDepartment, { id }),
    });
  },
};

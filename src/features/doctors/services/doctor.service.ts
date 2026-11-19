import { API_ROUTES, buildPath } from "@/api/routes";
import { request } from "@/services/request";
import type { Department, Doctor, Hospital } from "@/types";

/** The doctor directory service. */

export interface DoctorFilters {
  search?: string;
  speciality?: string;
  hospitalId?: string;
  departmentId?: string;
  active?: boolean;
  sort?: "name" | "rating" | "experience" | "fee";
}

export interface DoctorDetail {
  doctor: Doctor;
  hospitals: Hospital[];
  departments: Department[];
}

export interface ScheduleDay {
  date: string;
  available: number;
  total: number;
}

export interface DoctorSchedule {
  doctorId: string;
  sessionStart: number;
  sessionEnd: number;
  availableWeekdays: number[];
  schedule: ScheduleDay[];
}

export interface AvailabilityDay {
  date: string;
  available: number;
  total: number;
  level: "open" | "busy" | "full";
}

export const doctorService = {
  async list(filters: DoctorFilters = {}): Promise<Doctor[]> {
    const { data } = await request<Doctor[]>({
      method: API_ROUTES.listDoctors.method,
      path: API_ROUTES.listDoctors.path,
      query: {
        ...filters,
        active:
          filters.active === undefined ? undefined : String(filters.active),
      } as Record<string, string | number | boolean | undefined | null>,
    });
    return data;
  },

  async getById(id: string): Promise<DoctorDetail> {
    const { data } = await request<DoctorDetail>({
      method: API_ROUTES.getDoctor.method,
      path: buildPath(API_ROUTES.getDoctor, { id }),
    });
    return data;
  },

  async create(payload: Partial<Doctor> & { name: string; speciality: string }): Promise<Doctor> {
    const { data } = await request<Doctor>({
      method: API_ROUTES.createDoctor.method,
      path: API_ROUTES.createDoctor.path,
      body: payload,
    });
    return data;
  },

  async update(
    id: string,
    payload: Partial<
      Pick<
        Doctor,
        | "name"
        | "speciality"
        | "qualification"
        | "consultationFee"
        | "experienceYears"
        | "active"
        | "sessionStart"
        | "sessionEnd"
      >
    >,
  ): Promise<Doctor> {
    const { data } = await request<Doctor>({
      method: API_ROUTES.updateDoctor.method,
      path: buildPath(API_ROUTES.updateDoctor, { id }),
      body: payload,
    });
    return data;
  },

  async getSchedule(id: string, from?: string): Promise<DoctorSchedule> {
    const { data } = await request<DoctorSchedule>({
      method: API_ROUTES.listDoctorSchedule.method,
      path: buildPath(API_ROUTES.listDoctorSchedule, { id }),
      query: { from },
    });
    return data;
  },

  async getAvailability(id: string, from?: string): Promise<{ availability: AvailabilityDay[] }> {
    const { data } = await request<{ availability: AvailabilityDay[] }>({
      method: API_ROUTES.listDoctorAvailability.method,
      path: buildPath(API_ROUTES.listDoctorAvailability, { id }),
      query: { from },
    });
    return data;
  },
};

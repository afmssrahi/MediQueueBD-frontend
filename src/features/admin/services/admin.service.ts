import { API_ROUTES, buildPath } from "@/api/routes";
import { request } from "@/services/request";
import type {
  HospitalStaff,
  Hospital,
  PublicUser,
  SystemSettings,
} from "@/types";

/** The administration service. */

export interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  usersByRole: Record<string, number>;
  totalHospitals: number;
  verifiedHospitals: number;
  totalCenters: number;
  totalDoctors: number;
  totalPatients: number;
  totalAppointments: number;
  appointmentsToday: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  totalRecords: number;
  totalReports: number;
  appointmentsPerDay: { date: string; count: number }[];
  noShowRate: number;
}

export const adminService = {
  async getSystemStats(): Promise<SystemStats> {
    const { data } = await request<SystemStats>({
      method: API_ROUTES.systemStats.method,
      path: API_ROUTES.systemStats.path,
    });
    return data;
  },

  async listUsers(filters: {
    role?: string;
    active?: boolean;
    search?: string;
  } = {}): Promise<PublicUser[]> {
    const { data } = await request<PublicUser[]>({
      method: API_ROUTES.listUsers.method,
      path: API_ROUTES.listUsers.path,
      query: {
        role: filters.role,
        active: filters.active === undefined ? undefined : String(filters.active),
        search: filters.search,
      },
    });
    return data;
  },

  async listHospitals(): Promise<Hospital[]> {
    const { data } = await request<Hospital[]>({
      method: API_ROUTES.listHospitals.method,
      path: API_ROUTES.listHospitals.path,
    });
    return data;
  },

  async updateUserStatus(
    userId: string,
    active: boolean,
  ): Promise<PublicUser> {
    const { data } = await request<PublicUser>({
      method: API_ROUTES.updateUserStatus.method,
      path: buildPath(API_ROUTES.updateUserStatus, { id: userId }),
      body: { active },
    });
    return data;
  },

  async listStaff(hospitalId?: string): Promise<HospitalStaff[]> {
    const { data } = await request<HospitalStaff[]>({
      method: API_ROUTES.listStaff.method,
      path: API_ROUTES.listStaff.path,
      query: { hospitalId },
    });
    return data;
  },

  async createStaff(payload: {
    hospitalId: string;
    name: string;
    email?: string;
    phone?: string;
    role?: HospitalStaff["role"];
    shift?: string;
  }): Promise<HospitalStaff> {
    const { data } = await request<HospitalStaff>({
      method: API_ROUTES.createStaff.method,
      path: API_ROUTES.createStaff.path,
      body: payload,
    });
    return data;
  },

  async updateStaff(
    id: string,
    payload: Partial<Pick<HospitalStaff, "name" | "role" | "shift" | "active">>,
  ): Promise<HospitalStaff> {
    const { data } = await request<HospitalStaff>({
      method: API_ROUTES.updateStaff.method,
      path: buildPath(API_ROUTES.updateStaff, { id }),
      body: payload,
    });
    return data;
  },

  async getSettings(): Promise<SystemSettings> {
    const { data } = await request<SystemSettings>({
      method: API_ROUTES.systemSettings.method,
      path: API_ROUTES.systemSettings.path,
    });
    return data;
  },

  async updateSettings(
    payload: Partial<SystemSettings>,
  ): Promise<SystemSettings> {
    const { data } = await request<SystemSettings>({
      method: API_ROUTES.updateSystemSettings.method,
      path: API_ROUTES.updateSystemSettings.path,
      body: payload,
    });
    return data;
  },

  async resetDemoData(): Promise<void> {
    await request({
      method: API_ROUTES.resetDemoData.method,
      path: API_ROUTES.resetDemoData.path,
    });
  },
};

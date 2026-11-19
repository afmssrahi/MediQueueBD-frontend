import { API_ROUTES, buildPath } from "@/api/routes";
import { request } from "@/services/request";
import type { PublicUser } from "@/types";

/** The user profile service. */

export interface UpdateProfileRequest {
  name?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  emergencyContact?: string;
  nid?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export const userService = {
  async getMe(): Promise<PublicUser> {
    const { data } = await request<PublicUser>({
      method: API_ROUTES.me.method,
      path: API_ROUTES.me.path,
    });
    return data;
  },

  async updateProfile(payload: UpdateProfileRequest): Promise<PublicUser> {
    const { data } = await request<PublicUser>({
      method: API_ROUTES.updateProfile.method,
      path: API_ROUTES.updateProfile.path,
      body: payload,
    });
    return data;
  },

  async changePassword(payload: ChangePasswordRequest): Promise<void> {
    await request({
      method: API_ROUTES.changePassword.method,
      path: API_ROUTES.changePassword.path,
      body: payload,
    });
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

  async updateUserStatus(userId: string, active: boolean): Promise<PublicUser> {
    const { data } = await request<PublicUser>({
      method: API_ROUTES.updateUserStatus.method,
      path: buildPath(API_ROUTES.updateUserStatus, { id: userId }),
      body: { active },
    });
    return data;
  },
};

import { API_ROUTES, buildPath } from "@/api/routes";
import { request } from "@/services/request";
import type { PublicUser, Role } from "@/types";

/**
 * The authentication service.
 *
 * This is the only module that knows the shape of the auth endpoints.
 */

export interface LoginRequest {
  email: string;
  password: string;
  remember?: boolean;
}

export interface RegisterRequest {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: Role;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  address?: string;
  emergencyContact?: string;
  nid?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  password: string;
}

export interface DemoAccount {
  role: Role;
  email: string;
  name: string;
  label: string;
  labelBn: string;
  password: string;
}

export interface ForgotPasswordResult {
  sent: false;
  simulated: true;
  message: string;
}

export const authService = {
  async login(payload: LoginRequest): Promise<PublicUser> {
    const { data } = await request<PublicUser>({
      method: API_ROUTES.login.method,
      path: API_ROUTES.login.path,
      body: payload,
      // The login call must not carry a session — it establishes one.
      userId: null,
    });
    return data;
  },

  async register(payload: RegisterRequest): Promise<PublicUser> {
    const { data } = await request<PublicUser>({
      method: API_ROUTES.register.method,
      path: API_ROUTES.register.path,
      body: payload,
      userId: null,
    });
    return data;
  },

  async logout(): Promise<void> {
    await request({
      method: API_ROUTES.logout.method,
      path: API_ROUTES.logout.path,
    });
  },

  async forgotPassword(
    payload: ForgotPasswordRequest,
  ): Promise<ForgotPasswordResult> {
    const { data } = await request<ForgotPasswordResult>({
      method: API_ROUTES.forgotPassword.method,
      path: API_ROUTES.forgotPassword.path,
      body: payload,
      userId: null,
    });
    return data;
  },

  async resetPassword(payload: ResetPasswordRequest): Promise<void> {
    await request({
      method: API_ROUTES.resetPassword.method,
      path: API_ROUTES.resetPassword.path,
      body: payload,
      userId: null,
    });
  },

  async getDemoAccounts(): Promise<DemoAccount[]> {
    const { data } = await request<DemoAccount[]>({
      method: API_ROUTES.demoAccounts.method,
      path: API_ROUTES.demoAccounts.path,
      userId: null,
    });
    return data;
  },
};

export { buildPath };

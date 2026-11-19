import { API_ROUTES, buildPath } from "@/api/routes";
import { request } from "@/services/request";
import type { Appointment, Slot } from "@/types";

/** The appointment service. */

export interface AppointmentFilters {
  patientId?: string;
  doctorId?: string;
  hospitalId?: string;
  status?: string;
  type?: string;
  date?: string;
  from?: string;
  to?: string;
  search?: string;
  sort?: "date" | "token" | "fee" | "doctor";
}

export interface BookAppointmentRequest {
  patientId: string;
  doctorId: string;
  date: string;
  startMinute: number;
  type?: string;
  reason?: string;
  paymentMethod?: Appointment["paymentMethod"];
  isPaid?: boolean;
  notes?: string;
}

export interface RescheduleRequest {
  date: string;
  startMinute: number;
}

export interface DoctorSlots {
  doctorId: string;
  doctorName: string;
  speciality: string;
  sessionStart: number;
  sessionEnd: number;
  consultationFee: number;
  slots: Slot[];
}

export const appointmentService = {
  async list(filters: AppointmentFilters = {}): Promise<Appointment[]> {
    const { data } = await request<Appointment[]>({
      method: API_ROUTES.listAppointments.method,
      path: API_ROUTES.listAppointments.path,
      query: { ...filters },
    });
    return data;
  },

  async getById(id: string): Promise<Appointment> {
    const { data } = await request<Appointment>({
      method: API_ROUTES.getAppointment.method,
      path: buildPath(API_ROUTES.getAppointment, { id }),
    });
    return data;
  },

  async book(payload: BookAppointmentRequest): Promise<Appointment> {
    const { data } = await request<Appointment>({
      method: API_ROUTES.createAppointment.method,
      path: API_ROUTES.createAppointment.path,
      body: payload,
    });
    return data;
  },

  async cancel(id: string, reason?: string): Promise<Appointment> {
    const { data } = await request<Appointment>({
      method: API_ROUTES.cancelAppointment.method,
      path: buildPath(API_ROUTES.cancelAppointment, { id }),
      body: { reason },
    });
    return data;
  },

  async reschedule(
    id: string,
    payload: RescheduleRequest,
  ): Promise<Appointment> {
    const { data } = await request<Appointment>({
      method: API_ROUTES.rescheduleAppointment.method,
      path: buildPath(API_ROUTES.rescheduleAppointment, { id }),
      body: payload,
    });
    return data;
  },

  async getSlots(doctorId: string, date: string): Promise<DoctorSlots> {
    const { data } = await request<DoctorSlots>({
      method: API_ROUTES.listSlots.method,
      path: API_ROUTES.listSlots.path,
      query: { doctorId, date },
    });
    return data;
  },
};

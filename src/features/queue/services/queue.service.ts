import { API_ROUTES } from "@/api/routes";
import { request } from "@/services/request";
import type { QueueEvent, QueueSnapshot } from "@/types";

/** The queue service. */

export interface QueueResponse {
  date: string;
  simTime: number;
  queues: QueueSnapshot[];
}

export interface QueueSettings {
  arrivalBufferMinutes: number;
  gracePeriodMinutes: number;
  noShowAfterGraceMinutes: number;
  targetReadyPatients: number;
  latePenaltyPolicy: "MOVE_BEHIND_CHECKED_IN" | "KEEP_POSITION" | "MARK_NO_SHOW";
  atHomeOrderingRule: "TOKEN" | "READY_TIME";
  durationStrategy: "MEDIAN" | "AVERAGE";
  notificationLeadMinutes: number;
  historyWindow: number;
}

export type QueueActionType =
  | "CHECK_IN"
  | "CALL_NEXT"
  | "CALL_PATIENT"
  | "START_CONSULTATION"
  | "COMPLETE_CONSULTATION"
  | "CANCEL_PATIENT"
  | "SKIP_PATIENT"
  | "RESTORE_PATIENT"
  | "MARK_LATE"
  | "MARK_NO_SHOW"
  | "OVERRIDE_STATUS"
  | "OVERRIDE_POSITION"
  | "SET_REMAINING_OVERRIDE"
  | "SET_DOCTOR_BREAK"
  | "SET_DOCTOR_UNAVAILABLE"
  | "SET_DOCTOR_AVAILABLE";

export interface QueueActionRequest {
  action: QueueActionType;
  patientId?: string;
  doctorId?: string;
  hospitalId?: string;
  newStatus?: string;
  newPosition?: number;
  minutes?: number | null;
  breakEnd?: number | null;
  reason?: string;
  operator?: string;
}

export interface QueueActionResult {
  action: string;
  events: number;
  patient: unknown;
  doctorId: string | null;
  doctors: number;
}

export interface HospitalStats {
  metrics: {
    doctorId: string | null;
    totalAppointments: number;
    expectedAppointments: number;
    completedCount: number;
    cancelledCount: number;
    lateCount: number;
    noShowCount: number;
    averagePhysicalWaitingMinutes: number | null;
    maximumPhysicalWaitingMinutes: number | null;
    doctorIdleMinutes: number | null;
    patientLatenessRate: number | null;
    noShowRate: number | null;
    estimateErrorMinutes: number | null;
    arrivalComplianceRate: number | null;
    checkedInCount: number;
    committedArrivalCount: number;
    waitingRoomOccupancy: number;
  };
  appointmentsPerDay: { date: string; count: number }[];
  busiestHours: { hour: number; count: number }[];
  totalDoctors: number;
  totalDepartments: number;
  pendingAppointments: number;
  waitingNow: number;
}

export const queueService = {
  async getQueues(
    hospitalId?: string,
    date?: string,
    doctorId?: string,
  ): Promise<QueueResponse> {
    const { data } = await request<QueueResponse>({
      method: API_ROUTES.getQueue.method,
      path: API_ROUTES.getQueue.path,
      query: { hospitalId, date, doctorId },
    });
    return data;
  },

  async runAction(payload: QueueActionRequest): Promise<QueueActionResult> {
    const { data } = await request<QueueActionResult>({
      method: API_ROUTES.queueAction.method,
      path: API_ROUTES.queueAction.path,
      body: payload,
    });
    return data;
  },

  async getEvents(filters: { doctorId?: string; eventType?: string } = {}): Promise<QueueEvent[]> {
    const { data } = await request<QueueEvent[]>({
      method: API_ROUTES.listQueueEvents.method,
      path: API_ROUTES.listQueueEvents.path,
      query: filters,
    });
    return data;
  },

  async getSettings(): Promise<QueueSettings> {
    const { data } = await request<QueueSettings>({
      method: API_ROUTES.queueSettings.method,
      path: API_ROUTES.queueSettings.path,
    });
    return data;
  },

  async updateSettings(
    payload: Partial<QueueSettings>,
  ): Promise<QueueSettings> {
    const { data } = await request<QueueSettings>({
      method: API_ROUTES.updateQueueSettings.method,
      path: API_ROUTES.updateQueueSettings.path,
      body: payload,
    });
    return data;
  },

  async getHospitalStats(
    hospitalId?: string,
    doctorId?: string,
  ): Promise<HospitalStats> {
    const { data } = await request<HospitalStats>({
      method: API_ROUTES.hospitalStats.method,
      path: API_ROUTES.hospitalStats.path,
      query: { hospitalId, doctorId },
    });
    return data;
  },
};

import { API_ROUTES, buildPath } from "@/api/routes";
import { request } from "@/services/request";
import type { DiagnosticCenter, DiagnosticReport } from "@/types";

/** The diagnostics service. */

export interface CenterFilters {
  search?: string;
  division?: string;
  service?: string;
}

export interface ReportFilters {
  patientId?: string;
  centerId?: string;
  status?: string;
  reportType?: string;
  search?: string;
}

export interface CreateReportRequest {
  patientId: string;
  centerId: string;
  testName: string;
  reportType?: string;
  referredBy?: string | null;
  doctorName?: string | null;
  collectedDate?: string;
  summary?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
}

export interface CenterStats {
  totalReports: number;
  inQueue: number;
  processing: number;
  readyForDelivery: number;
  delivered: number;
  deliveredToday: number;
  byStatus: Record<string, number>;
  reportsPerDay: { date: string; count: number }[];
  averageProcessingHours: number;
}

export const diagnosticsService = {
  async listCenters(filters: CenterFilters = {}): Promise<DiagnosticCenter[]> {
    const { data } = await request<DiagnosticCenter[]>({
      method: API_ROUTES.listCenters.method,
      path: API_ROUTES.listCenters.path,
      query: { ...filters },
    });
    return data;
  },

  async getCenter(
    id: string,
  ): Promise<{ center: DiagnosticCenter; reports: DiagnosticReport[] }> {
    const { data } = await request<{
      center: DiagnosticCenter;
      reports: DiagnosticReport[];
    }>({
      method: API_ROUTES.getCenter.method,
      path: buildPath(API_ROUTES.getCenter, { id }),
    });
    return data;
  },

  async listReports(filters: ReportFilters = {}): Promise<DiagnosticReport[]> {
    const { data } = await request<DiagnosticReport[]>({
      method: API_ROUTES.listReports.method,
      path: API_ROUTES.listReports.path,
      query: { ...filters },
    });
    return data;
  },

  async getReport(id: string): Promise<DiagnosticReport> {
    const { data } = await request<DiagnosticReport>({
      method: API_ROUTES.getReport.method,
      path: buildPath(API_ROUTES.getReport, { id }),
    });
    return data;
  },

  async createReport(
    payload: CreateReportRequest,
  ): Promise<DiagnosticReport> {
    const { data } = await request<DiagnosticReport>({
      method: API_ROUTES.createReport.method,
      path: API_ROUTES.createReport.path,
      body: payload,
    });
    return data;
  },

  async updateReportStatus(
    id: string,
    status: DiagnosticReport["status"],
    summary?: string,
  ): Promise<DiagnosticReport> {
    const { data } = await request<DiagnosticReport>({
      method: API_ROUTES.updateReportStatus.method,
      path: buildPath(API_ROUTES.updateReportStatus, { id }),
      body: { status, summary },
    });
    return data;
  },

  async getStats(centerId?: string): Promise<CenterStats> {
    const { data } = await request<CenterStats>({
      method: API_ROUTES.centerStats.method,
      path: API_ROUTES.centerStats.path,
      query: { centerId },
    });
    return data;
  },
};

import { API_ROUTES, buildPath } from "@/api/routes";
import { request } from "@/services/request";
import type {
  Allergy,
  Condition,
  MedicalRecord,
  Prescription,
} from "@/types";

/** The EMR service. */

export interface RecordFilters {
  patientId?: string;
  doctorId?: string;
  hospitalId?: string;
  from?: string;
  to?: string;
  search?: string;
}

export interface SaveRecordRequest {
  patientId: string;
  doctorId: string;
  date?: string;
  visitType?: MedicalRecord["visitType"];
  chiefComplaint: string;
  diagnosis: string;
  notes?: string;
  bloodPressure?: string | null;
  temperature?: string | null;
  pulse?: string | null;
  weight?: string | null;
  spo2?: string | null;
  documentName?: string | null;
  documentSize?: number | null;
}

export const emrService = {
  async listRecords(filters: RecordFilters = {}): Promise<MedicalRecord[]> {
    const { data } = await request<MedicalRecord[]>({
      method: API_ROUTES.listRecords.method,
      path: API_ROUTES.listRecords.path,
      query: { ...filters },
    });
    return data;
  },

  async getRecord(id: string): Promise<MedicalRecord> {
    const { data } = await request<MedicalRecord>({
      method: API_ROUTES.getRecord.method,
      path: buildPath(API_ROUTES.getRecord, { id }),
    });
    return data;
  },

  async createRecord(payload: SaveRecordRequest): Promise<MedicalRecord> {
    const { data } = await request<MedicalRecord>({
      method: API_ROUTES.createRecord.method,
      path: API_ROUTES.createRecord.path,
      body: payload,
    });
    return data;
  },

  async updateRecord(
    id: string,
    payload: Partial<SaveRecordRequest>,
  ): Promise<MedicalRecord> {
    const { data } = await request<MedicalRecord>({
      method: API_ROUTES.updateRecord.method,
      path: buildPath(API_ROUTES.updateRecord, { id }),
      body: payload,
    });
    return data;
  },

  async deleteRecord(id: string): Promise<void> {
    await request({
      method: API_ROUTES.deleteRecord.method,
      path: buildPath(API_ROUTES.deleteRecord, { id }),
    });
  },

  async listPrescriptions(filters: {
    patientId?: string;
    doctorId?: string;
  } = {}): Promise<Prescription[]> {
    const { data } = await request<Prescription[]>({
      method: API_ROUTES.listPrescriptions.method,
      path: API_ROUTES.listPrescriptions.path,
      query: filters,
    });
    return data;
  },

  async listAllergies(patientId?: string): Promise<Allergy[]> {
    const { data } = await request<Allergy[]>({
      method: API_ROUTES.listAllergies.method,
      path: API_ROUTES.listAllergies.path,
      query: { patientId },
    });
    return data;
  },

  async createAllergy(payload: {
    patientId: string;
    substance: string;
    reaction?: string;
    severity?: Allergy["severity"];
    recordedBy?: string;
  }): Promise<Allergy> {
    const { data } = await request<Allergy>({
      method: API_ROUTES.createAllergy.method,
      path: API_ROUTES.createAllergy.path,
      body: payload,
    });
    return data;
  },

  async deleteAllergy(id: string): Promise<void> {
    await request({
      method: API_ROUTES.deleteAllergy.method,
      path: buildPath(API_ROUTES.deleteAllergy, { id }),
    });
  },

  async listConditions(patientId?: string): Promise<Condition[]> {
    const { data } = await request<Condition[]>({
      method: API_ROUTES.listConditions.method,
      path: API_ROUTES.listConditions.path,
      query: { patientId },
    });
    return data;
  },

  async createCondition(payload: {
    patientId: string;
    name: string;
    code?: string | null;
    diagnosedAt?: string;
    status?: Condition["status"];
    notes?: string;
  }): Promise<Condition> {
    const { data } = await request<Condition>({
      method: API_ROUTES.createCondition.method,
      path: API_ROUTES.createCondition.path,
      body: payload,
    });
    return data;
  },
};

import { API_ROUTES, buildPath } from "@/api/routes";
import { request } from "@/services/request";
import type { AiCaseSummary } from "@/types";

/**
 * The AI summary service.
 *
 * The "generation" is a fixed demo script. Every summary it returns carries
 * `simulated: true`, and the UI labels it as such everywhere it appears.
 */

export const aiSummaryService = {
  async list(patientId?: string): Promise<AiCaseSummary[]> {
    const { data } = await request<AiCaseSummary[]>({
      method: API_ROUTES.listSummaries.method,
      path: API_ROUTES.listSummaries.path,
      query: { patientId },
    });
    return data;
  },

  async getById(id: string): Promise<AiCaseSummary> {
    const { data } = await request<AiCaseSummary>({
      method: API_ROUTES.getSummary.method,
      path: buildPath(API_ROUTES.getSummary, { id }),
    });
    return data;
  },

  async generate(patientId: string): Promise<AiCaseSummary> {
    const { data } = await request<AiCaseSummary>({
      method: API_ROUTES.generateSummary.method,
      path: API_ROUTES.generateSummary.path,
      body: { patientId },
    });
    return data;
  },

  async update(
    id: string,
    payload: { reviewed?: boolean; editedSummary?: string; summary?: string },
  ): Promise<AiCaseSummary> {
    const { data } = await request<AiCaseSummary>({
      method: API_ROUTES.updateSummary.method,
      path: buildPath(API_ROUTES.updateSummary, { id }),
      body: payload,
    });
    return data;
  },
};

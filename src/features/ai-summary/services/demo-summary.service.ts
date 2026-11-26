import { API_ROUTES, buildPath } from "@/api/routes";
import { request } from "@/services/request";
import type { AiCaseSummary } from "@/types";

/**
 * The demo summary service.
 *
 * The "generation" is a fixed demo script served by the mock transport. Every
 * summary it returns carries `simulated: true`, and the UI labels it as such
 * everywhere it appears.
 *
 * The live path is `aiSummaryService` in `./ai-summary.service` — that one
 * talks to the standalone AI summary backend.
 */
export const demoSummaryService = {
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

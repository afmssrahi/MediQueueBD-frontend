import { API_ROUTES, buildPath } from "@/api/routes";
import { getAiServiceTransport } from "@/api/ai-service-client";
import { ApiRequestError, type PageMeta } from "@/api/envelope";
import type {
  AiCaseSummary,
  AiCitation,
  AiDocumentDetail,
  AiEmrExportBundle,
  AiHistory,
  AiServiceHealth,
  AiTimelineEntry,
  AiUploadResult,
} from "@/types";

/**
 * The AI summary service client.
 *
 * Every call goes to the standalone AI summary backend
 * (`ai-summary-prototype/`), not to the main MediQueue API. The service
 * returns the same `{ success, data, error, meta }` envelope, so the
 * unwrapping here matches `services/request.ts` exactly.
 *
 * The demo path (`/ai-summaries`, the simulated summaries) is still available
 * through `demoSummaryService` below, so nothing that depends on it breaks.
 */

/**
 * Call the AI summary service and unwrap the envelope.
 *
 * @param options
 * @param {string} options.method
 * @param {string} options.path
 * @param {Record<string, string | number | boolean | undefined | null>} [options.query]
 * @param {unknown} [options.body]
 */
async function aiRequest<T>(options: {
  method: string;
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
}): Promise<{ data: T; meta: PageMeta }> {
  const transport = getAiServiceTransport();

  const response = await transport.request<T>({
    method: options.method,
    path: options.path,
    query: options.query,
    body: options.body,
  });

  if (!response.success) {
    throw new ApiRequestError(response.error);
  }

  return { data: response.data, meta: response.meta };
}

/** The AI summary service. */
export const aiSummaryService = {
  /** Is the service alive, and which extractor is it using? */
  async health(): Promise<AiServiceHealth> {
    const { data } = await aiRequest<AiServiceHealth>({
      method: API_ROUTES.aiServiceHealth.method,
      path: API_ROUTES.aiServiceHealth.path,
    });
    return data;
  },

  /**
   * Create-or-match the patient in the AI summary service.
   *
   * The service knows the patient by its own id, but it links to the main
   * system through `externalId` — the id the patient has here. The endpoint
   * is create-or-match, so calling it twice is safe.
   */
  async ensurePatient(payload: {
    name: string;
    externalId: string;
    age?: number | null;
    sex?: string | null;
  }): Promise<{ id: string; name: string; externalId: string | null }> {
    const { data } = await aiRequest<{
      patient: { id: string; name: string; externalId: string | null };
    }>({
      method: API_ROUTES.aiCreatePatient.method,
      path: API_ROUTES.aiCreatePatient.path,
      body: payload,
    });
    return data.patient;
  },

  /** The cumulative patient history — the side note on the profile. */
  async history(patientId: string): Promise<AiHistory> {
    const { data } = await aiRequest<{ history: AiHistory }>({
      method: API_ROUTES.aiPatientSummary.method,
      path: buildPath(API_ROUTES.aiPatientSummary, { id: patientId }),
    });
    return data.history;
  },

  /** The chronological roll-up across every upload. */
  async timeline(patientId: string): Promise<AiTimelineEntry[]> {
    const { data } = await aiRequest<{ timeline: AiTimelineEntry[] }>({
      method: API_ROUTES.aiPatientTimeline.method,
      path: buildPath(API_ROUTES.aiPatientTimeline, { id: patientId }),
    });
    return data.timeline;
  },

  /** Every literature reference the patient's summaries cite. */
  async citations(patientId: string): Promise<AiCitation[]> {
    const { data } = await aiRequest<{ citations: AiCitation[] }>({
      method: API_ROUTES.aiPatientCitations.method,
      path: buildPath(API_ROUTES.aiPatientCitations, { id: patientId }),
    });
    return data.citations;
  },

  /** One document, with its summary and its citations. */
  async document(id: string): Promise<AiDocumentDetail> {
    const { data } = await aiRequest<AiDocumentDetail>({
      method: API_ROUTES.aiDocument.method,
      path: buildPath(API_ROUTES.aiDocument, { id }),
    });
    return data;
  },

  /**
   * Upload one or more prescriptions or medical records.
   *
   * The body is a `FormData`, so the browser sets the multipart boundary
   * itself and the file bytes are uploaded verbatim.
   *
   * @param patientId
   * @param files
   * @param note
   */
  async upload(
    patientId: string,
    files: File[],
    note?: string,
  ): Promise<AiUploadResult> {
    const body = new FormData();

    for (const file of files) {
      body.append("file", file, file.name);
    }

    if (note) {
      body.append("note", note);
    }

    const { data } = await aiRequest<AiUploadResult>({
      method: API_ROUTES.aiUploadDocument.method,
      path: buildPath(API_ROUTES.aiUploadDocument, { id: patientId }),
      body,
    });
    return data;
  },

  /** Sign off or edit one summary. */
  async review(
    id: string,
    payload: {
      needsReview: boolean;
      reviewedBy?: string;
      editedSummary?: string;
    },
  ): Promise<{ summary: AiCaseSummary; citations: AiCitation[] }> {
    const { data } = await aiRequest<{
      summary: AiCaseSummary;
      citations: AiCitation[];
    }>({
      method: API_ROUTES.aiReviewSummary.method,
      path: buildPath(API_ROUTES.aiReviewSummary, { id }),
      body: payload,
    });
    return data;
  },

  /** The payload that folds the AI findings into the medical record. */
  async export(patientId: string): Promise<AiEmrExportBundle> {
    const { data } = await aiRequest<AiEmrExportBundle>({
      method: API_ROUTES.aiPatientExport.method,
      path: buildPath(API_ROUTES.aiPatientExport, { id: patientId }),
    });
    return data;
  },

  /** Push the payload out and record the export. */
  async sync(patientId: string): Promise<AiEmrExportBundle> {
    const { data } = await aiRequest<AiEmrExportBundle>({
      method: API_ROUTES.aiPatientSync.method,
      path: buildPath(API_ROUTES.aiPatientSync, { id: patientId }),
      body: {},
    });
    return data;
  },
};

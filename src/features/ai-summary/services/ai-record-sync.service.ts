import { aiSummaryService } from "./ai-summary.service";
import {
  emrService,
  type EmrSyncPayload,
} from "@/features/emr/services/emr.service";
import type { EmrSyncResult } from "@/types";

/**
 * The bridge between the AI summary service and the medical record.
 *
 * The two systems are deliberately separate, and each one owns its own id for
 * the patient:
 *
 *  - The **main MediQueue API** knows the patient as `U101` — it is the system
 *    that owns the record.
 *  - The **AI summary service** knows the patient by an id of its own, and
 *    links back to the main system through `external_id`.
 *
 * The link is made once, by `POST /ai-service/patients` with the main system's
 * id as `externalId`. That endpoint is create-or-match, so it is safe to call
 * every time.
 *
 * The sync itself is two steps, and the order matters:
 *
 *   1. `GET  /ai-service/patients/:id/export` — ask the AI service for the
 *      payload it has built.
 *   2. `POST /emr/sync` — hand that payload to the main API, which files it.
 *
 * Step 2 is idempotent, so pressing the button twice does not double the
 * record — the second press reports that everything was already on file.
 *
 * The payload carries `externalPatientId` — the id the patient has in the
 * main system — so the findings land on the right profile even though the AI
 * service knows the patient by a different id.
 */

/** The outcome of a sync, from the point of view of the screen. */
export interface AiSyncOutcome {
  /** What the main API filed. */
  result: EmrSyncResult;
  /** How many summaries the AI service had ready to file. */
  exported: number;
}

export const aiRecordSyncService = {
  async sync(params: {
    /** The id the patient has in the AI summary service. */
    aiPatientId: string;
    /** The id the patient has in the main MediQueue system. */
    mainPatientId: string;
  }): Promise<AiSyncOutcome> {
    // Step 1 — the payload the AI service built.
    const bundle = await aiSummaryService.export(params.aiPatientId);

    const payload: EmrSyncPayload = {
      target: bundle.payload.target,
      patientId: bundle.payload.patientId,
      // The main system matches on this one.
      externalPatientId: params.mainPatientId,
      conditions: bundle.payload.conditions ?? [],
      allergies: bundle.payload.allergies ?? [],
      prescriptions: bundle.payload.prescriptions ?? [],
      records: bundle.payload.records ?? [],
      summary: bundle.payload.summary ?? null,
    };

    // Step 2 — the main API files it.
    const result = await emrService.sync(payload);

    return { result, exported: bundle.exported };
  },
};

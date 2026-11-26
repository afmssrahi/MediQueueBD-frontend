import { beforeEach, describe, expect, it } from "vitest";
import { mockTransport } from "@/api/mock-handlers";
import { readDb, resetDb } from "@/demo/db";
import type { EmrSyncResult } from "@/types";

/**
 * The AI → medical record sync.
 *
 * The AI summary service reads a patient's uploaded prescriptions and produces
 * a payload; the main MediQueue API decides what to file. These tests cover
 * the receiving end: what gets filed, what gets skipped, and what happens when
 * the same payload arrives twice.
 */

const PATIENT_ID = "U101";

/** Post a payload to the sync endpoint through the mock transport. */
async function sync(payload: unknown): Promise<EmrSyncResult> {
  const response = await mockTransport.request<EmrSyncResult>({
    method: "POST",
    path: "/emr/sync",
    body: payload,
    userId: PATIENT_ID,
  });

  if (!response.success) {
    throw new Error(`${response.error.code}: ${response.error.message}`);
  }

  return response.data;
}

/** A payload with one of everything, for a patient with an empty record. */
function buildPayload() {
  return {
    target: "mediqueue-emr",
    patientId: "U999",
    externalPatientId: PATIENT_ID,
    conditions: [
      {
        name: "Migraine without aura",
        code: "G43.0",
        status: "Chronic",
        diagnosedAt: "2026-01-05",
        notes: "Identified from an uploaded document by the AI summary service.",
      },
    ],
    allergies: [
      {
        substance: "Shellfish",
        reaction: "Not stated on the document",
        severity: "Mild",
        recordedAt: "2026-01-05",
        recordedBy: "AI summary service",
      },
    ],
    prescriptions: [
      {
        date: "2026-01-05",
        doctorName: null,
        advice: "Rest and fluids.",
        notes: "Extracted from an uploaded document.",
        items: [
          {
            medicine: "Sumatriptan",
            dose: "50 mg",
            frequency: "As needed at onset",
            duration: "3 months",
            instructions: null,
          },
        ],
      },
    ],
    records: [
      {
        date: "2026-01-05",
        visitType: "Follow-up",
        chiefComplaint: "Migraine without aura",
        diagnosis: "Migraine without aura",
        notes: "A summary built from the uploaded prescription.",
        vitals: {
          bloodPressure: "130/85",
          temperature: null,
          pulse: null,
          weight: null,
          spo2: null,
        },
        documentName: "visit-1.txt",
        documentSize: 512,
      },
    ],
    summary: {
      headline: "Migraine without aura — 1 medicine prescribed",
      text: "This summary was generated from “visit-1.txt”.",
      keyFindings: ["Diagnosis recorded: Migraine without aura."],
      recommendations: ["Confirm the medication list against the original."],
      advice: "Rest and fluids.",
      followUp: null,
      needsReview: true,
      reviewedBy: null,
      reviewedAt: null,
      provider: "local",
      model: "heuristic-v1",
      confidence: 0.9,
    },
  };
}

describe("the AI summary sync into the medical record", () => {
  beforeEach(() => {
    resetDb();
  });

  it("files the conditions, allergies, prescriptions and records", async () => {
    const result = await sync(buildPayload());

    expect(result.patientId).toBe(PATIENT_ID);
    expect(result.created.conditions).toBe(1);
    expect(result.created.allergies).toBe(1);
    expect(result.created.prescriptions).toBe(1);
    expect(result.created.records).toBe(1);

    const db = readDb();

    const condition = db.conditions.find(
      (item) =>
        item.patientId === PATIENT_ID && item.name === "Migraine without aura",
    );
    expect(condition).toBeDefined();
    expect(condition?.code).toBe("G43.0");
    expect(condition?.status).toBe("Chronic");

    const allergy = db.allergies.find(
      (item) => item.patientId === PATIENT_ID && item.substance === "Shellfish",
    );
    expect(allergy).toBeDefined();

    const prescription = db.prescriptions.find(
      (item) =>
        item.patientId === PATIENT_ID &&
        item.items.some((entry) => entry.medicine === "Sumatriptan"),
    );
    expect(prescription).toBeDefined();
    expect(prescription?.items[0].dose).toBe("50 mg");

    const record = db.records.find(
      (item) =>
        item.patientId === PATIENT_ID &&
        item.documentName === "visit-1.txt",
    );
    expect(record).toBeDefined();
    expect(record?.diagnosis).toBe("Migraine without aura");
  });

  it("does not double the record when the same payload arrives twice", async () => {
    await sync(buildPayload());

    const before = readDb();
    const conditionsBefore = before.conditions.length;
    const recordsBefore = before.records.length;
    const prescriptionsBefore = before.prescriptions.length;

    const second = await sync(buildPayload());

    expect(second.created.conditions).toBe(0);
    expect(second.created.records).toBe(0);
    expect(second.created.prescriptions).toBe(0);
    expect(second.skipped.conditions).toBe(1);
    expect(second.skipped.records).toBe(1);
    expect(second.skipped.prescriptions).toBe(1);

    const after = readDb();
    expect(after.conditions.length).toBe(conditionsBefore);
    expect(after.records.length).toBe(recordsBefore);
    expect(after.prescriptions.length).toBe(prescriptionsBefore);
  });

  it("files the summary on the profile", async () => {
    const result = await sync(buildPayload());

    expect(result.summary?.headline).toContain("Migraine without aura");
    expect(result.summary?.needsReview).toBe(true);

    const db = readDb();
    const filed = db.summaries.find(
      (item) =>
        item.patientId === PATIENT_ID &&
        item.headline === "Migraine without aura — 1 medicine prescribed",
    );

    expect(filed).toBeDefined();
    expect(filed?.reviewed).toBe(false);
  });

  it("rejects a payload for a patient that does not exist", async () => {
    const response = await mockTransport.request<EmrSyncResult>({
      method: "POST",
      path: "/emr/sync",
      body: {
        target: "mediqueue-emr",
        patientId: "NOPE",
        externalPatientId: "NOPE",
        conditions: [],
        allergies: [],
        prescriptions: [],
        records: [],
        summary: null,
      },
      userId: PATIENT_ID,
    });

    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.error.code).toBe("PATIENT_NOT_FOUND");
      expect(response.error.status).toBe(404);
    }
  });
});

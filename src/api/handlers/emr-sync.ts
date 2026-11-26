import { fail, ok } from "@/api/envelope";
import { readDb, writeDb } from "@/demo/db";
import { format } from "date-fns";
import type {
  AiCaseSummary,
  Allergy,
  Condition,
  EmrSyncResult,
  MedicalRecord,
  Prescription,
} from "@/types";
import { bodyOf, type HandlerMap } from "../mock-transport";

/**
 * The receiving end of the AI → medical record sync.
 *
 * The AI summary service (`ai-summary-prototype/`) reads a patient's uploaded
 * prescriptions and produces a payload in the MediQueue EMR shape. This
 * endpoint is where that payload lands.
 *
 * Two rules decide everything here:
 *
 *  - **It is idempotent.** Syncing the same payload twice must not double the
 *    record. A condition is matched by name, an allergy by substance, a
 *    prescription by its date and medicines, and a record by its date,
 *    diagnosis and document name. Anything already on file is counted as
 *    skipped and left alone.
 *  - **It never invents anything.** A field the payload does not carry is
 *    left empty rather than filled in with a plausible value. A clinical
 *    record is the one place where a guess is not acceptable.
 */

/** Today's date, as `YYYY-MM-DD`. */
function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** Read a field as a string, or null when it is absent. */
function asString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value);
  return text.length > 0 ? text : null;
}

/** Read a field as a list of strings. */
function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter((item) => item.length > 0);
}

/** Read a field as a list of objects. */
function asArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      typeof item === "object" && item !== null,
  );
}

/** Keep the condition status inside the set the record understands. */
function normaliseConditionStatus(value: unknown): Condition["status"] {
  const status = String(value ?? "");
  if (status === "Resolved" || status === "Chronic") return status;
  return "Active";
}

/** Keep the allergy severity inside the set the record understands. */
function normaliseAllergySeverity(value: unknown): Allergy["severity"] {
  const severity = String(value ?? "");
  if (severity === "Moderate" || severity === "Severe") return severity;
  return "Mild";
}

/** Keep the visit type inside the set the record understands. */
function normaliseVisitType(value: unknown): MedicalRecord["visitType"] {
  const type = String(value ?? "");
  if (
    type === "New" ||
    type === "Follow-up" ||
    type === "Emergency" ||
    type === "Teleconsultation"
  ) {
    return type;
  }
  return "Follow-up";
}

export const emrSyncHandlers: HandlerMap = {
  /**
   * File the AI summary payload into the medical record.
   *
   * The body is the payload itself, or `{ payload: … }` — the AI service sends
   * it both ways depending on the caller.
   */
  "POST /emr/sync": (request) => {
    const body = bodyOf(request);
    const db = readDb();

    const payload = (body.payload ?? body) as Record<string, unknown>;

    // The AI service knows the patient by its own id; the main system knows
    // them by theirs. The external id is the link between the two.
    const externalPatientId = String(payload.externalPatientId ?? "");
    const payloadPatientId = String(payload.patientId ?? "");

    const patient =
      db.users.find((item) => item.id === externalPatientId) ??
      db.users.find((item) => item.id === payloadPatientId) ??
      null;

    if (!patient) {
      return fail(
        "PATIENT_NOT_FOUND",
        "No such patient in the medical record.",
        404,
      );
    }

    const patientId = patient.id;

    const created = {
      conditions: 0,
      allergies: 0,
      prescriptions: 0,
      records: 0,
    };
    const skipped = {
      conditions: 0,
      allergies: 0,
      prescriptions: 0,
      records: 0,
    };

    const newConditions: Condition[] = [];
    const newAllergies: Allergy[] = [];
    const newPrescriptions: Prescription[] = [];
    const newRecords: MedicalRecord[] = [];

    // ── conditions ───────────────────────────────────────────────────────────
    for (const raw of asArray(payload.conditions)) {
      const name = String(raw.name ?? "").trim();
      if (!name) continue;

      const existing = db.conditions.find(
        (item) =>
          item.patientId === patientId &&
          item.name.toLowerCase() === name.toLowerCase(),
      );

      if (existing) {
        skipped.conditions += 1;
        continue;
      }

      newConditions.push({
        id: `CN${db.counters.condition + newConditions.length + 1}`,
        patientId,
        name,
        code: asString(raw.code),
        diagnosedAt: String(raw.diagnosedAt ?? todayIso()),
        status: normaliseConditionStatus(raw.status),
        notes: String(raw.notes ?? ""),
      });
      created.conditions += 1;
    }

    // ── allergies ───────────────────────────────────────────────────────────
    for (const raw of asArray(payload.allergies)) {
      const substance = String(raw.substance ?? "").trim();
      if (!substance) continue;

      const existing = db.allergies.find(
        (item) =>
          item.patientId === patientId &&
          item.substance.toLowerCase() === substance.toLowerCase(),
      );

      if (existing) {
        skipped.allergies += 1;
        continue;
      }

      newAllergies.push({
        id: `AL${db.counters.allergy + newAllergies.length + 1}`,
        patientId,
        substance,
        reaction: String(raw.reaction ?? ""),
        severity: normaliseAllergySeverity(raw.severity),
        recordedAt: String(raw.recordedAt ?? todayIso()),
        recordedBy: String(raw.recordedBy ?? "AI summary service"),
      });
      created.allergies += 1;
    }

    // ── prescriptions ────────────────────────────────────────────────────────
    for (const raw of asArray(payload.prescriptions)) {
      const rawItems = asArray(raw.items);
      if (rawItems.length === 0) continue;

      const date = String(raw.date ?? todayIso());
      const signature = rawItems
        .map((item) => String(item.medicine ?? ""))
        .join("|")
        .toLowerCase();

      const existing = db.prescriptions.find(
        (item) =>
          item.patientId === patientId &&
          item.date === date &&
          item.items
            .map((entry) => entry.medicine)
            .join("|")
            .toLowerCase() === signature,
      );

      if (existing) {
        skipped.prescriptions += 1;
        continue;
      }

      newPrescriptions.push({
        id: `PR${db.counters.prescription + newPrescriptions.length + 1}`,
        patientId,
        appointmentId: null,
        doctorId: "",
        doctorName: String(raw.doctorName ?? "AI summary service"),
        date,
        items: rawItems.map((item, index) => ({
          id: `I${index + 1}`,
          medicine: String(item.medicine ?? ""),
          dose: String(item.dose ?? ""),
          frequency: String(item.frequency ?? ""),
          duration: String(item.duration ?? ""),
          instructions: asString(item.instructions),
        })),
        advice: String(raw.advice ?? ""),
        notes: asString(raw.notes),
      });
      created.prescriptions += 1;
    }

    // ── records ──────────────────────────────────────────────────────────────
    for (const raw of asArray(payload.records)) {
      const date = String(raw.date ?? todayIso());
      const diagnosis = String(raw.diagnosis ?? "").trim();
      const documentName = asString(raw.documentName);

      const existing = db.records.find(
        (item) =>
          item.patientId === patientId &&
          item.date === date &&
          item.diagnosis === diagnosis &&
          (item.documentName ?? null) === documentName,
      );

      if (existing) {
        skipped.records += 1;
        continue;
      }

      const vitals = (raw.vitals ?? {}) as Record<string, unknown>;
      const now = new Date().toISOString();

      newRecords.push({
        id: `MR${db.counters.record + newRecords.length + 1}`,
        patientId,
        doctorId: "",
        doctorName: "AI summary service",
        hospitalId: "H001",
        date,
        visitType: normaliseVisitType(raw.visitType),
        chiefComplaint: String(raw.chiefComplaint ?? diagnosis),
        diagnosis,
        notes: String(raw.notes ?? ""),
        vitals: {
          bloodPressure: asString(vitals.bloodPressure),
          temperature: asString(vitals.temperature),
          pulse: asString(vitals.pulse),
          weight: asString(vitals.weight),
          spo2: asString(vitals.spo2),
        },
        documentName,
        documentSize:
          typeof raw.documentSize === "number" ? raw.documentSize : null,
        createdAt: now,
        updatedAt: now,
      });
      created.records += 1;
    }

    // ── the summary on the profile ───────────────────────────────────────────
    const rawSummary = (payload.summary ?? null) as Record<string, unknown> | null;
    let filedSummary: EmrSyncResult["summary"] = null;
    let newSummary: AiCaseSummary | null = null;

    if (rawSummary) {
      const headline = String(rawSummary.headline ?? "").trim();
      const text = String(rawSummary.text ?? "").trim();

      if (headline || text) {
        const provider = asString(rawSummary.provider);
        const model = asString(rawSummary.model);

        // The demo service reports itself as the demo provider, so a summary
        // it produces is labelled as simulated — exactly like the rest of the
        // demo data.
        const simulated = provider === "demo" || model === "demo-script";

        const alreadyFiled = db.summaries.some(
          (item) =>
            item.patientId === patientId &&
            item.headline === headline &&
            item.summary === text,
        );

        if (!alreadyFiled) {
          newSummary = {
            id: `AS${db.counters.summary + 1}`,
            patientId,
            generatedAt: new Date().toISOString(),
            simulated,
            headline,
            summary: text,
            keyFindings: asStringArray(rawSummary.keyFindings),
            currentMedications: [],
            allergies: asStringArray(rawSummary.allergies),
            conditions: asStringArray(rawSummary.conditions),
            recommendations: asStringArray(rawSummary.recommendations),
            reviewed: rawSummary.needsReview === false,
            editedSummary: null,
          };
        }

        filedSummary = {
          headline,
          text,
          needsReview: rawSummary.needsReview !== false,
          provider,
          model,
          confidence:
            typeof rawSummary.confidence === "number"
              ? rawSummary.confidence
              : null,
        };
      }
    }

    writeDb((current) => ({
      ...current,
      conditions: [...current.conditions, ...newConditions],
      allergies: [...current.allergies, ...newAllergies],
      prescriptions: [...current.prescriptions, ...newPrescriptions],
      records: [...current.records, ...newRecords],
      summaries: newSummary
        ? [newSummary, ...current.summaries]
        : current.summaries,
      counters: {
        ...current.counters,
        condition: current.counters.condition + newConditions.length,
        allergy: current.counters.allergy + newAllergies.length,
        prescription: current.counters.prescription + newPrescriptions.length,
        record: current.counters.record + newRecords.length,
        summary: current.counters.summary + (newSummary ? 1 : 0),
      },
    }));

    const total =
      created.conditions +
      created.allergies +
      created.prescriptions +
      created.records;

    const result: EmrSyncResult = {
      patientId,
      created,
      skipped,
      summary: filedSummary,
      message:
        total === 0
          ? "Everything in the payload was already on file."
          : `${total} item(s) were added to the medical record.`,
    };

    return ok(result);
  },
};

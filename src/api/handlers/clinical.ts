import { fail, ok } from "@/api/envelope";
import { readDb, writeDb } from "@/demo/db";
import { format, parseISO } from "date-fns";
import type {
  AiCaseSummary,
  Allergy,
  Condition,
  DiagnosticReport,
  MedicalRecord,
  Prescription,
} from "@/types";
import { bodyOf, queryOf, type HandlerMap } from "../mock-transport";

function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export const emrHandlers: HandlerMap = {
  "GET /records": (request) => {
    const query = queryOf(request);
    const db = readDb();

    let records = db.records;

    if (query.patientId) {
      records = records.filter((item) => item.patientId === query.patientId);
    }
    if (query.doctorId) {
      records = records.filter((item) => item.doctorId === query.doctorId);
    }
    if (query.hospitalId) {
      records = records.filter((item) => item.hospitalId === query.hospitalId);
    }
    if (query.from) {
      records = records.filter((item) => item.date >= query.from!);
    }
    if (query.to) {
      records = records.filter((item) => item.date <= query.to!);
    }
    if (query.search) {
      const needle = query.search.toLowerCase();
      records = records.filter((item) =>
        `${item.diagnosis} ${item.chiefComplaint} ${item.doctorName} ${item.notes}`
          .toLowerCase()
          .includes(needle),
      );
    }

    records = [...records].sort((a, b) => b.date.localeCompare(a.date));

    return ok(records, {
      total: records.length,
      page: 1,
      pageSize: records.length,
      totalPages: 1,
    });
  },

  "GET /records/:id": (request) => {
    const query = queryOf(request);
    const db = readDb();
    const record = db.records.find((item) => item.id === query.id);

    if (!record) {
      return fail("NOT_FOUND", "No such medical record.", 404);
    }

    return ok(record);
  },

  "POST /records": (request) => {
    const body = bodyOf(request);
    const db = readDb();

    const patientId = String(body.patientId ?? "");
    const doctorId = String(body.doctorId ?? "");
    const chiefComplaint = String(body.chiefComplaint ?? "").trim();
    const diagnosis = String(body.diagnosis ?? "").trim();

    const fields: Record<string, string> = {};
    if (!patientId) fields.patientId = "Choose a patient";
    if (!doctorId) fields.doctorId = "Choose a doctor";
    if (!chiefComplaint) fields.chiefComplaint = "Chief complaint is required";
    if (!diagnosis) fields.diagnosis = "Diagnosis is required";
    if (Object.keys(fields).length > 0) {
      return fail("VALIDATION_ERROR", "Please correct the highlighted fields.", 400, fields);
    }

    const doctor = db.doctors.find((item) => item.id === doctorId);
    const patient = db.users.find((item) => item.id === patientId);

    if (!doctor || !patient) {
      return fail("NOT_FOUND", "The doctor or patient no longer exists.", 404);
    }

    const created: MedicalRecord = {
      id: `MR${db.counters.record + 1}`,
      patientId,
      doctorId,
      doctorName: doctor.name,
      hospitalId: doctor.hospitalIds[0] ?? "H001",
      date: String(body.date ?? todayIso()),
      visitType: (body.visitType as MedicalRecord["visitType"]) ?? "New",
      chiefComplaint,
      diagnosis,
      notes: String(body.notes ?? ""),
      vitals: {
        bloodPressure: (body.bloodPressure as string) ?? null,
        temperature: (body.temperature as string) ?? null,
        pulse: (body.pulse as string) ?? null,
        weight: (body.weight as string) ?? null,
        spo2: (body.spo2 as string) ?? null,
      },
      documentName: (body.documentName as string) ?? null,
      documentSize: (body.documentSize as number) ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    writeDb((current) => ({
      ...current,
      records: [created, ...current.records],
      counters: { ...current.counters, record: current.counters.record + 1 },
    }));

    return ok(created);
  },

  "PATCH /records/:id": (request) => {
    const query = queryOf(request);
    const body = bodyOf(request);
    const db = readDb();
    const record = db.records.find((item) => item.id === query.id);

    if (!record) {
      return fail("NOT_FOUND", "No such medical record.", 404);
    }

    const updated: MedicalRecord = {
      ...record,
      chiefComplaint:
        body.chiefComplaint !== undefined
          ? String(body.chiefComplaint)
          : record.chiefComplaint,
      diagnosis:
        body.diagnosis !== undefined ? String(body.diagnosis) : record.diagnosis,
      notes: body.notes !== undefined ? String(body.notes) : record.notes,
      visitType:
        body.visitType !== undefined
          ? (body.visitType as MedicalRecord["visitType"])
          : record.visitType,
      date: body.date !== undefined ? String(body.date) : record.date,
      vitals: {
        bloodPressure:
          (body.bloodPressure as string) ?? record.vitals.bloodPressure,
        temperature:
          (body.temperature as string) ?? record.vitals.temperature,
        pulse: (body.pulse as string) ?? record.vitals.pulse,
        weight: (body.weight as string) ?? record.vitals.weight,
        spo2: (body.spo2 as string) ?? record.vitals.spo2,
      },
      updatedAt: new Date().toISOString(),
    };

    writeDb((current) => ({
      ...current,
      records: current.records.map((item) =>
        item.id === updated.id ? updated : item,
      ),
    }));

    return ok(updated);
  },

  "DELETE /records/:id": (request) => {
    const query = queryOf(request);
    const db = readDb();
    const record = db.records.find((item) => item.id === query.id);

    if (!record) {
      return fail("NOT_FOUND", "No such medical record.", 404);
    }

    writeDb((current) => ({
      ...current,
      records: current.records.filter((item) => item.id !== query.id),
    }));

    return ok({ success: true });
  },

  "GET /prescriptions": (request) => {
    const query = queryOf(request);
    const db = readDb();

    let prescriptions = db.prescriptions;

    if (query.patientId) {
      prescriptions = prescriptions.filter(
        (item) => item.patientId === query.patientId,
      );
    }
    if (query.doctorId) {
      prescriptions = prescriptions.filter(
        (item) => item.doctorId === query.doctorId,
      );
    }

    prescriptions = [...prescriptions].sort((a, b) => b.date.localeCompare(a.date));

    return ok(prescriptions, {
      total: prescriptions.length,
      page: 1,
      pageSize: prescriptions.length,
      totalPages: 1,
    });
  },

  "POST /prescriptions": (request) => {
    const body = bodyOf(request);
    const db = readDb();

    const patientId = String(body.patientId ?? "");
    const items = Array.isArray(body.items) ? body.items : [];

    const fields: Record<string, string> = {};
    if (!patientId) fields.patientId = "Choose a patient";
    if (items.length === 0) fields.items = "Add at least one medicine";
    if (Object.keys(fields).length > 0) {
      return fail(
        "VALIDATION_ERROR",
        "Please correct the highlighted fields.",
        400,
        fields,
      );
    }

    if (!db.users.some((item) => item.id === patientId)) {
      return fail("NOT_FOUND", "No such patient.", 404);
    }

    const doctorId = String(body.doctorId ?? "");
    const doctor =
      db.doctors.find((item) => item.id === doctorId) ?? null;

    const created: Prescription = {
      id: `PR${db.counters.prescription + 1}`,
      patientId,
      appointmentId: null,
      doctorId: doctor?.id ?? "",
      doctorName: String(body.doctorName ?? doctor?.name ?? "AI summary service"),
      date: String(body.date ?? todayIso()),
      items: items.map((item, index) => {
        const entry = item as Record<string, unknown>;
        return {
          id: `I${index + 1}`,
          medicine: String(entry.medicine ?? ""),
          dose: String(entry.dose ?? ""),
          frequency: String(entry.frequency ?? ""),
          duration: String(entry.duration ?? ""),
          instructions:
            typeof entry.instructions === "string" ? entry.instructions : null,
        };
      }),
      advice: String(body.advice ?? ""),
      notes: typeof body.notes === "string" ? body.notes : null,
    };

    writeDb((current) => ({
      ...current,
      prescriptions: [...current.prescriptions, created],
      counters: {
        ...current.counters,
        prescription: current.counters.prescription + 1,
      },
    }));

    return ok(created);
  },

  "GET /allergies": (request) => {
    const query = queryOf(request);
    const db = readDb();

    const allergies = query.patientId
      ? db.allergies.filter((item) => item.patientId === query.patientId)
      : db.allergies;

    return ok(allergies, {
      total: allergies.length,
      page: 1,
      pageSize: allergies.length,
      totalPages: 1,
    });
  },

  "POST /allergies": (request) => {
    const body = bodyOf(request);
    const db = readDb();

    const patientId = String(body.patientId ?? "");
    const substance = String(body.substance ?? "").trim();

    if (!patientId || !substance) {
      return fail("VALIDATION_ERROR", "Please correct the highlighted fields.", 400, {
        ...(patientId ? {} : { patientId: "Choose a patient" }),
        ...(substance ? {} : { substance: "Substance is required" }),
      });
    }

    const created: Allergy = {
      id: `AL${db.counters.allergy + 1}`,
      patientId,
      substance,
      reaction: String(body.reaction ?? ""),
      severity: (body.severity as Allergy["severity"]) ?? "Mild",
      recordedAt: todayIso(),
      recordedBy: String(body.recordedBy ?? "Demo clinician"),
    };

    writeDb((current) => ({
      ...current,
      allergies: [...current.allergies, created],
      counters: { ...current.counters, allergy: current.counters.allergy + 1 },
    }));

    return ok(created);
  },

  "DELETE /allergies/:id": (request) => {
    const query = queryOf(request);
    const db = readDb();

    if (!db.allergies.some((item) => item.id === query.id)) {
      return fail("NOT_FOUND", "No such allergy.", 404);
    }

    writeDb((current) => ({
      ...current,
      allergies: current.allergies.filter((item) => item.id !== query.id),
    }));

    return ok({ success: true });
  },

  "GET /conditions": (request) => {
    const query = queryOf(request);
    const db = readDb();

    const conditions = query.patientId
      ? db.conditions.filter((item) => item.patientId === query.patientId)
      : db.conditions;

    return ok(conditions, {
      total: conditions.length,
      page: 1,
      pageSize: conditions.length,
      totalPages: 1,
    });
  },

  "POST /conditions": (request) => {
    const body = bodyOf(request);
    const db = readDb();

    const patientId = String(body.patientId ?? "");
    const name = String(body.name ?? "").trim();

    if (!patientId || !name) {
      return fail("VALIDATION_ERROR", "Please correct the highlighted fields.", 400, {
        ...(patientId ? {} : { patientId: "Choose a patient" }),
        ...(name ? {} : { name: "Name is required" }),
      });
    }

    const created: Condition = {
      id: `CN${db.counters.condition + 1}`,
      patientId,
      name,
      code: (body.code as string) ?? null,
      diagnosedAt: String(body.diagnosedAt ?? todayIso()),
      status: (body.status as Condition["status"]) ?? "Active",
      notes: String(body.notes ?? ""),
    };

    writeDb((current) => ({
      ...current,
      conditions: [...current.conditions, created],
      counters: {
        ...current.counters,
        condition: current.counters.condition + 1,
      },
    }));

    return ok(created);
  },
};

export const diagnosticHandlers: HandlerMap = {
  "GET /diagnostic-centers": (request) => {
    const query = queryOf(request);
    const db = readDb();

    let centers = db.centers;

    if (query.division) {
      centers = centers.filter((item) => item.division === query.division);
    }
    if (query.search) {
      const needle = query.search.toLowerCase();
      centers = centers.filter((item) =>
        `${item.name} ${item.address} ${item.division}`
          .toLowerCase()
          .includes(needle),
      );
    }
    if (query.service) {
      centers = centers.filter((item) => item.services.includes(query.service!));
    }

    return ok(centers, {
      total: centers.length,
      page: 1,
      pageSize: centers.length,
      totalPages: 1,
    });
  },

  "GET /diagnostic-centers/:id": (request) => {
    const query = queryOf(request);
    const db = readDb();
    const center = db.centers.find((item) => item.id === query.id);

    if (!center) {
      return fail("NOT_FOUND", "No such diagnostic centre.", 404);
    }

    const reports = db.reports.filter((item) => item.centerId === center.id);

    return ok({ center, reports });
  },

  "GET /reports": (request) => {
    const query = queryOf(request);
    const db = readDb();

    let reports = db.reports;

    if (query.patientId) {
      reports = reports.filter((item) => item.patientId === query.patientId);
    }
    if (query.centerId) {
      reports = reports.filter((item) => item.centerId === query.centerId);
    }
    if (query.status) {
      reports = reports.filter((item) => item.status === query.status);
    }
    if (query.reportType) {
      reports = reports.filter((item) => item.reportType === query.reportType);
    }
    if (query.search) {
      const needle = query.search.toLowerCase();
      reports = reports.filter((item) =>
        `${item.patientName} ${item.testName} ${item.reportType} ${item.centerName}`
          .toLowerCase()
          .includes(needle),
      );
    }

    reports = [...reports].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );

    return ok(reports, {
      total: reports.length,
      page: 1,
      pageSize: reports.length,
      totalPages: 1,
    });
  },

  "GET /reports/:id": (request) => {
    const query = queryOf(request);
    const db = readDb();
    const report = db.reports.find((item) => item.id === query.id);

    if (!report) {
      return fail("NOT_FOUND", "No such report.", 404);
    }

    return ok(report);
  },

  "POST /reports": (request) => {
    const body = bodyOf(request);
    const db = readDb();

    const patientId = String(body.patientId ?? "");
    const centerId = String(body.centerId ?? "");
    const testName = String(body.testName ?? "").trim();

    const fields: Record<string, string> = {};
    if (!patientId) fields.patientId = "Choose a patient";
    if (!centerId) fields.centerId = "Choose a diagnostic centre";
    if (!testName) fields.testName = "Test name is required";
    if (Object.keys(fields).length > 0) {
      return fail("VALIDATION_ERROR", "Please correct the highlighted fields.", 400, fields);
    }

    const patient = db.users.find((item) => item.id === patientId);
    const center = db.centers.find((item) => item.id === centerId);

    if (!patient || !center) {
      return fail("NOT_FOUND", "The patient or centre no longer exists.", 404);
    }

    const created: DiagnosticReport = {
      id: `RP${db.counters.report + 1}`,
      patientId,
      patientName: patient.name,
      centerId,
      centerName: center.name,
      testName,
      reportType: String(body.reportType ?? "Blood Test"),
      status: "PENDING",
      referredBy: (body.referredBy as string) ?? null,
      doctorName: (body.doctorName as string) ?? null,
      collectedDate: String(body.collectedDate ?? todayIso()),
      deliveredDate: null,
      fileName: (body.fileName as string) ?? null,
      fileSize: (body.fileSize as number) ?? null,
      summary: (body.summary as string) ?? null,
      createdAt: new Date().toISOString(),
    };

    writeDb((current) => ({
      ...current,
      reports: [created, ...current.reports],
      counters: { ...current.counters, report: current.counters.report + 1 },
    }));

    return ok(created);
  },

  "PATCH /reports/:id/status": (request) => {
    const query = queryOf(request);
    const body = bodyOf(request);
    const db = readDb();
    const report = db.reports.find((item) => item.id === query.id);

    if (!report) {
      return fail("NOT_FOUND", "No such report.", 404);
    }

    const status = String(body.status ?? "PENDING") as DiagnosticReport["status"];
    const valid: DiagnosticReport["status"][] = [
      "PENDING",
      "PROCESSING",
      "READY",
      "DELIVERED",
      "REJECTED",
    ];

    if (!valid.includes(status)) {
      return fail("VALIDATION_ERROR", "That report status is not valid.", 400, {
        status: "Choose a valid status",
      });
    }

    const updated: DiagnosticReport = {
      ...report,
      status,
      summary:
        body.summary !== undefined
          ? (body.summary as string)
          : report.summary,
      deliveredDate:
        status === "DELIVERED" ? todayIso() : report.deliveredDate,
    };

    writeDb((current) => ({
      ...current,
      reports: current.reports.map((item) =>
        item.id === updated.id ? updated : item,
      ),
    }));

    return ok(updated);
  },
};

/**
 * The AI summary handlers.
 *
 * The "generation" is a fixed demo summary assembled from the patient's own
 * records. It is always flagged as simulated — no model runs, and the text
 * is never a medical assessment.
 */
export const aiSummaryHandlers: HandlerMap = {
  "GET /ai-summaries": (request) => {
    const query = queryOf(request);
    const db = readDb();

    let summaries = db.summaries;
    if (query.patientId) {
      summaries = summaries.filter((item) => item.patientId === query.patientId);
    }

    return ok(summaries, {
      total: summaries.length,
      page: 1,
      pageSize: summaries.length,
      totalPages: 1,
    });
  },

  "GET /ai-summaries/:id": (request) => {
    const query = queryOf(request);
    const db = readDb();
    const summary = db.summaries.find((item) => item.id === query.id);

    if (!summary) {
      return fail("NOT_FOUND", "No such summary.", 404);
    }

    return ok(summary);
  },

  "POST /ai-summaries/generate": (request) => {
    const body = bodyOf(request);
    const db = readDb();

    const patientId = String(body.patientId ?? "");
    const patient = db.users.find((item) => item.id === patientId);

    if (!patient) {
      return fail("VALIDATION_ERROR", "Please choose a patient.", 400, {
        patientId: "Choose a patient",
      });
    }

    const records = db.records.filter((item) => item.patientId === patientId);
    const prescriptions = db.prescriptions.filter(
      (item) => item.patientId === patientId,
    );
    const allergies = db.allergies.filter((item) => item.patientId === patientId);
    const conditions = db.conditions.filter((item) => item.patientId === patientId);

    const medications = prescriptions.flatMap((prescription: Prescription) =>
      prescription.items.map(
        (item) => `${item.medicine} ${item.dose} — ${item.frequency}`,
      ),
    );

    const latestRecord = records[0];

    const summary: AiCaseSummary = {
      id: `AS${db.counters.summary + 1}`,
      patientId,
      generatedAt: new Date().toISOString(),
      simulated: true,
      headline: latestRecord
        ? `${patient.name} — ${latestRecord.diagnosis}. ${records.length} consultation${records.length === 1 ? "" : "s"} on record.`
        : `${patient.name} — no consultations on record yet.`,
      summary:
        records.length > 0
          ? `This simulated summary was assembled from ${records.length} consultation record${records.length === 1 ? "" : "s"}, ${prescriptions.length} prescription${prescriptions.length === 1 ? "" : "s"} and ${allergies.length} recorded allergy${allergies.length === 1 ? "" : "ies"}. The most recent consultation on ${latestRecord?.date ?? "record"} was with ${latestRecord?.doctorName ?? "a clinician"} and recorded the complaint "${latestRecord?.chiefComplaint ?? "—"}". The recorded diagnosis was "${latestRecord?.diagnosis ?? "—"}". This text is generated by a demonstration script, not by a medical model, and it is not a clinical assessment.`
          : "This simulated summary was assembled from the patient's record. No consultation history is on file yet, so there is nothing to summarise beyond the demographic details.",
      keyFindings: records
        .slice(0, 4)
        .map(
          (record) =>
            `${record.date} — ${record.diagnosis} (${record.doctorName})`,
        ),
      currentMedications: Array.from(new Set(medications)),
      allergies: allergies.map(
        (item) => `${item.substance} — ${item.reaction} (${item.severity.toLowerCase()})`,
      ),
      conditions: conditions.map((item) => item.name),
      recommendations: [
        "Confirm the record with the treating clinician before acting on it",
        "Reconcile the medication list at the next consultation",
        "Flag any allergies before prescribing",
      ],
      reviewed: false,
      editedSummary: null,
    };

    writeDb((current) => ({
      ...current,
      summaries: [summary, ...current.summaries],
      counters: { ...current.counters, summary: current.counters.summary + 1 },
    }));

    return ok(summary);
  },

  "PATCH /ai-summaries/:id": (request) => {
    const query = queryOf(request);
    const body = bodyOf(request);
    const db = readDb();
    const summary = db.summaries.find((item) => item.id === query.id);

    if (!summary) {
      return fail("NOT_FOUND", "No such summary.", 404);
    }

    const updated: AiCaseSummary = {
      ...summary,
      reviewed:
        body.reviewed !== undefined ? body.reviewed === true : summary.reviewed,
      editedSummary:
        body.editedSummary !== undefined
          ? (body.editedSummary as string)
          : summary.editedSummary,
      summary:
        body.summary !== undefined ? String(body.summary) : summary.summary,
    };

    writeDb((current) => ({
      ...current,
      summaries: current.summaries.map((item) =>
        item.id === updated.id ? updated : item,
      ),
    }));

    return ok(updated);
  },
};

export { parseISO };

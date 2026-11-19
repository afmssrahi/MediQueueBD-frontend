import { fail, ok } from "@/api/envelope";
import { readDb, writeDb } from "@/demo/db";
import { format } from "date-fns";
import type {
  Appointment,
  Doctor,
  QueueEvent,
  QueueSnapshot,
} from "@/types";
import type { QueueState } from "@/domain/queue/types";
import { queueReducer, type QueueAction } from "@/domain/queue/reducer";
import { buildQueueState } from "@/domain/queue/state-builder";
import { computeEffectiveOrder } from "@/domain/queue/queue-engine";
import { computeMetrics } from "@/domain/waiting-time/metrics-engine";
import { bodyOf, queryOf, type HandlerMap } from "../mock-transport";

/**
 * Queue handlers.
 *
 * The queue lives in the demo database: appointments carry the status, and
 * the pure reducer computes positions and estimates. Each action runs the
 * reducer and writes the result back.
 */

function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** Minutes since midnight, right now. */
function nowMinute(): number {
  const date = new Date();
  return date.getHours() * 60 + date.getMinutes();
}

/** Load the queue state for the doctors of a hospital (or all doctors). */
function loadQueueState(
  hospitalId?: string,
  date: string = todayIso(),
): {
  state: QueueState;
  appointments: Appointment[];
  doctors: Doctor[];
} {
  const db = readDb();

  const doctors = hospitalId
    ? db.doctors.filter((doctor) => doctor.hospitalIds.includes(hospitalId))
    : db.doctors;

  const doctorIds = new Set(doctors.map((doctor) => doctor.id));
  const appointments = db.appointments.filter((appointment) =>
    doctorIds.has(appointment.doctorId),
  );

  // The seeded queue snapshot carries the extra per-patient facts the
  // appointments table does not store.
  const snapshot = db.queues.find((item) => item.date === date);
  const checkedIn: Record<string, number> = {};
  const inConsultation: Record<string, number> = {};
  const arrivalRequested: Record<string, number> = {};
  const deadlines: Record<string, number> = {};
  const travelMinutes: Record<string, number> = {};

  for (const entry of snapshot?.entries ?? []) {
    if (entry.checkedInAt !== null) checkedIn[entry.appointmentId] = entry.checkedInAt;
    if (entry.consultationStartedAt !== null)
      inConsultation[entry.appointmentId] = entry.consultationStartedAt;
    if (entry.arrivalRequestSentAt !== null)
      arrivalRequested[entry.appointmentId] = entry.arrivalRequestSentAt;
    if (entry.arrivalDeadline !== null)
      deadlines[entry.appointmentId] = entry.arrivalDeadline;
    if (entry.estimatedTravelMinutes !== null)
      travelMinutes[entry.appointmentId] = entry.estimatedTravelMinutes;
  }

  // Appointments whose status already implies a check-in.
  for (const appointment of appointments) {
    if (
      ["CHECKED_IN", "WAITING", "CALLED", "IN_CONSULTATION"].includes(
        appointment.status,
      ) &&
      checkedIn[appointment.id] === undefined
    ) {
      checkedIn[appointment.id] = appointment.startMinute;
    }
    if (
      appointment.status === "IN_CONSULTATION" &&
      inConsultation[appointment.id] === undefined
    ) {
      inConsultation[appointment.id] = appointment.startMinute;
    }
  }

  const state = buildQueueState({
    doctors,
    appointments,
    date,
    simTime: nowMinute(),
    settings: {
      arrivalBufferMinutes: db.settings.arrivalBufferMinutes,
      gracePeriodMinutes: db.settings.gracePeriodMinutes,
      noShowAfterGraceMinutes: db.settings.noShowAfterGraceMinutes,
      targetReadyPatients: db.settings.targetReadyPatients,
      latePenaltyPolicy: db.settings.latePenaltyPolicy,
      atHomeOrderingRule: db.settings.atHomeOrderingRule,
      durationStrategy: db.settings.durationStrategy,
      notificationLeadMinutes: db.settings.notificationLeadMinutes,
      historyWindow: db.settings.historyWindow,
    },
    checkedIn,
    inConsultation,
    arrivalRequested,
    deadlines,
    travelMinutes,
  });

  return { state, appointments, doctors };
}

/** Write the reducer's result back into the demo database. */
function persistQueue(
  state: ReturnType<typeof buildQueueState>,
  appointments: import("@/types").Appointment[],
  events: { id: string; doctorId: string | null; patientId: string | null; eventType: string; description: string; actor: string; previousStatus: string | null; newStatus: string | null; previousPosition: number | null; newPosition: number | null; reason: string | null; reasons: string[]; minute: number }[],
): void {
  const updatedAppointments = appointments.map((appointment) => {
    const patient = state.patients[appointment.id];
    if (!patient) return appointment;

    // The queue domain's status maps back onto the appointment record.
    let status = appointment.status;
    switch (patient.status) {
      case "WAITING":
        status = appointment.status === "IN_CONSULTATION" ? "WAITING" : "CHECKED_IN";
        break;
      case "CALLED":
        status = "CALLED";
        break;
      case "IN_CONSULTATION":
        status = "IN_CONSULTATION";
        break;
      case "COMPLETED":
        status = "COMPLETED";
        break;
      case "CANCELLED":
        status = "CANCELLED";
        break;
      case "NO_SHOW":
        status = "NO_SHOW";
        break;
      case "SKIPPED":
        status = "SKIPPED";
        break;
      case "LATE":
        status = "LATE";
        break;
      case "ARRIVAL_REQUESTED":
        status = "BOOKED";
        break;
      case "BOOKED":
        status = appointment.status === "CANCELLED" ? "CANCELLED" : "BOOKED";
        break;
      default:
        break;
    }

    return { ...appointment, status };
  });

  const dbEvents: QueueEvent[] = events.map((event) => ({
    id: event.id,
    doctorId: event.doctorId,
    patientId: event.patientId,
    patientName: event.patientId
      ? (state.patients[event.patientId]?.patientName ?? null)
      : null,
    eventType: event.eventType,
    description: event.description,
    actor: event.actor,
    previousStatus: event.previousStatus,
    newStatus: event.newStatus,
    previousPosition: event.previousPosition,
    newPosition: event.newPosition,
    reason: event.reason,
    reasons: event.reasons,
    minute: event.minute,
    createdAt: new Date().toISOString(),
  }));

  writeDb((current) => ({
    ...current,
    appointments: updatedAppointments,
    queueEvents: [...current.queueEvents, ...dbEvents],
  }));
}

export const queueHandlers: HandlerMap = {
  "GET /queue": (request) => {
    const query = queryOf(request);
    const date = query.date ?? todayIso();
    const { state, doctors } = loadQueueState(query.hospitalId, date);

    // A doctor sees only their own queue.
    const visibleDoctors = query.doctorId
      ? doctors.filter((doctor) => doctor.id === query.doctorId)
      : doctors;

    const snapshots = visibleDoctors.map((doctor): QueueSnapshot => {
      const order = computeEffectiveOrder(state, doctor.id);
      const queueDoctor = state.doctors[doctor.id];
      const currentPatientId = queueDoctor
        ? (state.queues[queueDoctor.activeQueueId]?.currentConsultationPatientId ??
          null)
        : null;

      return {
        doctorId: doctor.id,
        date,
        currentMinute: state.simTime,
        currentPatientId,
        entries: order.map((patient, index) => ({
          appointmentId: patient.id,
          patientId: patient.patientUserId,
          patientName: patient.patientName,
          tokenNumber: patient.tokenNumber,
          queuePosition: index + 1,
          status: patient.status,
          checkedInAt: patient.checkedInAt,
          estimatedConsultationStart: patient.estimatedConsultationStart,
          estimatedWaitingMinutes: patient.estimatedWaitingMinutes,
          recommendedArrivalTime: patient.recommendedArrivalTime,
          arrivalDeadline: patient.arrivalDeadline,
          recommendedDepartureTime: patient.recommendedDepartureTime,
          estimatedTravelMinutes: patient.estimatedTravelMinutes,
          isProvisional: patient.isProvisional,
          estimateReasons: patient.estimateReasons,
          arrivalRequestSentAt: patient.arrivalRequestSentAt,
          lateMarkedAt: patient.lateMarkedAt,
          noShowAt: patient.noShowAt,
          consultationStartedAt: patient.consultationStartedAt,
          consultationCompletedAt: patient.consultationCompletedAt,
          predictedConsultationMinutes: patient.predictedConsultationMinutes,
        })),
      };
    });

    return ok({ date, simTime: state.simTime, queues: snapshots });
  },

  "GET /queue/events": (request) => {
    const query = queryOf(request);
    const db = readDb();

    let events = db.queueEvents;

    if (query.doctorId) {
      events = events.filter((item) => item.doctorId === query.doctorId);
    }
    if (query.eventType) {
      events = events.filter((item) => item.eventType === query.eventType);
    }

    events = [...events].sort((a, b) => b.minute - a.minute);

    return ok(events, {
      total: events.length,
      page: 1,
      pageSize: events.length,
      totalPages: 1,
    });
  },

  "POST /queue/actions": (request) => {
    const body = bodyOf(request);
    const action = String(body.action ?? "") as QueueAction["type"];

    const allowed: QueueAction["type"][] = [
      "CHECK_IN",
      "CALL_NEXT",
      "CALL_PATIENT",
      "START_CONSULTATION",
      "COMPLETE_CONSULTATION",
      "CANCEL_PATIENT",
      "SKIP_PATIENT",
      "RESTORE_PATIENT",
      "MARK_LATE",
      "MARK_NO_SHOW",
      "OVERRIDE_STATUS",
      "OVERRIDE_POSITION",
      "SET_REMAINING_OVERRIDE",
      "SET_DOCTOR_BREAK",
      "SET_DOCTOR_UNAVAILABLE",
      "SET_DOCTOR_AVAILABLE",
    ];

    if (!allowed.includes(action)) {
      return fail("UNKNOWN_ACTION", `Unknown queue action "${action}".`, 400);
    }

    const date = todayIso();
    const { state, appointments, doctors } = loadQueueState(
      body.hospitalId as string | undefined,
      date,
    );

    // The reducer needs the estimates already applied, so the state is
    // settled once before the action runs.
    const initial = queueReducer(state, { type: "INIT" });

    const payload: Record<string, unknown> = {
      type: action,
      ...(body.patientId ? { patientId: String(body.patientId) } : {}),
      ...(body.doctorId ? { doctorId: String(body.doctorId) } : {}),
      ...(body.newStatus ? { newStatus: String(body.newStatus) } : {}),
      ...(body.newPosition !== undefined
        ? { newPosition: Number(body.newPosition) }
        : {}),
      ...(body.minutes !== undefined
        ? { minutes: body.minutes === null ? null : Number(body.minutes) }
        : {}),
      ...(body.breakEnd !== undefined
        ? { breakEnd: body.breakEnd === null ? null : Number(body.breakEnd) }
        : {}),
      ...(body.reason ? { reason: String(body.reason) } : {}),
      ...(body.operator ? { operator: String(body.operator) } : {}),
    };

    // The override actions require a reason — the reducer refuses without one.
    if (
      (action === "OVERRIDE_STATUS" || action === "OVERRIDE_POSITION") &&
      !String(body.reason ?? "").trim()
    ) {
      return fail(
        "REASON_REQUIRED",
        "A reason is required for a queue override.",
        400,
        { reason: "A reason is required for a queue override" },
      );
    }

    const result = queueReducer(initial.state, payload as QueueAction);

    persistQueue(result.state, appointments, result.events);

    const order = computeEffectiveOrder(
      result.state,
      String(body.doctorId ?? ""),
    );
    const changed = order.find((patient) => patient.id === body.patientId);

    return ok({
      action,
      events: result.events.length,
      patient: changed ?? null,
      doctorId: body.doctorId ?? null,
      doctors: doctors.length,
    });
  },

  "GET /queue/settings": () => {
    const db = readDb();
    return ok({
      arrivalBufferMinutes: db.settings.arrivalBufferMinutes,
      gracePeriodMinutes: db.settings.gracePeriodMinutes,
      noShowAfterGraceMinutes: db.settings.noShowAfterGraceMinutes,
      targetReadyPatients: db.settings.targetReadyPatients,
      latePenaltyPolicy: db.settings.latePenaltyPolicy,
      atHomeOrderingRule: db.settings.atHomeOrderingRule,
      durationStrategy: db.settings.durationStrategy,
      notificationLeadMinutes: db.settings.notificationLeadMinutes,
      historyWindow: db.settings.historyWindow,
    });
  },

  "PATCH /queue/settings": (request) => {
    const body = bodyOf(request);

    writeDb((current) => ({
      ...current,
      settings: { ...current.settings, ...body },
    }));

    const db = readDb();
    return ok({
      arrivalBufferMinutes: db.settings.arrivalBufferMinutes,
      gracePeriodMinutes: db.settings.gracePeriodMinutes,
      noShowAfterGraceMinutes: db.settings.noShowAfterGraceMinutes,
      targetReadyPatients: db.settings.targetReadyPatients,
      latePenaltyPolicy: db.settings.latePenaltyPolicy,
      atHomeOrderingRule: db.settings.atHomeOrderingRule,
      durationStrategy: db.settings.durationStrategy,
      notificationLeadMinutes: db.settings.notificationLeadMinutes,
      historyWindow: db.settings.historyWindow,
    });
  },

  "GET /stats/hospital": (request) => {
    const query = queryOf(request);
    const date = todayIso();
    const { state } = loadQueueState(query.hospitalId, date);

    const metrics = computeMetrics(state, query.doctorId ?? null);
    const db = readDb();

    const appointments = db.appointments.filter(
      (item) =>
        !query.hospitalId || item.hospitalId === query.hospitalId,
    );

    const byDate = new Map<string, number>();
    for (const appointment of appointments) {
      byDate.set(
        appointment.date,
        (byDate.get(appointment.date) ?? 0) + 1,
      );
    }

    const appointmentsPerDay = [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([day, count]) => ({ date: day, count }));

    const byHour = new Map<number, number>();
    for (const appointment of appointments) {
      const hour = Math.floor(appointment.startMinute / 60);
      byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
    }

    const busiestHours = [...byHour.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([hour, count]) => ({ hour, count }));

    return ok({
      metrics,
      appointmentsPerDay,
      busiestHours,
      totalDoctors: query.hospitalId
        ? db.doctors.filter((doctor) =>
            doctor.hospitalIds.includes(query.hospitalId!),
          ).length
        : db.doctors.length,
      totalDepartments: query.hospitalId
        ? db.departments.filter((item) => item.hospitalId === query.hospitalId)
            .length
        : db.departments.length,
      pendingAppointments: appointments.filter(
        (item) => !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(item.status),
      ).length,
      waitingNow: appointments.filter((item) => item.status === "WAITING").length,
    });
  },
};

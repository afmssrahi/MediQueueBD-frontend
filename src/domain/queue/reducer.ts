import { STATUSES, isTerminal } from "./statuses";
import {
  applyLatePenalty,
  breakOverlapMinutes,
  computeEffectiveOrder,
  hasPatientToConsult,
  hasPendingDemand,
  nextEligiblePatient,
  recomputePositions,
  sessionOverlapMinutes,
} from "./queue-engine";
import type { QueueEstimate, QueuePatient, QueueState } from "./types";
import { applyArrivalRecommendations } from "../waiting-time/arrival-engine";
import {
  explainEstimateChange,
  predictedDuration,
  projectQueue,
} from "../waiting-time/estimation-engine";
import { formatTime12, isPastGrace, isPastNoShowCutoff } from "../waiting-time/time";

/**
 * queueReducer — the single pure reducer for the queue.
 *
 * Ported from the queue prototype's `src/state/simulationReducer.js`,
 * adapted to the demo database shape. Every state change goes through here,
 * which keeps the domain logic testable headlessly and portable to the
 * backend.
 *
 * This module never imports React and never touches the DOM.
 */

export type QueueAction =
  | { type: "INIT" }
  | { type: "CHECK_IN"; patientId: string; operator?: string }
  | { type: "CALL_NEXT"; doctorId: string }
  | { type: "CALL_PATIENT"; patientId: string }
  | { type: "START_CONSULTATION"; patientId: string }
  | { type: "COMPLETE_CONSULTATION"; patientId: string }
  | { type: "CANCEL_PATIENT"; patientId: string; reason?: string; operator?: string }
  | { type: "SKIP_PATIENT"; patientId: string; reason?: string; operator?: string }
  | { type: "RESTORE_PATIENT"; patientId: string; reason?: string; operator?: string }
  | { type: "MARK_LATE"; patientId: string; operator?: string }
  | { type: "MARK_NO_SHOW"; patientId: string; operator?: string }
  | {
      type: "OVERRIDE_STATUS";
      patientId: string;
      newStatus: string;
      reason: string;
      operator?: string;
    }
  | {
      type: "OVERRIDE_POSITION";
      patientId: string;
      newPosition: number;
      reason: string;
      operator?: string;
    }
  | { type: "SET_REMAINING_OVERRIDE"; patientId: string; minutes: number | null }
  | { type: "SET_DOCTOR_BREAK"; doctorId: string; breakStart?: number; breakEnd?: number | null }
  | { type: "SET_DOCTOR_UNAVAILABLE"; doctorId: string }
  | { type: "SET_DOCTOR_AVAILABLE"; doctorId: string }
  | { type: "ADVANCE"; minutes: number }
  | { type: "UPDATE_SETTINGS"; settings: Partial<QueueState["settings"]> };

export interface QueueEventRecord {
  id: string;
  doctorId: string | null;
  patientId: string | null;
  patientName?: string | null;
  eventType: string;
  description: string;
  actor: string;
  previousStatus: string | null;
  newStatus: string | null;
  previousPosition: number | null;
  newPosition: number | null;
  reason: string | null;
  reasons: string[];
  minute: number;
}

export interface QueueReducerResult {
  state: QueueState;
  events: QueueEventRecord[];
}

let eventCounter = 0;

function nextEventId(): string {
  eventCounter += 1;
  return `QE${String(eventCounter).padStart(4, "0")}`;
}

/** Reset the event counter — used by the tests and by a queue reset. */
export function resetEventCounter(): void {
  eventCounter = 0;
}

function patientContext(state: QueueState, patientId: string) {
  const patient = state.patients[patientId];
  if (!patient) return { doctorId: null, patient: null };
  return { doctorId: patient.doctorId, patient };
}

function tokenLabel(patient: QueuePatient): string {
  return `token ${String(patient.tokenNumber).padStart(2, "0")}`;
}

/**
 * Full recalculation for every doctor: positions → estimates → arrival
 * recommendations.
 */
function recalculate(
  state: QueueState,
  context: Parameters<typeof explainEstimateChange>[2] = {},
): { state: QueueState; events: QueueEventRecord[] } {
  let patients = recomputePositions(state);

  // Invariant: the queue pointer must reference a patient who is actually
  // called or in consultation.
  const queues = { ...state.queues };
  for (const queueId of Object.keys(queues)) {
    const queue = queues[queueId];
    if (!queue.currentConsultationPatientId) continue;
    const patient = state.patients[queue.currentConsultationPatientId];
    const isActive =
      patient &&
      (patient.status === STATUSES.CALLED ||
        patient.status === STATUSES.IN_CONSULTATION);
    if (!isActive) {
      queues[queueId] = { ...queue, currentConsultationPatientId: null };
    }
  }
  const stateWithQueues = { ...state, queues };

  const allEstimates: Record<string, Record<string, QueueEstimate>> = {};

  for (const doctorId of Object.keys(stateWithQueues.doctors)) {
    const { estimates } = projectQueue(
      { ...stateWithQueues, patients },
      doctorId,
      stateWithQueues.simTime,
    );
    allEstimates[doctorId] = estimates;
  }

  patients = { ...patients };
  for (const doctorId of Object.keys(stateWithQueues.doctors)) {
    patients = applyArrivalRecommendations(
      patients,
      allEstimates[doctorId],
      stateWithQueues.settings,
      stateWithQueues.simTime,
    );
  }

  const nextState = { ...stateWithQueues, patients };
  const events: QueueEventRecord[] = [];

  // Compare with the previous estimates to produce "why did this change?"
  // events.
  for (const doctorId of Object.keys(stateWithQueues.doctors)) {
    const estimates = allEstimates[doctorId];

    for (const [patientId, estimate] of Object.entries(estimates)) {
      const patient = nextState.patients[patientId];
      const previous: QueueEstimate = {
        estimatedConsultationStart: patient.estimatedConsultationStart,
        estimatedWaitingMinutes: patient.estimatedWaitingMinutes,
        isProvisional: patient.isProvisional,
        estimateReasons: patient.estimateReasons,
      };
      const previousPosition = patient.queuePosition;

      const reasons = explainEstimateChange(previous, estimate, context);
      const changed =
        previous.estimatedConsultationStart !==
          estimate.estimatedConsultationStart ||
        previous.isProvisional !== estimate.isProvisional;

      // During bootstrap there is no previous state, so no "updated" event.
      const isBootstrap = previous.estimatedConsultationStart === null;

      if (changed && !isBootstrap) {
        events.push({
          id: nextEventId(),
          doctorId,
          patientId,
          eventType: "ESTIMATE_UPDATED",
          description: `Estimate for ${patient.patientName} (${tokenLabel(patient)}) updated.`,
          actor: "SYSTEM",
          previousStatus: null,
          newStatus: null,
          previousPosition: null,
          newPosition: null,
          reason: null,
          reasons,
          minute: stateWithQueues.simTime,
        });
      }

      const positionChanged = patient.queuePosition !== previousPosition;
      if (
        positionChanged &&
        previousPosition !== null &&
        previousPosition !== undefined
      ) {
        events.push({
          id: nextEventId(),
          doctorId,
          patientId,
          eventType: "QUEUE_POSITION_UPDATED",
          description: `${patient.patientName} (${tokenLabel(patient)}) moved from position ${previousPosition} to ${patient.queuePosition}.`,
          actor: "SYSTEM",
          previousStatus: null,
          newStatus: null,
          previousPosition,
          newPosition: patient.queuePosition,
          reason: null,
          reasons: [],
          minute: stateWithQueues.simTime,
        });
      }
    }
  }

  return { state: nextState, events };
}

/**
 * Run the late / no-show sweep and apply the resulting transitions.
 */
function runDeadlineSweep(state: QueueState): {
  state: QueueState;
  events: QueueEventRecord[];
} {
  const events: QueueEventRecord[] = [];
  let nextState = { ...state };

  for (const doctorId of Object.keys(state.doctors)) {
    for (const patient of Object.values(state.patients)) {
      if (patient.doctorId !== doctorId) continue;

      const deadline = patient.lockedArrivalDeadline ?? patient.arrivalDeadline;
      if (deadline === null || deadline === undefined) continue;
      if (patient.status === STATUSES.LATE) {
        // Already late — check the no-show cutoff.
        if (
          isPastNoShowCutoff(
            state.simTime,
            deadline,
            state.settings.gracePeriodMinutes,
            state.settings.noShowAfterGraceMinutes,
          )
        ) {
          nextState = {
            ...nextState,
            patients: {
              ...nextState.patients,
              [patient.id]: {
                ...patient,
                status: STATUSES.NO_SHOW,
                noShowAt: nextState.simTime,
              },
            },
          };
          events.push({
            id: nextEventId(),
            doctorId,
            patientId: patient.id,
            eventType: "PATIENT_MARKED_NO_SHOW",
            description: `${patient.patientName} (${tokenLabel(patient)}) marked no-show.`,
            actor: "SYSTEM",
            previousStatus: patient.status,
            newStatus: STATUSES.NO_SHOW,
            previousPosition: patient.queuePosition,
            newPosition: null,
            reason: null,
            reasons: ["PATIENT_NO_SHOW"],
            minute: nextState.simTime,
          });
        }
        continue;
      }

      if (
        !isPastGrace(state.simTime, deadline, state.settings.gracePeriodMinutes)
      ) {
        continue;
      }

      const penalty = applyLatePenalty(patient, state.settings.latePenaltyPolicy);
      const lockedDeadline = deadline;

      nextState = {
        ...nextState,
        patients: {
          ...nextState.patients,
          [patient.id]: {
            ...patient,
            status: penalty.status,
            lateMarkedAt: nextState.simTime,
            lockedArrivalDeadline: lockedDeadline,
            demotedToTail:
              penalty.demoteToTail === true
                ? true
                : patient.demotedToTail,
            manualOrder: false,
          },
        },
      };

      events.push({
        id: nextEventId(),
        doctorId,
        patientId: patient.id,
        eventType: "PATIENT_MARKED_LATE",
        description: `${patient.patientName} (${tokenLabel(patient)}) marked late. ${penalty.note}`,
        actor: "SYSTEM",
        previousStatus: patient.status,
        newStatus: penalty.status,
        previousPosition: patient.queuePosition,
        newPosition: null,
        reason: penalty.note,
        reasons: ["LATE_PENALTY_APPLIED"],
        minute: nextState.simTime,
      });
    }
  }

  return { state: nextState, events };
}

/**
 * Generate arrival requests — the ready pool decides who is asked to come.
 */
function runArrivalRequests(state: QueueState): {
  state: QueueState;
  events: QueueEventRecord[];
} {
  const events: QueueEventRecord[] = [];
  let nextState = { ...state };

  for (const doctorId of Object.keys(state.doctors)) {
    const order = computeEffectiveOrder(nextState, doctorId);

    // The ready pool counts everyone committed to being ready: checked-in
    // patients plus patients already asked to arrive.
    const readyPool = order.filter(
      (patient) =>
        patient.status === STATUSES.WAITING ||
        patient.status === STATUSES.CALLED ||
        patient.status === STATUSES.IN_CONSULTATION ||
        patient.arrivalRequestSentAt !== null,
    ).length;

    if (readyPool >= nextState.settings.targetReadyPatients) continue;

    // The next at-home patient in queue order is asked to arrive.
    const next = order.find(
      (patient) =>
        patient.arrivalRequestSentAt === null &&
        (patient.status === STATUSES.BOOKED ||
          patient.status === STATUSES.WAITING_FOR_ARRIVAL),
    );
    if (!next) continue;

    const deadline =
      next.recommendedArrivalTime ?? next.estimatedConsultationStart ?? null;

    nextState = {
      ...nextState,
      patients: {
        ...nextState.patients,
        [next.id]: {
          ...next,
          status:
            next.status === STATUSES.BOOKED
              ? STATUSES.ARRIVAL_REQUESTED
              : next.status,
          arrivalRequestSentAt: nextState.simTime,
          // The commitment is made now: the deadline is locked to the slot
          // the patient was just given, and it stands still from here.
          lockedArrivalDeadline: next.lockedArrivalDeadline ?? deadline,
          arrivalDeadline: next.lockedArrivalDeadline ?? deadline,
        },
      },
    };

    events.push({
      id: nextEventId(),
      doctorId,
      patientId: next.id,
      eventType: "ARRIVAL_REQUEST_SENT",
      description: `Arrival request sent to ${next.patientName} (${tokenLabel(next)}).`,
      actor: "SYSTEM",
      previousStatus: next.status,
      newStatus:
        next.status === STATUSES.BOOKED
          ? STATUSES.ARRIVAL_REQUESTED
          : next.status,
      previousPosition: next.queuePosition,
      newPosition: null,
      reason: null,
      reasons: [],
      minute: nextState.simTime,
    });
  }

  return { state: nextState, events };
}

/**
 * Recalculate, sweep deadlines, request arrivals — in that order.
 */
function settle(
  state: QueueState,
  context: Parameters<typeof explainEstimateChange>[2] = {},
): QueueReducerResult {
  const sweep = runDeadlineSweep(state);
  let nextState = sweep.state;

  const recalc = recalculate(nextState, context);
  nextState = recalc.state;

  const triggers = runArrivalRequests(nextState);
  nextState = triggers.state;

  const second = recalculate(nextState, context);
  nextState = second.state;

  return {
    state: nextState,
    events: [...sweep.events, ...recalc.events, ...triggers.events, ...second.events],
  };
}

/* ------------------------------------------------------------------ */
/* action handlers                                                     */
/* ------------------------------------------------------------------ */

function handleCheckIn(
  state: QueueState,
  { patientId, operator = "RECEPTIONIST" }: { patientId: string; operator?: string },
): QueueReducerResult {
  const { patient } = patientContext(state, patientId);
  if (!patient) return { state, events: [] };
  if (patient.status === STATUSES.WAITING || patient.status === STATUSES.CALLED) {
    return { state, events: [] };
  }

  const checkInCounter = state.checkInCounter + 1;
  const nextState: QueueState = {
    ...state,
    checkInCounter,
    patients: {
      ...state.patients,
      [patientId]: {
        ...patient,
        status: STATUSES.WAITING,
        checkedInAt: state.simTime,
        checkInSequence: checkInCounter,
        // A late patient keeps its demoted place: joining the tail of the
        // physical queue, not restoring token priority.
        demotedToTail:
          patient.status === STATUSES.LATE ? true : patient.demotedToTail,
        manualOrder: false,
      },
    },
  };

  const event: QueueEventRecord = {
    id: nextEventId(),
    doctorId: patient.doctorId,
    patientId,
    eventType: "CHECK_IN",
    description: `${patient.patientName} (${tokenLabel(patient)}) checked in at reception.`,
    actor: operator,
    previousStatus: patient.status,
    newStatus: STATUSES.WAITING,
    previousPosition: patient.queuePosition,
    newPosition: null,
    reason: null,
    reasons: ["PATIENT_CHECKED_IN"],
    minute: state.simTime,
  };

  const settled = settle(nextState, { patientCheckedIn: patientId });
  return { state: settled.state, events: [event, ...settled.events] };
}

function handleCallNext(
  state: QueueState,
  { doctorId }: { doctorId: string },
): QueueReducerResult {
  const doctor = state.doctors[doctorId];
  if (!doctor) return { state, events: [] };

  const queue = state.queues[doctor.activeQueueId];
  if (!queue) return { state, events: [] };

  const current = queue.currentConsultationPatientId
    ? state.patients[queue.currentConsultationPatientId]
    : null;
  if (
    current &&
    (current.status === STATUSES.CALLED ||
      current.status === STATUSES.IN_CONSULTATION)
  ) {
    return { state, events: [] };
  }

  const next = nextEligiblePatient(state, doctorId);
  if (!next) return { state, events: [] };

  const nextState: QueueState = {
    ...state,
    queues: {
      ...state.queues,
      [queue.id]: { ...queue, currentConsultationPatientId: next.id },
    },
    patients: {
      ...state.patients,
      [next.id]: {
        ...next,
        status: STATUSES.CALLED,
        estimateAtCall: next.estimatedConsultationStart,
      },
    },
  };

  const event: QueueEventRecord = {
    id: nextEventId(),
    doctorId,
    patientId: next.id,
    eventType: "PATIENT_CALLED",
    description: `${next.patientName} (${tokenLabel(next)}) called.`,
    actor: "SYSTEM",
    previousStatus: next.status,
    newStatus: STATUSES.CALLED,
    previousPosition: next.queuePosition,
    newPosition: null,
    reason: null,
    reasons: [],
    minute: state.simTime,
  };

  const settled = settle(nextState);
  return { state: settled.state, events: [event, ...settled.events] };
}

function handleCallPatient(
  state: QueueState,
  { patientId }: { patientId: string },
): QueueReducerResult {
  const { doctorId, patient } = patientContext(state, patientId);
  if (!patient || !doctorId) return { state, events: [] };
  // Only checked-in patients can be called.
  if (patient.status !== STATUSES.WAITING) return { state, events: [] };

  const doctor = state.doctors[doctorId];
  const queue = state.queues[doctor.activeQueueId];
  if (!queue) return { state, events: [] };

  const nextState: QueueState = {
    ...state,
    queues: {
      ...state.queues,
      [queue.id]: { ...queue, currentConsultationPatientId: patientId },
    },
    patients: {
      ...state.patients,
      [patientId]: {
        ...patient,
        status: STATUSES.CALLED,
        estimateAtCall: patient.estimatedConsultationStart,
      },
    },
  };

  const event: QueueEventRecord = {
    id: nextEventId(),
    doctorId,
    patientId,
    eventType: "PATIENT_CALLED",
    description: `${patient.patientName} (${tokenLabel(patient)}) called.`,
    actor: "SYSTEM",
    previousStatus: patient.status,
    newStatus: STATUSES.CALLED,
    previousPosition: patient.queuePosition,
    newPosition: null,
    reason: null,
    reasons: [],
    minute: state.simTime,
  };

  const settled = settle(nextState);
  return { state: settled.state, events: [event, ...settled.events] };
}

function handleStartConsultation(
  state: QueueState,
  { patientId }: { patientId: string },
): QueueReducerResult {
  const { doctorId, patient } = patientContext(state, patientId);
  if (!patient || !doctorId) return { state, events: [] };
  if (
    patient.status !== STATUSES.CALLED &&
    patient.status !== STATUSES.WAITING
  ) {
    return { state, events: [] };
  }

  const doctor = state.doctors[doctorId];
  const queue = state.queues[doctor.activeQueueId];
  if (!queue) return { state, events: [] };

  const nextState: QueueState = {
    ...state,
    queues: {
      ...state.queues,
      [queue.id]: { ...queue, currentConsultationPatientId: patientId },
    },
    patients: {
      ...state.patients,
      [patientId]: {
        ...patient,
        status: STATUSES.IN_CONSULTATION,
        consultationStartedAt: state.simTime,
        estimateAtCall:
          patient.estimateAtCall ?? patient.estimatedConsultationStart,
      },
    },
  };

  const event: QueueEventRecord = {
    id: nextEventId(),
    doctorId,
    patientId,
    eventType: "CONSULTATION_STARTED",
    description: `Consultation started with ${patient.patientName} (${tokenLabel(patient)}).`,
    actor: "SYSTEM",
    previousStatus: patient.status,
    newStatus: STATUSES.IN_CONSULTATION,
    previousPosition: patient.queuePosition,
    newPosition: null,
    reason: null,
    reasons: [],
    minute: state.simTime,
  };

  const settled = settle(nextState);
  return { state: settled.state, events: [event, ...settled.events] };
}

function handleCompleteConsultation(
  state: QueueState,
  { patientId }: { patientId: string },
): QueueReducerResult {
  const { doctorId, patient } = patientContext(state, patientId);
  if (!patient || !doctorId) return { state, events: [] };
  if (
    patient.status !== STATUSES.IN_CONSULTATION &&
    patient.status !== STATUSES.CALLED
  ) {
    return { state, events: [] };
  }

  const doctor = state.doctors[doctorId];
  const queue = state.queues[doctor.activeQueueId];

  const actualMinutes =
    patient.consultationStartedAt !== null &&
    patient.consultationStartedAt !== undefined
      ? state.simTime - patient.consultationStartedAt
      : predictedDuration(state, doctorId, patient);

  const history = [...(doctor.consultationHistory ?? []), actualMinutes];

  const nextState: QueueState = {
    ...state,
    doctors: {
      ...state.doctors,
      [doctorId]: { ...doctor, consultationHistory: history },
    },
    queues: queue
      ? {
          ...state.queues,
          [queue.id]: { ...queue, currentConsultationPatientId: null },
        }
      : state.queues,
    patients: {
      ...state.patients,
      [patientId]: {
        ...patient,
        status: STATUSES.COMPLETED,
        consultationCompletedAt: state.simTime,
        remainingOverrideMinutes: null,
      },
    },
  };

  const event: QueueEventRecord = {
    id: nextEventId(),
    doctorId,
    patientId,
    eventType: "CONSULTATION_COMPLETED",
    description: `Consultation completed with ${patient.patientName} (${tokenLabel(patient)}) after ${actualMinutes} min.`,
    actor: "SYSTEM",
    previousStatus: patient.status,
    newStatus: STATUSES.COMPLETED,
    previousPosition: patient.queuePosition,
    newPosition: null,
    reason: null,
    reasons: ["PATIENT_COMPLETED"],
    minute: state.simTime,
  };

  const settled = settle(nextState, { patientCompleted: patientId });
  return { state: settled.state, events: [event, ...settled.events] };
}

function handleCancel(
  state: QueueState,
  { patientId, reason, operator = "RECEPTIONIST" }: { patientId: string; reason?: string; operator?: string },
): QueueReducerResult {
  const { doctorId, patient } = patientContext(state, patientId);
  if (!patient) return { state, events: [] };
  if (isTerminal(patient.status)) return { state, events: [] };

  const nextState: QueueState = {
    ...state,
    patients: {
      ...state.patients,
      [patientId]: { ...patient, status: STATUSES.CANCELLED },
    },
  };

  const event: QueueEventRecord = {
    id: nextEventId(),
    doctorId,
    patientId,
    eventType: "PATIENT_CANCELLED",
    description: `${patient.patientName} (${tokenLabel(patient)}) cancelled. ${reason ?? ""}`.trim(),
    actor: operator,
    previousStatus: patient.status,
    newStatus: STATUSES.CANCELLED,
    previousPosition: patient.queuePosition,
    newPosition: null,
    reason: reason ?? "Cancelled by receptionist.",
    reasons: ["PATIENT_CANCELLED"],
    minute: state.simTime,
  };

  const settled = settle(nextState, { patientCancelled: patientId });
  return { state: settled.state, events: [event, ...settled.events] };
}

function handleSkip(
  state: QueueState,
  { patientId, reason, operator = "RECEPTIONIST" }: { patientId: string; reason?: string; operator?: string },
): QueueReducerResult {
  const { doctorId, patient } = patientContext(state, patientId);
  if (!patient) return { state, events: [] };
  if (isTerminal(patient.status)) return { state, events: [] };

  const doctor = state.doctors[doctorId];
  const queue = doctor ? state.queues[doctor.activeQueueId] : null;

  const nextState: QueueState = {
    ...state,
    queues:
      queue && queue.currentConsultationPatientId === patientId
        ? {
            ...state.queues,
            [queue.id]: { ...queue, currentConsultationPatientId: null },
          }
        : state.queues,
    patients: {
      ...state.patients,
      [patientId]: { ...patient, status: STATUSES.SKIPPED },
    },
  };

  const event: QueueEventRecord = {
    id: nextEventId(),
    doctorId,
    patientId,
    eventType: "PATIENT_SKIPPED",
    description: `${patient.patientName} (${tokenLabel(patient)}) skipped. ${reason ?? ""}`.trim(),
    actor: operator,
    previousStatus: patient.status,
    newStatus: STATUSES.SKIPPED,
    previousPosition: patient.queuePosition,
    newPosition: null,
    reason: reason ?? "Skipped by staff.",
    reasons: ["PATIENT_SKIPPED"],
    minute: state.simTime,
  };

  const settled = settle(nextState, { patientSkipped: patientId });
  return { state: settled.state, events: [event, ...settled.events] };
}

function handleRestore(
  state: QueueState,
  { patientId, reason, operator = "RECEPTIONIST" }: { patientId: string; reason?: string; operator?: string },
): QueueReducerResult {
  const { doctorId, patient } = patientContext(state, patientId);
  if (!patient) return { state, events: [] };
  if (
    patient.status !== STATUSES.SKIPPED &&
    patient.status !== STATUSES.NO_SHOW
  ) {
    return { state, events: [] };
  }

  const nextState: QueueState = {
    ...state,
    patients: {
      ...state.patients,
      [patientId]: {
        ...patient,
        status:
          patient.checkedInAt !== null
            ? STATUSES.WAITING
            : STATUSES.WAITING_FOR_ARRIVAL,
        // A restored patient rejoins at the tail of their segment.
        demotedToTail: true,
        manualOrder: false,
      },
    },
  };

  const event: QueueEventRecord = {
    id: nextEventId(),
    doctorId,
    patientId,
    eventType: "PATIENT_RESTORED",
    description: `${patient.patientName} (${tokenLabel(patient)}) restored to the queue. ${reason ?? ""}`.trim(),
    actor: operator,
    previousStatus: patient.status,
    newStatus:
      patient.checkedInAt !== null ? STATUSES.WAITING : STATUSES.WAITING_FOR_ARRIVAL,
    previousPosition: patient.queuePosition,
    newPosition: null,
    reason: reason ?? null,
    reasons: [],
    minute: state.simTime,
  };

  const settled = settle(nextState);
  return { state: settled.state, events: [event, ...settled.events] };
}

function handleMarkLate(
  state: QueueState,
  { patientId, operator = "RECEPTIONIST" }: { patientId: string; operator?: string },
): QueueReducerResult {
  const { doctorId, patient } = patientContext(state, patientId);
  if (!patient) return { state, events: [] };

  const penalty = applyLatePenalty(patient, state.settings.latePenaltyPolicy);
  const nextState: QueueState = {
    ...state,
    patients: {
      ...state.patients,
      [patientId]: {
        ...patient,
        status: penalty.status,
        lateMarkedAt: state.simTime,
        lockedArrivalDeadline:
          patient.lockedArrivalDeadline ?? patient.arrivalDeadline ?? state.simTime,
        demotedToTail:
          penalty.demoteToTail === true ? true : patient.demotedToTail,
        manualOrder: false,
      },
    },
  };

  const event: QueueEventRecord = {
    id: nextEventId(),
    doctorId,
    patientId,
    eventType: "PATIENT_MARKED_LATE",
    description: `${patient.patientName} (${tokenLabel(patient)}) marked late. ${penalty.note}`,
    actor: operator,
    previousStatus: patient.status,
    newStatus: penalty.status,
    previousPosition: patient.queuePosition,
    newPosition: null,
    reason: penalty.note,
    reasons: ["LATE_PENALTY_APPLIED"],
    minute: state.simTime,
  };

  const settled = settle(nextState, { patientLate: patientId });
  return { state: settled.state, events: [event, ...settled.events] };
}

function handleMarkNoShow(
  state: QueueState,
  { patientId, operator = "RECEPTIONIST" }: { patientId: string; operator?: string },
): QueueReducerResult {
  const { doctorId, patient } = patientContext(state, patientId);
  if (!patient) return { state, events: [] };

  const doctor = state.doctors[doctorId];
  const queue = doctor ? state.queues[doctor.activeQueueId] : null;

  const nextState: QueueState = {
    ...state,
    queues:
      queue && queue.currentConsultationPatientId === patientId
        ? {
            ...state.queues,
            [queue.id]: { ...queue, currentConsultationPatientId: null },
          }
        : state.queues,
    patients: {
      ...state.patients,
      [patientId]: {
        ...patient,
        status: STATUSES.NO_SHOW,
        noShowAt: state.simTime,
        lateMarkedAt: patient.lateMarkedAt ?? state.simTime,
      },
    },
  };

  const event: QueueEventRecord = {
    id: nextEventId(),
    doctorId,
    patientId,
    eventType: "PATIENT_MARKED_NO_SHOW",
    description: `${patient.patientName} (${tokenLabel(patient)}) marked no-show.`,
    actor: operator,
    previousStatus: patient.status,
    newStatus: STATUSES.NO_SHOW,
    previousPosition: patient.queuePosition,
    newPosition: null,
    reason: null,
    reasons: ["PATIENT_NO_SHOW"],
    minute: state.simTime,
  };

  const settled = settle(nextState, { patientNoShow: patientId });
  return { state: settled.state, events: [event, ...settled.events] };
}

function handleOverrideStatus(
  state: QueueState,
  {
    patientId,
    newStatus,
    reason,
    operator = "RECEPTIONIST",
  }: { patientId: string; newStatus: string; reason: string; operator?: string },
): QueueReducerResult {
  const { doctorId, patient } = patientContext(state, patientId);
  if (!patient) return { state, events: [] };
  if (!reason || !reason.trim()) return { state, events: [] };

  const nextState: QueueState = {
    ...state,
    patients: {
      ...state.patients,
      [patientId]: {
        ...patient,
        status: newStatus,
        // An overridden patient rejoins at the tail of their segment.
        demotedToTail: true,
        manualOrder: false,
      },
    },
  };

  const event: QueueEventRecord = {
    id: nextEventId(),
    doctorId,
    patientId,
    eventType: "QUEUE_OVERRIDDEN",
    description: `Override: ${patient.patientName} (${tokenLabel(patient)}) changed from ${patient.status} to ${newStatus}. Reason: ${reason.trim()}`,
    actor: operator,
    previousStatus: patient.status,
    newStatus,
    previousPosition: patient.queuePosition,
    newPosition: null,
    reason: reason.trim(),
    reasons: [],
    minute: state.simTime,
  };

  const settled = settle(nextState);
  return { state: settled.state, events: [event, ...settled.events] };
}

function handleOverridePosition(
  state: QueueState,
  {
    patientId,
    newPosition,
    reason,
    operator = "RECEPTIONIST",
  }: { patientId: string; newPosition: number; reason: string; operator?: string },
): QueueReducerResult {
  const { doctorId, patient } = patientContext(state, patientId);
  if (!patient) return { state, events: [] };
  if (!reason || !reason.trim()) return { state, events: [] };

  const order = computeEffectiveOrder(state, doctorId);
  const activeIds = order.map((item) => item.id);

  // Rebuild the order with the patient moved to the requested slot.
  const targetIndex = Math.max(0, Math.min(newPosition - 1, activeIds.length - 1));
  const withoutPatient = activeIds.filter((id) => id !== patientId);
  withoutPatient.splice(targetIndex, 0, patientId);

  const patients = { ...state.patients };
  withoutPatient.forEach((id, index) => {
    // The whole segment becomes explicitly ordered, so the receptionist's
    // arrangement is preserved by later recalculations.
    patients[id] = {
      ...patients[id],
      manualPriority: index,
      manualOrder: true,
      demotedToTail: false,
    };
  });

  const nextState: QueueState = { ...state, patients };

  const event: QueueEventRecord = {
    id: nextEventId(),
    doctorId,
    patientId,
    eventType: "QUEUE_OVERRIDDEN",
    description: `Queue position override: ${patient.patientName} (${tokenLabel(patient)}) moved from position ${patient.queuePosition} to ${targetIndex + 1}. Reason: ${reason.trim()}`,
    actor: operator,
    previousStatus: patient.status,
    newStatus: patient.status,
    previousPosition: patient.queuePosition,
    newPosition: targetIndex + 1,
    reason: reason.trim(),
    reasons: [],
    minute: state.simTime,
  };

  const settled = settle(nextState, { queueReordered: true });
  return { state: settled.state, events: [event, ...settled.events] };
}

function handleSetRemainingOverride(
  state: QueueState,
  { patientId, minutes }: { patientId: string; minutes: number | null },
): QueueReducerResult {
  const { doctorId, patient } = patientContext(state, patientId);
  if (!patient) return { state, events: [] };

  const value = Number.isFinite(minutes as number)
    ? Math.max(0, Math.round(minutes as number))
    : null;

  const nextState: QueueState = {
    ...state,
    patients: {
      ...state.patients,
      [patientId]: { ...patient, remainingOverrideMinutes: value },
    },
  };

  const event: QueueEventRecord = {
    id: nextEventId(),
    doctorId,
    patientId,
    eventType: "REMAINING_OVERRIDE_SET",
    description: `Revised remaining time for ${patient.patientName} set to ${value === null ? "automatic" : `${value} min`}.`,
    actor: "OPERATOR",
    previousStatus: patient.status,
    newStatus: patient.status,
    previousPosition: patient.queuePosition,
    newPosition: null,
    reason: null,
    reasons: ["CURRENT_CONSULTATION_OVERRUN"],
    minute: state.simTime,
  };

  const settled = settle(nextState);
  return { state: settled.state, events: [event, ...settled.events] };
}

function handleDoctorBreak(
  state: QueueState,
  { doctorId, breakStart, breakEnd }: { doctorId: string; breakStart?: number; breakEnd?: number | null },
): QueueReducerResult {
  const doctor = state.doctors[doctorId];
  if (!doctor) return { state, events: [] };

  const nextState: QueueState = {
    ...state,
    doctors: {
      ...state.doctors,
      [doctorId]: {
        ...doctor,
        breakStart: breakStart ?? state.simTime,
        breakEnd: breakEnd ?? null,
      },
    },
  };

  const event: QueueEventRecord = {
    id: nextEventId(),
    doctorId,
    patientId: null,
    eventType: "DOCTOR_BREAK_STARTED",
    description: breakEnd
      ? `${doctor.name} is on a break until ${formatTime12(breakEnd)}.`
      : `${doctor.name} is on a break with an unknown return time.`,
    actor: "OPERATOR",
    previousStatus: null,
    newStatus: null,
    previousPosition: null,
    newPosition: null,
    reason: null,
    reasons: ["DOCTOR_BREAK"],
    minute: state.simTime,
  };

  const settled = settle(nextState, { doctorBreak: true });
  return { state: settled.state, events: [event, ...settled.events] };
}

function handleDoctorUnavailable(
  state: QueueState,
  { doctorId }: { doctorId: string },
): QueueReducerResult {
  const doctor = state.doctors[doctorId];
  if (!doctor) return { state, events: [] };

  const nextState: QueueState = {
    ...state,
    doctors: {
      ...state.doctors,
      [doctorId]: { ...doctor, status: "UNAVAILABLE", breakEnd: null },
    },
  };

  const event: QueueEventRecord = {
    id: nextEventId(),
    doctorId,
    patientId: null,
    eventType: "DOCTOR_UNAVAILABLE",
    description: `${doctor.name} marked unavailable. Return time unknown — estimates are unavailable until restored.`,
    actor: "OPERATOR",
    previousStatus: null,
    newStatus: null,
    previousPosition: null,
    newPosition: null,
    reason: null,
    reasons: ["DOCTOR_UNAVAILABLE", "DOCTOR_RETURN_UNKNOWN"],
    minute: state.simTime,
  };

  const settled = settle(nextState, { doctorUnavailable: true });
  return { state: settled.state, events: [event, ...settled.events] };
}

function handleDoctorAvailable(
  state: QueueState,
  { doctorId }: { doctorId: string },
): QueueReducerResult {
  const doctor = state.doctors[doctorId];
  if (!doctor) return { state, events: [] };

  const nextState: QueueState = {
    ...state,
    doctors: {
      ...state.doctors,
      [doctorId]: {
        ...doctor,
        status: "AVAILABLE",
        breakStart: null,
        breakEnd: null,
      },
    },
  };

  const event: QueueEventRecord = {
    id: nextEventId(),
    doctorId,
    patientId: null,
    eventType: "DOCTOR_AVAILABLE",
    description: `${doctor.name} is available again.`,
    actor: "OPERATOR",
    previousStatus: null,
    newStatus: null,
    previousPosition: null,
    newPosition: null,
    reason: null,
    reasons: [],
    minute: state.simTime,
  };

  const settled = settle(nextState);
  return { state: settled.state, events: [event, ...settled.events] };
}

/**
 * Move the simulated clock forward.
 *
 * The scenarios need a clock they control, and the deadline sweep has to run
 * against it — a patient who has passed their deadline becomes late, and a
 * late patient who has passed the no-show cutoff is struck off.
 *
 * Doctor idle time is accumulated here, while the elapsed interval is still
 * known. Reconstructing it later from the event log would be guesswork.
 */
function handleAdvance(
  state: QueueState,
  { minutes }: { minutes: number },
): QueueReducerResult {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return { state, events: [] };
  }

  const nextTime = state.simTime + minutes;

  const doctors = { ...state.doctors };
  for (const doctorId of Object.keys(doctors)) {
    const doctor = doctors[doctorId];
    if (doctor.status !== "AVAILABLE") continue;

    // A break with an unknown end makes the whole interval unknown, so no idle
    // time is claimed for it.
    const onKnownBreak =
      doctor.breakStart !== null &&
      doctor.breakStart !== undefined &&
      doctor.breakEnd !== null &&
      doctor.breakEnd !== undefined;
    if (doctor.breakStart !== null && doctor.breakStart !== undefined && !onKnownBreak) {
      continue;
    }

    if (hasPatientToConsult(state, doctorId)) continue;
    if (!hasPendingDemand(state, doctorId)) continue;

    // Only the part of the interval that falls inside the doctor's session
    // counts, and a known break is subtracted from it.
    let idle = sessionOverlapMinutes(doctor, state.simTime, minutes);
    if (onKnownBreak) {
      idle -= breakOverlapMinutes(doctor, state.simTime, minutes);
    }
    if (idle <= 0) continue;

    doctors[doctorId] = {
      ...doctor,
      idleMinutes: (doctor.idleMinutes ?? 0) + idle,
    };
  }

  const nextState: QueueState = { ...state, simTime: nextTime, doctors };

  const event: QueueEventRecord = {
    id: nextEventId(),
    doctorId: null,
    patientId: null,
    eventType: "TIME_ADVANCED",
    description: `The clock advanced by ${minutes} min to ${formatTime12(nextTime)}.`,
    actor: "OPERATOR",
    previousStatus: null,
    newStatus: null,
    previousPosition: null,
    newPosition: null,
    reason: null,
    reasons: [],
    minute: nextTime,
  };

  const settled = settle(nextState);
  return { state: settled.state, events: [event, ...settled.events] };
}

/* ------------------------------------------------------------------ */
/* reducer                                                             */
/* ------------------------------------------------------------------ */

export function queueReducer(
  state: QueueState,
  action: QueueAction,
): QueueReducerResult {

  switch (action.type) {
    case "INIT":
      return settle(state);
    case "CHECK_IN":
      return handleCheckIn(state, action);
    case "CALL_NEXT":
      return handleCallNext(state, action);
    case "CALL_PATIENT":
      return handleCallPatient(state, action);
    case "START_CONSULTATION":
      return handleStartConsultation(state, action);
    case "COMPLETE_CONSULTATION":
      return handleCompleteConsultation(state, action);
    case "CANCEL_PATIENT":
      return handleCancel(state, action);
    case "SKIP_PATIENT":
      return handleSkip(state, action);
    case "RESTORE_PATIENT":
      return handleRestore(state, action);
    case "MARK_LATE":
      return handleMarkLate(state, action);
    case "MARK_NO_SHOW":
      return handleMarkNoShow(state, action);
    case "OVERRIDE_STATUS":
      return handleOverrideStatus(state, action);
    case "OVERRIDE_POSITION":
      return handleOverridePosition(state, action);
    case "SET_REMAINING_OVERRIDE":
      return handleSetRemainingOverride(state, action);
    case "SET_DOCTOR_BREAK":
      return handleDoctorBreak(state, action);
    case "SET_DOCTOR_UNAVAILABLE":
      return handleDoctorUnavailable(state, action);
    case "SET_DOCTOR_AVAILABLE":
      return handleDoctorAvailable(state, action);
    case "ADVANCE":
      return handleAdvance(state, action);
    case "UPDATE_SETTINGS":
      return settle({ ...state, settings: { ...state.settings, ...action.settings } });
    default:
      return { state, events: [] };
  }
}

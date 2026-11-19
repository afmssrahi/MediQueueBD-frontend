import { STATUSES, isTerminal } from "../queue/statuses";
import { computeEffectiveOrder } from "../queue/queue-engine";
import type { QueueEstimate, QueuePatient, QueueState } from "../queue/types";
import { average, median } from "./time";

/**
 * estimationEngine — waiting-time estimation.
 *
 * Ported from the queue prototype's `src/engine/estimationEngine.js`.
 *
 * The backward formula `W_P = R + Σ T_i + B` is not what the UI needs. A
 * patient still at home cannot be served before they arrive — and their
 * arrival recommendation is derived from their estimate. That circularity is
 * resolved with a fixed-point solver (≤ 5 passes, converges in ≤ 3).
 */

export const MAX_SOLVER_ITERATIONS = 5;

/**
 * Predicted duration of a consultation.
 *
 * Priority: patient override → doctor history (median/average of last N) →
 * doctor default.
 */
export function predictedDuration(
  state: QueueState,
  doctorId: string,
  patient: QueuePatient | null,
): number {
  if (
    patient?.predictedConsultationMinutes !== null &&
    patient?.predictedConsultationMinutes !== undefined
  ) {
    return patient.predictedConsultationMinutes;
  }

  const doctor = state.doctors[doctorId];
  if (!doctor) return 12;

  const history = doctor.consultationHistory ?? [];
  const window = state.settings.historyWindow ?? 10;
  const recent = history.slice(-window);

  if (recent.length > 0) {
    const value =
      state.settings.durationStrategy === "AVERAGE"
        ? average(recent)
        : median(recent);
    if (value !== null) return Math.round(value);
  }

  return doctor.defaultConsultationDuration;
}

/**
 * Remaining time of the consultation in progress.
 *
 * `R = max(0, P − Elapsed)`. A manual override always wins.
 */
export function remainingConsultationTime(
  state: QueueState,
  doctorId: string,
  patient: QueuePatient | null,
  now: number,
): number {
  if (!patient?.consultationStartedAt) return 0;

  if (
    patient.remainingOverrideMinutes !== null &&
    patient.remainingOverrideMinutes !== undefined
  ) {
    return Math.max(0, patient.remainingOverrideMinutes);
  }

  const predicted = predictedDuration(state, doctorId, patient);
  const elapsed = Math.max(0, now - patient.consultationStartedAt);
  return Math.max(0, predicted - elapsed);
}

/**
 * Apply the doctor's availability constraints to a cursor time.
 *
 * When the doctor is unavailable with an unknown return time we do NOT
 * fabricate a precise estimate.
 */
export function applyAvailability(
  state: QueueState,
  doctorId: string,
  cursor: number,
): { time: number; unavailable: boolean; reasons: string[] } {
  const doctor = state.doctors[doctorId];
  const reasons: string[] = [];
  let time = cursor;
  let unavailable = false;

  if (!doctor) {
    return { time, unavailable: false, reasons };
  }

  if (doctor.status === "UNAVAILABLE") {
    unavailable = true;
    reasons.push("DOCTOR_UNAVAILABLE");
    if (doctor.breakEnd === null || doctor.breakEnd === undefined) {
      reasons.push("DOCTOR_RETURN_UNKNOWN");
    }
  }

  if (doctor.breakStart !== null && doctor.breakStart !== undefined) {
    const breakEnd = doctor.breakEnd;
    if (breakEnd === null || breakEnd === undefined) {
      unavailable = true;
      reasons.push("DOCTOR_BREAK");
      reasons.push("DOCTOR_RETURN_UNKNOWN");
    } else if (cursor < breakEnd) {
      // The doctor is on a break that ends at breakEnd.
      time = Math.max(time, breakEnd);
      reasons.push("DOCTOR_BREAK");
    }
  }

  return { time, unavailable, reasons: [...new Set(reasons)] };
}

/**
 * Forward projection with a fixed-point solver.
 *
 * @returns the per-patient estimates, whether the doctor is unavailable and
 *          how many solver passes were needed.
 */
export function projectQueue(
  state: QueueState,
  doctorId: string,
  now: number,
): {
  estimates: Record<string, QueueEstimate>;
  unavailable: boolean;
  iterations: number;
} {
  const settings = state.settings;
  const order = computeEffectiveOrder(state, doctorId);

  const estimates: Record<string, QueueEstimate> = {};
  for (const patient of order) {
    estimates[patient.id] = {
      estimatedConsultationStart: null,
      estimatedWaitingMinutes: null,
      isProvisional: false,
      estimateReasons: [],
    };
  }

  const currentConsultation = order.find(
    (patient) => patient.status === STATUSES.IN_CONSULTATION,
  );
  const calledPatient = order.find(
    (patient) => patient.status === STATUSES.CALLED,
  );

  // Availability is evaluated once per doctor — it applies to the whole queue.
  const availabilityProbe = applyAvailability(state, doctorId, now);
  if (availabilityProbe.unavailable) {
    const reasons = availabilityProbe.reasons;
    for (const patient of order) {
      estimates[patient.id] = {
        estimatedConsultationStart: null,
        estimatedWaitingMinutes: null,
        isProvisional: true,
        estimateReasons: reasons,
      };
    }
    return { estimates, unavailable: true, iterations: 0 };
  }

  // At-home patients start with "available now" and get pulled later by the
  // solver as their arrival recommendation becomes concrete.
  let availableAt: Record<string, number> = {};
  for (const patient of order) {
    availableAt[patient.id] = now;
  }

  let iterations = 0;
  let previousSignature: string | null = null;
  let startTimes: Record<string, number> = {};
  let reasonsByPatient: Record<string, Set<string>> = {};
  let overrunning = false;

  for (let iteration = 0; iteration < MAX_SOLVER_ITERATIONS; iteration += 1) {
    iterations = iteration + 1;

    let cursor = now;
    reasonsByPatient = {};
    for (const patient of order) reasonsByPatient[patient.id] = new Set();
    overrunning = false;

    // 1. The consultation already in progress occupies the doctor.
    if (currentConsultation) {
      const remaining = remainingConsultationTime(
        state,
        doctorId,
        currentConsultation,
        now,
      );
      const elapsed = Math.max(
        0,
        now - (currentConsultation.consultationStartedAt ?? now),
      );
      const predicted = predictedDuration(state, doctorId, currentConsultation);
      if (
        elapsed > predicted &&
        currentConsultation.remainingOverrideMinutes === null
      ) {
        overrunning = true;
        reasonsByPatient[currentConsultation.id].add(
          "CURRENT_CONSULTATION_OVERRUN",
        );
      } else {
        reasonsByPatient[currentConsultation.id].add(
          "CURRENT_CONSULTATION_RUNNING",
        );
      }
      cursor += remaining;
    }

    // 2. A called patient who has not started yet occupies the doctor next.
    if (calledPatient && !currentConsultation) {
      cursor += predictedDuration(state, doctorId, calledPatient);
    }

    // 3. Availability (a break with a known end shifts the cursor forward).
    const availability = applyAvailability(state, doctorId, cursor);
    if (availability.reasons.includes("DOCTOR_BREAK")) {
      for (const patient of order) {
        reasonsByPatient[patient.id].add("DOCTOR_BREAK");
      }
    }
    cursor = availability.time;

    // 4. Walk the queue and assign start times.
    const nextStartTimes: Record<string, number> = {};
    for (const patient of order) {
      if (patient.status === STATUSES.IN_CONSULTATION) {
        nextStartTimes[patient.id] = Math.max(
          now,
          patient.consultationStartedAt ?? now,
        );
        continue;
      }
      if (patient.status === STATUSES.CALLED) {
        nextStartTimes[patient.id] = cursor;
        cursor += predictedDuration(state, doctorId, patient);
        continue;
      }

      const duration = predictedDuration(state, doctorId, patient);
      const atHome = patient.status !== STATUSES.WAITING;

      if (atHome) {
        // They can only be served once they have arrived.
        const start = Math.max(cursor, availableAt[patient.id] ?? now);
        nextStartTimes[patient.id] = start;
        cursor = start + duration;
        reasonsByPatient[patient.id].add("AT_HOME_ARRIVAL_ASSUMED");
      } else {
        nextStartTimes[patient.id] = cursor;
        cursor += duration;
      }
    }

    // 5. Derive the arrival assumption for the next pass.
    const nextAvailableAt: Record<string, number> = {};
    for (const patient of order) {
      if (
        patient.status === STATUSES.WAITING ||
        patient.status === STATUSES.CALLED ||
        patient.status === STATUSES.IN_CONSULTATION
      ) {
        nextAvailableAt[patient.id] = now;
        continue;
      }
      nextAvailableAt[patient.id] =
        nextStartTimes[patient.id] - settings.arrivalBufferMinutes;
    }

    const signature = JSON.stringify(
      order.map((patient) => [
        patient.id,
        nextStartTimes[patient.id],
        nextAvailableAt[patient.id],
      ]),
    );

    const converged = signature === previousSignature;
    startTimes = nextStartTimes;
    availableAt = nextAvailableAt;
    previousSignature = signature;

    if (converged) break;
  }

  // Reason propagation: a patient is provisional when an at-home patient
  // ahead of them is assumed to arrive, or when the running consultation
  // overruns.
  for (let index = 0; index < order.length; index += 1) {
    const patient = order[index];
    const ownReasons = reasonsByPatient[patient.id] ?? new Set<string>();
    let provisional = false;

    const isCheckedIn =
      patient.status === STATUSES.WAITING ||
      patient.status === STATUSES.CALLED;

    if (!isCheckedIn && patient.status !== STATUSES.IN_CONSULTATION) {
      provisional = true;
    }

    // Any at-home patient ahead of them makes the estimate provisional.
    for (let ahead = 0; ahead < index; ahead += 1) {
      const aheadPatient = order[ahead];
      const aheadAtHome =
        aheadPatient.status !== STATUSES.WAITING &&
        aheadPatient.status !== STATUSES.CALLED &&
        aheadPatient.status !== STATUSES.IN_CONSULTATION;
      if (aheadAtHome) {
        provisional = true;
        ownReasons.add("AT_HOME_ARRIVAL_ASSUMED");
      }
    }

    if (overrunning && index > 0) {
      provisional = true;
      ownReasons.add("CURRENT_CONSULTATION_OVERRUN");
    }

    const start = startTimes[patient.id];
    estimates[patient.id] = {
      estimatedConsultationStart: start,
      estimatedWaitingMinutes: Math.max(0, start - now),
      isProvisional: provisional,
      estimateReasons: [...ownReasons],
    };
  }

  return { estimates, unavailable: false, iterations };
}

/** Context flags that explain why an estimate changed. */
export interface EstimateChangeContext {
  patientCheckedIn?: string;
  patientLate?: string;
  patientNoShow?: string;
  patientCancelled?: string;
  patientSkipped?: string;
  patientCompleted?: string;
  queueReordered?: boolean;
  latePenaltyApplied?: boolean;
  doctorBreak?: boolean;
  doctorUnavailable?: boolean;
}

/**
 * Explain what changed between two estimate sets for a patient.
 */
export function explainEstimateChange(
  previous: QueueEstimate | undefined,
  next: QueueEstimate | undefined,
  context: EstimateChangeContext = {},
): string[] {
  const reasons = new Set<string>(next?.estimateReasons ?? []);

  if (context.patientCheckedIn) reasons.add("PATIENT_CHECKED_IN");
  if (context.patientLate) reasons.add("PATIENT_ARRIVED_LATE");
  if (context.patientNoShow) reasons.add("PATIENT_NO_SHOW");
  if (context.patientCancelled) reasons.add("PATIENT_CANCELLED");
  if (context.patientSkipped) reasons.add("PATIENT_SKIPPED");
  if (context.patientCompleted) reasons.add("PATIENT_COMPLETED");
  if (context.queueReordered) reasons.add("QUEUE_REORDERED");
  if (context.latePenaltyApplied) reasons.add("LATE_PENALTY_APPLIED");
  if (context.doctorBreak) reasons.add("DOCTOR_BREAK");
  if (context.doctorUnavailable) reasons.add("DOCTOR_UNAVAILABLE");

  const previousStart = previous?.estimatedConsultationStart ?? null;
  const nextStart = next?.estimatedConsultationStart ?? null;
  if (previousStart !== nextStart) {
    reasons.add("ESTIMATE_SHIFTED");
  }

  return [...reasons];
}

/** Patients whose estimate shifted since the previous calculation. */
export function shiftedPatients(
  previousEstimates: Record<string, QueueEstimate>,
  nextEstimates: Record<string, QueueEstimate>,
): string[] {
  const shifted: string[] = [];

  for (const [patientId, estimate] of Object.entries(nextEstimates ?? {})) {
    const before = previousEstimates?.[patientId];
    if (!before) continue;
    if (before.estimatedConsultationStart !== estimate.estimatedConsultationStart) {
      shifted.push(patientId);
    }
  }

  return shifted;
}

/** Active (non-terminal) patients of a doctor, oldest appointment first. */
export function activePatients(
  state: QueueState,
  doctorId: string,
): QueuePatient[] {
  return Object.values(state.patients).filter(
    (patient) => patient.doctorId === doctorId && !isTerminal(patient.status),
  );
}

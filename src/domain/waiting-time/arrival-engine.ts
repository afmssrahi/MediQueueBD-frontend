import type { QueuePatient, QueueSettings, QueueState } from "../queue/types";

/**
 * arrivalEngine — arrival/departure recommendations.
 *
 * Ported from the queue prototype's `src/engine/arrivalEngine.js`.
 *
 *   A = E - B      (recommended hospital arrival)
 *   D = A - T      (recommended departure)
 *
 * Travel duration is never fabricated. When it is unknown the recommendation
 * simply omits the departure time.
 *
 * This module deliberately has **no dependency on estimationEngine** so the
 * coupled fixed-point solver lives in one direction only.
 */

/** True when a travel estimate exists for this patient. */
export function hasTravelEstimate(
  patient: Pick<QueuePatient, "estimatedTravelMinutes">,
): boolean {
  return (
    patient.estimatedTravelMinutes !== null &&
    patient.estimatedTravelMinutes !== undefined &&
    Number.isFinite(patient.estimatedTravelMinutes)
  );
}

export interface ArrivalPlan {
  recommendedArrivalTime: number | null;
  arrivalDeadline: number | null;
  recommendedDepartureTime: number | null;
  commitment: number | null;
  travelTimeAvailable: boolean;
}

/**
 * Build the arrival plan for one patient.
 *
 * Three distinct times come out of this:
 *
 *  - `recommendedArrivalTime` — the target slot. `estStart - B`, but never in
 *    the past: nobody can arrive before now.
 *  - `recommendedDepartureTime` — when to leave. `A - T`, but never in the
 *    past either: if the moment to leave has gone, the advice is "leave now".
 *  - `commitment` — the deadline the patient is held to. The target slot,
 *    extended by the travel time only when the patient is asked so late that
 *    they cannot physically make it.
 */
export function computeArrivalPlan(
  estimatedStart: number | null | undefined,
  bufferMinutes: number,
  travelMinutes: number | null | undefined,
  now = 0,
): ArrivalPlan {
  if (estimatedStart === null || estimatedStart === undefined) {
    return {
      recommendedArrivalTime: null,
      arrivalDeadline: null,
      recommendedDepartureTime: null,
      commitment: null,
      travelTimeAvailable:
        travelMinutes !== null &&
        travelMinutes !== undefined &&
        Number.isFinite(travelMinutes),
    };
  }

  const travelTimeAvailable =
    travelMinutes !== null &&
    travelMinutes !== undefined &&
    Number.isFinite(travelMinutes);

  // The target slot, never in the past.
  const recommendedArrivalTime = Math.max(now, estimatedStart - bufferMinutes);

  // The deadline: the target slot, or "leave now and get here as fast as you
  // can" when the travel time makes the slot unreachable.
  const commitment = travelTimeAvailable
    ? Math.max(recommendedArrivalTime, now + travelMinutes)
    : recommendedArrivalTime;

  return {
    recommendedArrivalTime,
    arrivalDeadline: commitment,
    recommendedDepartureTime: travelTimeAvailable
      ? Math.max(now, recommendedArrivalTime - travelMinutes)
      : null,
    commitment,
    travelTimeAvailable,
  };
}

/**
 * Apply arrival recommendations to a patients map.
 *
 * Two distinct times are kept apart:
 *
 *  - `recommendedArrivalTime` — the **live advice**. It follows the estimate
 *    and keeps moving as the schedule changes.
 *  - `arrivalDeadline` — the **commitment**. It is locked the first time the
 *    patient receives an estimate and then stands still.
 *
 * The separation matters. If the deadline followed the estimate, a slow
 * consultation or a late penalty would push the deadline later and later, and
 * the patient could never fall behind — the lateness rule would never fire.
 */
export function applyArrivalRecommendations(
  patients: QueueState["patients"],
  estimates: Record<
    string,
    {
      estimatedConsultationStart: number | null;
      estimatedWaitingMinutes: number | null;
      isProvisional: boolean;
      estimateReasons: string[];
    }
  >,
  settings: QueueSettings,
  now = 0,
): QueueState["patients"] {
  const next = { ...patients };

  for (const [patientId, estimate] of Object.entries(estimates)) {
    const patient = next[patientId];
    if (!patient) continue;

    const plan = computeArrivalPlan(
      estimate.estimatedConsultationStart,
      settings.arrivalBufferMinutes,
      patient.estimatedTravelMinutes,
      now,
    );

    // The commitment is the deadline the patient is held to. It is locked
    // when the patient is actually asked to arrive and it stands still from
    // then on. Until then there is no commitment, so no deadline — an early
    // estimate must not create one, because the slot it is based on is not a
    // promise the patient has been given yet.
    const hasCommitment =
      patient.arrivalRequestSentAt !== null &&
      patient.arrivalRequestSentAt !== undefined;
    const lockedArrivalDeadline = hasCommitment
      ? (patient.lockedArrivalDeadline ?? plan.commitment)
      : null;

    next[patientId] = {
      ...patient,
      estimatedConsultationStart: estimate.estimatedConsultationStart,
      estimatedWaitingMinutes: estimate.estimatedWaitingMinutes,
      recommendedArrivalTime: plan.recommendedArrivalTime,
      arrivalDeadline: lockedArrivalDeadline,
      lockedArrivalDeadline,
      recommendedDepartureTime: plan.recommendedDepartureTime,
      isProvisional: estimate.isProvisional,
      estimateReasons: estimate.estimateReasons,
    };
  }

  return next;
}

/**
 * Patients whose recommended arrival time has already passed — they should
 * be heading to the hospital now, or are late.
 */
export function patientsNeedingArrival(
  patients: QueueState["patients"],
  now: number,
): QueuePatient[] {
  return Object.values(patients).filter(
    (patient) =>
      patient.recommendedArrivalTime !== null &&
      patient.recommendedArrivalTime !== undefined &&
      patient.recommendedArrivalTime <= now &&
      !["COMPLETED", "CANCELLED", "NO_SHOW", "SKIPPED"].includes(patient.status),
  );
}

import { STATUSES, isTerminal } from "./statuses";
import type { QueueDoctor, QueuePatient, QueueState } from "./types";
import { MINUTES_PER_DAY } from "../waiting-time/time";

/**
 * queueEngine — doctor-scoped queue mechanics.
 *
 * Ported from the queue prototype's `src/engine/queueEngine.js` with its
 * behaviour unchanged. Pure functions only: no React, no DOM, no I/O.
 *
 * Two-layer model:
 *   - `tokenNumber`  permanent appointment identifier. NEVER changes.
 *   - `queuePosition` 1-based index in the *effective order*, recomputed after
 *     every event.
 */

/** Statuses that live in the at-home segment. */
const AT_HOME_STATUSES = [
  STATUSES.BOOKED,
  STATUSES.ARRIVAL_REQUESTED,
  STATUSES.WAITING_FOR_ARRIVAL,
];

export function patientsOfDoctor(
  state: QueueState,
  doctorId: string,
): QueuePatient[] {
  return Object.values(state.patients).filter(
    (patient) => patient.doctorId === doctorId,
  );
}

export function activePatientsOfDoctor(
  state: QueueState,
  doctorId: string,
): QueuePatient[] {
  return patientsOfDoctor(state, doctorId).filter(
    (patient) => !isTerminal(patient.status),
  );
}

export function patientById(
  state: QueueState,
  patientId: string,
): QueuePatient | null {
  return state.patients[patientId] ?? null;
}

/** Patients physically inside the hospital and waiting to be called. */
export function waitingPatientsOfDoctor(
  state: QueueState,
  doctorId: string,
): QueuePatient[] {
  return activePatientsOfDoctor(state, doctorId).filter(
    (patient) => patient.status === STATUSES.WAITING,
  );
}

function compareWaiting(a: QueuePatient, b: QueuePatient): number {
  if (a.checkedInAt !== b.checkedInAt) {
    return (a.checkedInAt ?? 0) - (b.checkedInAt ?? 0);
  }
  if (a.checkInSequence !== b.checkInSequence) {
    return (a.checkInSequence ?? 0) - (b.checkInSequence ?? 0);
  }
  return a.tokenNumber - b.tokenNumber;
}

/**
 * At-home ordering.
 *
 *  - TOKEN      → by permanent token number.
 *  - READY_TIME → by the recommended arrival time; unready patients last.
 */
function compareAtHome(
  a: QueuePatient,
  b: QueuePatient,
  rule: "TOKEN" | "READY_TIME",
): number {
  if (rule === "READY_TIME") {
    const readyA =
      a.recommendedArrivalTime ?? a.estimatedConsultationStart ?? Infinity;
    const readyB =
      b.recommendedArrivalTime ?? b.estimatedConsultationStart ?? Infinity;
    if (readyA !== readyB) return readyA - readyB;
  }
  return a.tokenNumber - b.tokenNumber;
}

/**
 * Order one segment.
 *
 * A segment is either **manually ordered** (a receptionist used the position
 * override, which assigns an explicit rank to every member of the segment)
 * or **naturally ordered** (check-in time, then token).
 *
 * In a naturally ordered segment a demoted patient (late-arrival penalty)
 * sits at the tail; the rest keep their natural order.
 */
function applyManual(
  list: QueuePatient[],
  comparator: (a: QueuePatient, b: QueuePatient) => number,
): QueuePatient[] {
  const manuallyOrdered = list.some((patient) => patient.manualOrder === true);

  if (manuallyOrdered) {
    return [...list].sort(
      (a, b) =>
        (a.manualPriority ?? 0) - (b.manualPriority ?? 0) || comparator(a, b),
    );
  }

  return [...list].sort((a, b) => {
    if (Boolean(a.demotedToTail) !== Boolean(b.demotedToTail)) {
      return a.demotedToTail ? 1 : -1;
    }
    return comparator(a, b);
  });
}

/**
 * The effective serving order for one doctor.
 *
 *   1. the patient currently in consultation
 *   2. patients who have been called (next up)
 *   3. patients checked in at the hospital (physical queue)
 *   4. patients who are late  ← demoted to the tail of the checked-in segment
 *   5. patients still at home
 *
 * The current consultation is never reordered by anything below it.
 */
export function computeEffectiveOrder(
  state: QueueState,
  doctorId: string,
): QueuePatient[] {
  const settings = state.settings;
  const active = activePatientsOfDoctor(state, doctorId);

  const current = active.filter(
    (patient) => patient.status === STATUSES.IN_CONSULTATION,
  );
  const called = active.filter((patient) => patient.status === STATUSES.CALLED);
  const waiting = active.filter((patient) => patient.status === STATUSES.WAITING);
  const late = active.filter((patient) => patient.status === STATUSES.LATE);
  const atHome = active.filter((patient) =>
    AT_HOME_STATUSES.includes(patient.status as never),
  );

  const byToken = (a: QueuePatient, b: QueuePatient) => a.tokenNumber - b.tokenNumber;
  const atHomeComparator = (a: QueuePatient, b: QueuePatient) =>
    compareAtHome(a, b, settings.atHomeOrderingRule);

  // KEEP_POSITION means a late patient keeps their natural at-home slot;
  // the default policy demotes them to the tail of the checked-in segment.
  const keepPosition = settings.latePenaltyPolicy === "KEEP_POSITION";

  const homeSegment = keepPosition
    ? applyManual([...atHome, ...late], atHomeComparator)
    : applyManual(atHome, atHomeComparator);

  // Late patients sit directly behind the checked-in patients.
  const lateSegment = keepPosition ? [] : applyManual(late, byToken);

  return [
    ...current,
    ...applyManual(called, byToken),
    ...applyManual(waiting, compareWaiting),
    ...lateSegment,
    ...homeSegment,
  ];
}

/** Map of patientId → 1-based queue position for the given effective order. */
export function positionsFromOrder(
  order: QueuePatient[],
): Record<string, number> {
  const positions: Record<string, number> = {};
  order.forEach((patient, index) => {
    positions[patient.id] = index + 1;
  });
  return positions;
}

/** Recompute queue positions for every doctor. Returns a new patients map. */
export function recomputePositions(state: QueueState): QueueState["patients"] {
  const patients = { ...state.patients };

  for (const doctorId of Object.keys(state.doctors)) {
    const order = computeEffectiveOrder(state, doctorId);
    order.forEach((patient, index) => {
      const position = index + 1;
      if (patients[patient.id].queuePosition !== position) {
        patients[patient.id] = { ...patients[patient.id], queuePosition: position };
      }
    });
  }

  return patients;
}

/**
 * The next patient who may be called: only patients who have checked in are
 * eligible.
 */
export function nextEligiblePatient(
  state: QueueState,
  doctorId: string,
): QueuePatient | null {
  const order = computeEffectiveOrder(state, doctorId);
  return order.find((patient) => patient.status === STATUSES.WAITING) ?? null;
}

/** True when the doctor already has an active consultation. */
export function hasActiveConsultation(
  state: QueueState,
  doctorId: string): boolean {
  const doctor = state.doctors[doctorId];
  if (!doctor) return false;
  const queue = state.queues[doctor.activeQueueId];
  if (!queue?.currentConsultationPatientId) return false;
  const patient = state.patients[queue.currentConsultationPatientId];
  return patient?.status === STATUSES.IN_CONSULTATION;
}

/**
 * Apply the configured late penalty to a patient's place in the queue.
 *
 * The token number is never touched.
 */
export function applyLatePenalty(
  patient: QueuePatient,
  policy: QueueState["settings"]["latePenaltyPolicy"],
): { status: string; note: string; demoteToTail?: boolean } {
  if (policy === "MARK_NO_SHOW") {
    return {
      status: STATUSES.NO_SHOW,
      note: "Marked as no-show immediately by policy.",
    };
  }
  if (policy === "KEEP_POSITION") {
    return { status: STATUSES.LATE, note: "Queue position retained by policy." };
  }
  return {
    status: STATUSES.LATE,
    note: "Moved behind checked-in patients.",
    demoteToTail: true,
  };
}

/**
 * True when the doctor still has someone they could see — either waiting in the
 * hospital or called to the consultation room.
 */
export function hasPatientToConsult(
  state: QueueState,
  doctorId: string,
): boolean {
  return Object.values(state.patients).some(
    (patient) =>
      patient.doctorId === doctorId &&
      (patient.status === STATUSES.WAITING ||
        patient.status === STATUSES.CALLED ||
        patient.status === STATUSES.IN_CONSULTATION),
  );
}

/**
 * True when the doctor still has demand they are waiting for — an appointment
 * that has not been completed, cancelled, skipped or struck off as a no-show.
 *
 * Without this check the tail of the day would be counted as idle time even
 * though nobody was ever going to arrive, which drowns out the real signal:
 * the doctor ran out of ready patients while the queue still had work.
 */
export function hasPendingDemand(
  state: QueueState,
  doctorId: string,
): boolean {
  return Object.values(state.patients).some(
    (patient) =>
      patient.doctorId === doctorId && !isTerminal(patient.status),
  );
}

/**
 * Minutes of a simulated interval that fall inside the doctor's session.
 *
 * The session repeats every day and the simulated clock can cross midnight, so
 * the interval is measured on an unwrapped axis and compared against the
 * session window of the current day and the next one.
 */
export function sessionOverlapMinutes(
  doctor: QueueDoctor,
  start: number,
  minutes: number,
): number {
  const sessionStart = doctor.sessionStart ?? 0;
  const sessionEnd = doctor.sessionEnd ?? MINUTES_PER_DAY;
  if (sessionEnd <= sessionStart) return 0;

  const end = start + minutes;
  let overlap = 0;

  for (const dayOffset of [0, MINUTES_PER_DAY]) {
    const windowStart = sessionStart + dayOffset;
    const windowEnd = sessionEnd + dayOffset;
    overlap += Math.max(
      0,
      Math.min(end, windowEnd) - Math.max(start, windowStart),
    );
  }

  return overlap;
}

/**
 * Minutes of a simulated interval that fall inside a known break.
 */
export function breakOverlapMinutes(
  doctor: QueueDoctor,
  start: number,
  minutes: number,
): number {
  if (doctor.breakStart === null || doctor.breakEnd === null) return 0;

  const end = start + minutes;
  return Math.max(
    0,
    Math.min(end, doctor.breakEnd) - Math.max(start, doctor.breakStart),
  );
}

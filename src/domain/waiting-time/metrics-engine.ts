import { STATUSES, isTerminal } from "../queue/statuses";
import type { QueueState } from "../queue/types";

/**
 * metricsEngine — evaluation metrics.
 *
 * Ported from the queue prototype's `src/engine/metricsEngine.js`.
 *
 * Every metric is scoped to one doctor when `doctorId` is given, so two
 * queues never contaminate each other's numbers.
 */

function percentage(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return (numerator / denominator) * 100;
}

export interface QueueMetrics {
  doctorId: string | null;
  totalAppointments: number;
  expectedAppointments: number;
  completedCount: number;
  cancelledCount: number;
  lateCount: number;
  noShowCount: number;
  averagePhysicalWaitingMinutes: number | null;
  maximumPhysicalWaitingMinutes: number | null;
  doctorIdleMinutes: number | null;
  patientLatenessRate: number | null;
  noShowRate: number | null;
  estimateErrorMinutes: number | null;
  arrivalComplianceRate: number | null;
  checkedInCount: number;
  committedArrivalCount: number;
  waitingRoomOccupancy: number;
}

/**
 * Compute the full metric set for a doctor, or for the whole hospital when
 * `doctorId` is omitted.
 */
export function computeMetrics(
  state: QueueState,
  doctorId: string | null = null,
): QueueMetrics {
  const patients = Object.values(state.patients).filter((patient) =>
    doctorId ? patient.doctorId === doctorId : true,
  );

  const physicalWaits = patients
    .filter(
      (patient) =>
        patient.checkedInAt !== null &&
        patient.consultationStartedAt !== null,
    )
    .map(
      (patient) =>
        (patient.consultationStartedAt as number) -
        (patient.checkedInAt as number),
    );

  const averagePhysicalWait =
    physicalWaits.length > 0
      ? physicalWaits.reduce((sum, value) => sum + value, 0) /
        physicalWaits.length
      : null;
  const maxPhysicalWait =
    physicalWaits.length > 0 ? Math.max(...physicalWaits) : null;

  const lateCount = patients.filter(
    (patient) =>
      patient.lateMarkedAt !== null && patient.lateMarkedAt !== undefined,
  ).length;
  const noShowCount = patients.filter(
    (patient) => patient.status === STATUSES.NO_SHOW,
  ).length;
  const cancelledCount = patients.filter(
    (patient) => patient.status === STATUSES.CANCELLED,
  ).length;

  // Denominator: appointments that were expected to arrive (not cancelled).
  const expectedCount = patients.filter(
    (patient) => patient.status !== STATUSES.CANCELLED,
  ).length;

  // Estimate error: actual start minus the estimate captured when the
  // patient was called.
  const estimateErrors = patients
    .filter(
      (patient) =>
        patient.estimateAtCall !== null &&
        patient.consultationStartedAt !== null,
    )
    .map(
      (patient) =>
        (patient.consultationStartedAt as number) -
        (patient.estimateAtCall as number),
    );

  const averageEstimateError =
    estimateErrors.length > 0
      ? estimateErrors.reduce((sum, value) => sum + value, 0) /
        estimateErrors.length
      : null;

  // Arrival compliance: checked in by their deadline.
  //
  // Only patients who were actually given a commitment count. A patient who
  // never received a deadline cannot be late and must not dilute the rate.
  const committedArrivals = patients.filter(
    (patient) =>
      patient.checkedInAt !== null && patient.arrivalDeadline !== null,
  );
  const onTimeArrivals = committedArrivals.filter(
    (patient) =>
      (patient.checkedInAt as number) <= (patient.arrivalDeadline as number),
  ).length;

  return {
    doctorId,
    totalAppointments: patients.length,
    expectedAppointments: expectedCount,
    completedCount: patients.filter(
      (patient) => patient.status === STATUSES.COMPLETED,
    ).length,
    cancelledCount,
    lateCount,
    noShowCount,
    averagePhysicalWaitingMinutes: averagePhysicalWait,
    maximumPhysicalWaitingMinutes: maxPhysicalWait,
    doctorIdleMinutes: computeDoctorIdleMinutes(state, doctorId),
    patientLatenessRate: percentage(lateCount, expectedCount),
    noShowRate: percentage(noShowCount, expectedCount),
    estimateErrorMinutes: averageEstimateError,
    arrivalComplianceRate: percentage(onTimeArrivals, committedArrivals.length),
    checkedInCount: patients.filter(
      (patient) => patient.checkedInAt !== null,
    ).length,
    committedArrivalCount: committedArrivals.length,
    waitingRoomOccupancy: patients.filter(
      (patient) => patient.status === STATUSES.WAITING,
    ).length,
  };
}

/**
 * Doctor idle time: minutes during which the doctor was available, not on a
 * break, and had no eligible patient waiting.
 *
 * The reducer accumulates this while the clock advances — at that moment the
 * elapsed interval is still known.
 */
export function computeDoctorIdleMinutes(
  state: QueueState,
  doctorId: string | null,
): number | null {
  if (doctorId) {
    const doctor = state.doctors[doctorId];
    if (!doctor) return null;
    return doctor.idleMinutes ?? 0;
  }

  const doctors = Object.values(state.doctors);
  if (doctors.length === 0) return null;
  return doctors.reduce((sum, doctor) => sum + (doctor.idleMinutes ?? 0), 0);
}

/**
 * Waiting-room occupancy over time.
 *
 * The series is rebuilt by replaying the event log: each event that carries a
 * status transition moves one patient in or out of the waiting room.
 */
export function occupancySeries(
  events: { patientId: string | null; previousStatus: string | null; newStatus: string | null; minute: number }[],
  startOccupancy = 0,
): { time: number; occupancy: number }[] {
  const points: { time: number; occupancy: number }[] = [];
  let occupancy = startOccupancy;

  const ordered = [...events]
    .filter((event) => event.minute !== null)
    .sort((a, b) => a.minute - b.minute);

  for (const event of ordered) {
    if (!event.patientId) continue;
    if (event.previousStatus === STATUSES.WAITING) occupancy -= 1;
    if (event.newStatus === STATUSES.WAITING) occupancy += 1;
    if (occupancy < 0) occupancy = 0;
    points.push({ time: event.minute, occupancy });
  }

  return points;
}

/** Total count of active (non-terminal) appointments. */
export function activeAppointmentCount(state: QueueState): number {
  return Object.values(state.patients).filter(
    (patient) => !isTerminal(patient.status),
  ).length;
}

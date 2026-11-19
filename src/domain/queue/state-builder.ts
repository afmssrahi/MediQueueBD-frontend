import type { Appointment, Doctor } from "@/types";
import type {
  Queue,
  QueueDoctor,
  QueuePatient,
  QueueState,
} from "./types";
import { STATUSES } from "./statuses";

/**
 * Build the reducer's state shape from the demo database.
 *
 * This is the bridge between the flat demo tables and the domain engines. It
 * lives in `src/domain/` because it is pure — the mock transport calls it.
 */

/** The appointments that belong to a queue on a given date. */
export function appointmentsForQueue(
  appointments: Appointment[],
  doctorId: string,
  date: string,
): Appointment[] {
  return appointments
    .filter(
      (item) => item.doctorId === doctorId && item.date === date,
    )
    .sort((a, b) => a.startMinute - b.startMinute);
}

/** Map an appointment status onto the queue domain's vocabulary. */
export function toQueueStatus(appointment: Appointment): string {
  switch (appointment.status) {
    case "BOOKED":
      return STATUSES.BOOKED;
    case "CONFIRMED":
      return STATUSES.BOOKED;
    case "CHECKED_IN":
      return STATUSES.WAITING;
    case "WAITING":
      return STATUSES.WAITING;
    case "CALLED":
      return STATUSES.CALLED;
    case "IN_CONSULTATION":
      return STATUSES.IN_CONSULTATION;
    case "COMPLETED":
      return STATUSES.COMPLETED;
    case "CANCELLED":
      return STATUSES.CANCELLED;
    case "NO_SHOW":
      return STATUSES.NO_SHOW;
    case "SKIPPED":
      return STATUSES.SKIPPED;
    case "LATE":
      return STATUSES.LATE;
    default:
      return STATUSES.BOOKED;
  }
}

/** Build one queue patient from an appointment. */
export function toQueuePatient(appointment: Appointment): QueuePatient {
  return {
    id: appointment.id,
    patientUserId: appointment.patientId,
    doctorId: appointment.doctorId,
    tokenNumber: appointment.tokenNumber,
    queuePosition: null,
    patientName: appointment.patientName,
    status: toQueueStatus(appointment),
    checkedInAt: null,
    checkInSequence: null,
    consultationStartedAt: null,
    consultationCompletedAt: null,
    predictedConsultationMinutes: null,
    remainingOverrideMinutes: null,
    estimatedTravelMinutes: null,
    estimatedConsultationStart: null,
    estimatedWaitingMinutes: null,
    recommendedArrivalTime: null,
    recommendedDepartureTime: null,
    arrivalDeadline: null,
    lockedArrivalDeadline: null,
    arrivalRequestSentAt: null,
    lateMarkedAt: null,
    noShowAt: null,
    isProvisional: false,
    estimateReasons: [],
    manualPriority: null,
    manualOrder: false,
    demotedToTail: false,
    estimateAtCall: null,
  };
}

/** Build the queue doctor from a doctor record. */
export function toQueueDoctor(doctor: Doctor): QueueDoctor {
  return {
    id: doctor.id,
    name: doctor.name,
    speciality: doctor.speciality,
    activeQueueId: `Q${doctor.id.slice(1)}`,
    sessionStart: doctor.sessionStart,
    sessionEnd: doctor.sessionEnd,
    breakStart: null,
    breakEnd: null,
    status: "AVAILABLE",
    defaultConsultationDuration: doctor.defaultConsultationDuration,
    consultationHistory: [...doctor.consultationHistory],
    idleMinutes: 0,
  };
}

export interface BuildQueueStateInput {
  doctors: Doctor[];
  appointments: Appointment[];
  /** The date the queue runs on. */
  date: string;
  /** The current time, in minutes since midnight. */
  simTime: number;
  settings: QueueState["settings"];
  /** Patients who have already checked in, keyed by appointment id. */
  checkedIn?: Record<string, number>;
  /** Patients who are already in consultation, keyed by appointment id. */
  inConsultation?: Record<string, number>;
  /** Patients who have been asked to arrive, keyed by appointment id. */
  arrivalRequested?: Record<string, number>;
  /** Committed arrival deadlines, keyed by appointment id. */
  deadlines?: Record<string, number>;
  /** Travel times in minutes, keyed by appointment id. */
  travelMinutes?: Record<string, number>;
}

/** Build the full queue state for a set of doctors. */
export function buildQueueState(input: BuildQueueStateInput): QueueState {
  const doctors: Record<string, QueueDoctor> = {};
  const queues: Record<string, Queue> = {};
  const patients: Record<string, QueuePatient> = {};

  let checkInCounter = 0;

  for (const doctor of input.doctors) {
    const queueDoctor = toQueueDoctor(doctor);
    doctors[doctor.id] = queueDoctor;

    const doctorAppointments = appointmentsForQueue(
      input.appointments,
      doctor.id,
      input.date,
    );

    queues[queueDoctor.activeQueueId] = {
      id: queueDoctor.activeQueueId,
      doctorId: doctor.id,
      currentConsultationPatientId: null,
      patientIds: doctorAppointments.map((item) => item.id),
    };

    for (const appointment of doctorAppointments) {
      const patient = toQueuePatient(appointment);

      const checkedIn = input.checkedIn?.[appointment.id];
      if (checkedIn !== undefined) {
        patient.checkedInAt = checkedIn;
        checkInCounter += 1;
        patient.checkInSequence = checkInCounter;
      }

      const inConsultation = input.inConsultation?.[appointment.id];
      if (inConsultation !== undefined) {
        patient.status = STATUSES.IN_CONSULTATION;
        patient.consultationStartedAt = inConsultation;
        const queue = queues[queueDoctor.activeQueueId];
        queue.currentConsultationPatientId = appointment.id;
      }

      const arrivalRequested = input.arrivalRequested?.[appointment.id];
      if (arrivalRequested !== undefined) {
        patient.arrivalRequestSentAt = arrivalRequested;
        if (patient.status === STATUSES.BOOKED) {
          patient.status = STATUSES.ARRIVAL_REQUESTED;
        }
      }

      const deadline = input.deadlines?.[appointment.id];
      if (deadline !== undefined) {
        patient.arrivalDeadline = deadline;
        patient.lockedArrivalDeadline = deadline;
      }

      const travel = input.travelMinutes?.[appointment.id];
      if (travel !== undefined) {
        patient.estimatedTravelMinutes = travel;
      }

      patients[appointment.id] = patient;
    }
  }

  return {
    simTime: input.simTime,
    doctors,
    queues,
    patients,
    settings: input.settings,
    checkInCounter,
  };
}

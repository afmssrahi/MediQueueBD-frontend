import type { LatePenaltyPolicy } from "./statuses";

/**
 * The queue domain types.
 *
 * These are the shapes the engines operate on. They are deliberately close
 * to the queue prototype's state shape so the same rules port across.
 */

export interface QueuePatient {
  /** The appointment id — the key the reducer addresses patients by. */
  id: string;
  /** The patient's user id, so a patient can recognise their own entry. */
  patientUserId: string;
  doctorId: string;
  tokenNumber: number;
  queuePosition: number | null;
  patientName: string;
  status: string;
  checkedInAt: number | null;
  checkInSequence: number | null;
  consultationStartedAt: number | null;
  consultationCompletedAt: number | null;
  predictedConsultationMinutes: number | null;
  remainingOverrideMinutes: number | null;
  estimatedTravelMinutes: number | null;
  estimatedConsultationStart: number | null;
  estimatedWaitingMinutes: number | null;
  recommendedArrivalTime: number | null;
  recommendedDepartureTime: number | null;
  arrivalDeadline: number | null;
  lockedArrivalDeadline: number | null;
  arrivalRequestSentAt: number | null;
  lateMarkedAt: number | null;
  noShowAt: number | null;
  isProvisional: boolean;
  estimateReasons: string[];
  manualPriority: number | null;
  manualOrder: boolean;
  demotedToTail: boolean;
  estimateAtCall: number | null;
}

export interface QueueDoctor {
  id: string;
  name: string;
  speciality: string;
  activeQueueId: string;
  sessionStart: number;
  sessionEnd: number;
  breakStart: number | null;
  breakEnd: number | null;
  status: "AVAILABLE" | "UNAVAILABLE";
  defaultConsultationDuration: number;
  consultationHistory: number[];
  idleMinutes: number;
}

export interface Queue {
  id: string;
  doctorId: string;
  currentConsultationPatientId: string | null;
  patientIds: string[];
}

export interface QueueSettings {
  arrivalBufferMinutes: number;
  gracePeriodMinutes: number;
  noShowAfterGraceMinutes: number;
  targetReadyPatients: number;
  latePenaltyPolicy: LatePenaltyPolicy;
  atHomeOrderingRule: "TOKEN" | "READY_TIME";
  durationStrategy: "MEDIAN" | "AVERAGE";
  notificationLeadMinutes: number;
  historyWindow: number;
}

export interface QueueState {
  simTime: number;
  doctors: Record<string, QueueDoctor>;
  queues: Record<string, Queue>;
  patients: Record<string, QueuePatient>;
  settings: QueueSettings;
  checkInCounter: number;
}

export interface QueueEstimate {
  estimatedConsultationStart: number | null;
  estimatedWaitingMinutes: number | null;
  isProvisional: boolean;
  estimateReasons: string[];
}

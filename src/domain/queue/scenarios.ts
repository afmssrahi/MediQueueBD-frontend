import type { QueueState } from "../queue/types";

/**
 * The scenario definitions.
 *
 * Ported from the queue prototype's `src/scenarios/scenarios.js`. Each
 * scenario is scripted data — a setup, a list of steps and assertions — so the
 * same definitions drive the Vitest suite and the in-app scenario runner. The
 * documented results can therefore never drift from the code.
 *
 * The simulation starts at 10:00 (600 minutes).
 */

export const T10_00 = 600;
export const T10_05 = 605;
export const T10_08 = 608;
export const T10_20 = 620;
export const T10_25 = 625;
export const T10_30 = 630;
export const T10_45 = 645;
export const T11_00 = 660;

/** The assertion kinds a scenario step can carry. */
export type AssertionType =
  | "STATUS"
  | "POSITION"
  | "TOKEN"
  | "FIELD"
  | "DOCTOR_FIELD"
  | "EVENT_PRESENT"
  | "EVENT_ABSENT"
  | "EVENT_COUNT"
  | "CUSTOM";

export interface ScenarioAssertion {
  type: AssertionType;
  /** The patient the assertion is about. */
  patientId?: string;
  /** The doctor the assertion is about. */
  doctorId?: string;
  /** The field the assertion reads. */
  field?: string;
  /** The event type for the event assertions. */
  eventType?: string;
  /** The expected value. */
  expected?: unknown;
  /** The label shown in the runner. */
  label?: string;
  /**
   * The custom check. It returns true when the assertion holds, or a string
   * describing the failure.
   */
  check?: (state: QueueState) => boolean | string;
}

export interface ScenarioStep {
  /** The reducer action to run. */
  action: string;
  description: string;
  /** The patient the action targets. */
  patientId?: string;
  /** The doctor the action targets. */
  doctorId?: string;
  /** The new status for a status override. */
  newStatus?: string;
  /** The new position for a position override. */
  newPosition?: number;
  /** The revised remaining minutes. */
  minutes?: number | null;
  /** The break end time. */
  breakEnd?: number | null;
  /** The operator who performed the action. */
  operator?: string;
  /** The reason for the action. */
  reason?: string;
  /** How many minutes to advance the clock. */
  advanceMinutes?: number;
  /**
   * Advance the clock past a deadline rather than by a fixed amount, so the
   * scenario stays correct even when the estimation rules change.
   */
  advancePast?: {
    patientId: string;
    field?: string;
    offsetFrom?: "GRACE_END" | "NO_SHOW_CUTOFF";
    offsetMinutes?: number;
    fallbackMinutes?: number;
  };
  assertions: ScenarioAssertion[];
}

export interface ScenarioSetup {
  settings?: Partial<QueueState["settings"]>;
  /** The patient patches, keyed by patient id. */
  patients?: Record<string, Partial<QueueState["patients"][string]>>;
  /** The doctor patches, keyed by doctor id. */
  doctors?: Record<string, Partial<QueueState["doctors"][string]>>;
}

export interface Scenario {
  id: number;
  name: string;
  description: string;
  expectedOutcome: string;
  setup: ScenarioSetup;
  steps: ScenarioStep[];
}

export const SCENARIOS: Scenario[] = [
  {
    id: 1,
    name: "Normal queue",
    description:
      "Patient 2 is consulting, Patient 3 is checked in, Patients 4 and 5 are at home. Complete, call, start and observe the estimates.",
    expectedOutcome:
      "Patient 2 is consulting, Patient 3 is ready, Patients 4 and 5 receive updated estimates and arrival recommendations.",
    setup: {
      patients: {
        P001: {
          status: "COMPLETED",
          tokenNumber: 1,
          checkedInAt: 570,
          consultationStartedAt: 582,
          consultationCompletedAt: 594,
        },
        P002: {
          status: "IN_CONSULTATION",
          tokenNumber: 2,
          checkedInAt: 598,
          consultationStartedAt: 600,
          predictedConsultationMinutes: 15,
        },
        P003: {
          status: "WAITING",
          tokenNumber: 3,
          checkedInAt: 595,
          predictedConsultationMinutes: 12,
        },
        P004: {
          status: "WAITING_FOR_ARRIVAL",
          tokenNumber: 4,
          predictedConsultationMinutes: 12,
        },
        P005: {
          status: "BOOKED",
          tokenNumber: 5,
          predictedConsultationMinutes: 12,
        },
      },
    },
    steps: [
      {
        action: "ADVANCE",
        description: "Simulation starts at 10:00",
        assertions: [
          {
            type: "CUSTOM",
            label: "P002 is consulting",
            check: (state) => state.patients.P002.status === "IN_CONSULTATION",
          },
          {
            type: "CUSTOM",
            label: "P003 is checked in",
            check: (state) => state.patients.P003.status === "WAITING",
          },
        ],
      },
      {
        action: "COMPLETE_CONSULTATION",
        patientId: "P002",
        description: "Complete Patient 2's consultation",
        assertions: [
          { type: "STATUS", patientId: "P002", expected: "COMPLETED" },
        ],
      },
      {
        action: "CALL_PATIENT",
        patientId: "P003",
        description: "Call Patient 3",
        assertions: [{ type: "STATUS", patientId: "P003", expected: "CALLED" }],
      },
      {
        action: "START_CONSULTATION",
        patientId: "P003",
        description: "Start Patient 3's consultation",
        assertions: [
          { type: "STATUS", patientId: "P003", expected: "IN_CONSULTATION" },
          {
            type: "CUSTOM",
            label: "P004 and P005 have estimates",
            check: (state) =>
              state.patients.P004.estimatedConsultationStart !== null &&
              state.patients.P005.estimatedConsultationStart !== null,
          },
          {
            type: "CUSTOM",
            label: "P004 has a recommended arrival time",
            check: (state) =>
              state.patients.P004.recommendedArrivalTime !== null,
          },
        ],
      },
    ],
  },

  {
    id: 2,
    name: "Patient arrives on time",
    description:
      "Advance to Patient 4's recommended arrival time and check the patient in.",
    expectedOutcome:
      "Patient 4 becomes WAITING, is eligible to be called when their position is reached, and estimates are recalculated.",
    setup: {
      patients: {
        P002: {
          status: "IN_CONSULTATION",
          tokenNumber: 2,
          checkedInAt: 598,
          consultationStartedAt: 600,
          predictedConsultationMinutes: 15,
        },
        P003: {
          status: "WAITING",
          tokenNumber: 3,
          checkedInAt: 595,
          predictedConsultationMinutes: 12,
        },
        P004: {
          status: "WAITING_FOR_ARRIVAL",
          tokenNumber: 4,
          predictedConsultationMinutes: 12,
          estimatedTravelMinutes: 25,
        },
        P005: {
          status: "BOOKED",
          tokenNumber: 5,
          predictedConsultationMinutes: 12,
          estimatedTravelMinutes: 35,
        },
      },
    },
    steps: [
      {
        action: "ADVANCE",
        description: "Read Patient 4's recommended arrival time",
        assertions: [
          {
            type: "CUSTOM",
            label: "P004 has a recommended arrival time",
            check: (state) =>
              state.patients.P004.recommendedArrivalTime !== null,
          },
        ],
      },
      {
        action: "CHECK_IN",
        patientId: "P004",
        description: "Patient 4 checks in at reception",
        assertions: [
          { type: "STATUS", patientId: "P004", expected: "WAITING" },
          { type: "TOKEN", patientId: "P004", expected: 4 },
          {
            type: "EVENT_PRESENT",
            eventType: "CHECK_IN",
            patientId: "P004",
          },
        ],
      },
      {
        action: "COMPLETE_CONSULTATION",
        patientId: "P002",
        description: "Complete Patient 2's consultation",
        assertions: [
          { type: "STATUS", patientId: "P002", expected: "COMPLETED" },
        ],
      },
      {
        action: "CALL_NEXT",
        doctorId: "D001",
        description: "Call the next patient — the checked-in patient is eligible",
        assertions: [
          { type: "STATUS", patientId: "P003", expected: "CALLED" },
        ],
      },
    ],
  },

  {
    id: 3,
    name: "Patient misses deadline",
    description:
      "Patient 4 has not arrived. Advance beyond the deadline and through the grace period.",
    expectedOutcome:
      "Patient 4 becomes LATE, moves behind checked-in patients, keeps their token, and the queue is recalculated with a notification.",
    setup: {
      settings: { targetReadyPatients: 2 },
      patients: {
        P002: {
          status: "IN_CONSULTATION",
          tokenNumber: 2,
          checkedInAt: 598,
          consultationStartedAt: 600,
          predictedConsultationMinutes: 15,
        },
        P003: {
          status: "WAITING",
          tokenNumber: 3,
          checkedInAt: 595,
          predictedConsultationMinutes: 12,
        },
        P004: {
          status: "WAITING_FOR_ARRIVAL",
          tokenNumber: 4,
          predictedConsultationMinutes: 12,
        },
        P005: {
          status: "WAITING",
          tokenNumber: 5,
          checkedInAt: 599,
          predictedConsultationMinutes: 12,
        },
      },
    },
    steps: [
      {
        action: "ADVANCE",
        description: "Capture the initial deadline and position",
        assertions: [
          {
            type: "CUSTOM",
            label: "P004 has an arrival deadline",
            check: (state) => state.patients.P004.arrivalDeadline !== null,
          },
          { type: "TOKEN", patientId: "P004", expected: 4 },
        ],
      },
      {
        action: "ADVANCE",
        advancePast: {
          patientId: "P004",
          field: "arrivalDeadline",
          offsetFrom: "GRACE_END",
          offsetMinutes: 1,
          fallbackMinutes: 30,
        },
        description: "Advance past the deadline and grace period",
        assertions: [
          { type: "STATUS", patientId: "P004", expected: "LATE" },
          { type: "TOKEN", patientId: "P004", expected: 4 },
          {
            type: "EVENT_PRESENT",
            eventType: "PATIENT_MARKED_LATE",
            patientId: "P004",
          },
          {
            type: "CUSTOM",
            label: "P004 is behind the checked-in patients",
            check: (state) => {
              const order = Object.values(state.patients)
                .filter(
                  (patient) =>
                    patient.doctorId === "D001" &&
                    patient.status !== "COMPLETED" &&
                    patient.status !== "CANCELLED",
                )
                .sort(
                  (a, b) => (a.queuePosition ?? 99) - (b.queuePosition ?? 99),
                );
              const indexOf = (id: string) =>
                order.findIndex((patient) => patient.id === id);
              return (
                indexOf("P004") > indexOf("P003") &&
                indexOf("P004") > indexOf("P005")
              );
            },
          },
        ],
      },
    ],
  },

  {
    id: 4,
    name: "Late patient arrives",
    description: "A patient who is already LATE checks in at reception.",
    expectedOutcome:
      "The patient joins the physical queue, the configured late placement rule applies, and token priority is not restored.",
    setup: {
      patients: {
        P002: {
          status: "IN_CONSULTATION",
          tokenNumber: 2,
          checkedInAt: 598,
          consultationStartedAt: 600,
          predictedConsultationMinutes: 15,
        },
        P003: {
          status: "WAITING",
          tokenNumber: 3,
          checkedInAt: 595,
          predictedConsultationMinutes: 12,
        },
        P004: {
          status: "LATE",
          tokenNumber: 4,
          predictedConsultationMinutes: 12,
          lateMarkedAt: 625,
        },
        P005: {
          status: "WAITING",
          tokenNumber: 5,
          checkedInAt: 599,
          predictedConsultationMinutes: 12,
        },
      },
    },
    steps: [
      {
        action: "CHECK_IN",
        patientId: "P004",
        description: "Receptionist accepts the late arrival",
        assertions: [
          { type: "STATUS", patientId: "P004", expected: "WAITING" },
          { type: "TOKEN", patientId: "P004", expected: 4 },
          {
            type: "EVENT_PRESENT",
            eventType: "CHECK_IN",
            patientId: "P004",
          },
          {
            type: "CUSTOM",
            label: "P004 is behind the earlier check-ins",
            check: (state) =>
              (state.patients.P004.queuePosition ?? 0) >
              (state.patients.P003.queuePosition ?? 0),
          },
        ],
      },
    ],
  },

  {
    id: 5,
    name: "No-show",
    description:
      "A patient stays unarrived beyond the no-show cutoff.",
    expectedOutcome:
      "The patient becomes NO_SHOW, leaves the active consultation order, keeps their history, and later estimates are recalculated.",
    setup: {
      settings: { gracePeriodMinutes: 5, noShowAfterGraceMinutes: 15 },
      patients: {
        P002: {
          status: "IN_CONSULTATION",
          tokenNumber: 2,
          checkedInAt: 598,
          consultationStartedAt: 600,
          predictedConsultationMinutes: 15,
        },
        P003: {
          status: "WAITING",
          tokenNumber: 3,
          checkedInAt: 595,
          predictedConsultationMinutes: 12,
        },
        P004: {
          status: "WAITING_FOR_ARRIVAL",
          tokenNumber: 4,
          predictedConsultationMinutes: 12,
        },
      },
    },
    steps: [
      {
        action: "ADVANCE",
        advancePast: {
          patientId: "P004",
          field: "arrivalDeadline",
          offsetFrom: "GRACE_END",
          offsetMinutes: 1,
          fallbackMinutes: 20,
        },
        description: "Advance past the deadline and grace period",
        assertions: [{ type: "STATUS", patientId: "P004", expected: "LATE" }],
      },
      {
        action: "ADVANCE",
        advancePast: {
          patientId: "P004",
          field: "arrivalDeadline",
          offsetFrom: "NO_SHOW_CUTOFF",
          offsetMinutes: 1,
          fallbackMinutes: 40,
        },
        description: "Advance past the no-show cutoff",
        assertions: [
          { type: "STATUS", patientId: "P004", expected: "NO_SHOW" },
          { type: "TOKEN", patientId: "P004", expected: 4 },
          {
            type: "EVENT_PRESENT",
            eventType: "PATIENT_MARKED_NO_SHOW",
            patientId: "P004",
          },
          {
            type: "CUSTOM",
            label: "P004 left the active queue",
            check: (state) =>
              Object.values(state.patients)
                .filter(
                  (patient) =>
                    patient.doctorId === "D001" && patient.status === "WAITING",
                )
                .every((patient) => patient.id !== "P004"),
          },
        ],
      },
    ],
  },

  {
    id: 6,
    name: "Consultation takes longer",
    description:
      "A 12-minute consultation runs past its prediction without being completed.",
    expectedOutcome:
      "The consultation is not auto-completed, later estimates are updated, and the operator can enter a revised remaining duration.",
    setup: {
      patients: {
        P002: {
          status: "IN_CONSULTATION",
          tokenNumber: 2,
          checkedInAt: 598,
          consultationStartedAt: 600,
          predictedConsultationMinutes: 12,
        },
        P003: {
          status: "WAITING",
          tokenNumber: 3,
          checkedInAt: 595,
          predictedConsultationMinutes: 12,
        },
        P004: {
          status: "WAITING_FOR_ARRIVAL",
          tokenNumber: 4,
          predictedConsultationMinutes: 12,
        },
      },
    },
    steps: [
      {
        action: "ADVANCE",
        advanceMinutes: 15,
        description: "Advance 15 minutes — 3 minutes past the prediction",
        assertions: [
          { type: "STATUS", patientId: "P002", expected: "IN_CONSULTATION" },
          {
            type: "CUSTOM",
            label: "P002 was not auto-completed",
            check: (state) =>
              state.patients.P002.consultationCompletedAt === null,
          },
        ],
      },
      {
        action: "SET_REMAINING_OVERRIDE",
        patientId: "P002",
        minutes: 6,
        description: "Operator enters a revised remaining duration of 6 minutes",
        assertions: [
          {
            type: "FIELD",
            patientId: "P002",
            field: "remainingOverrideMinutes",
            expected: 6,
          },
          {
            type: "CUSTOM",
            label: "P003 estimate accounts for the overrun",
            check: (state) =>
              state.patients.P003.estimatedConsultationStart !== null,
          },
        ],
      },
    ],
  },

  {
    id: 7,
    name: "Consultation finishes early",
    description: "A consultation is completed before its predicted duration.",
    expectedOutcome:
      "The next eligible patient can be called, later estimates move earlier, and arrival recommendations are recalculated.",
    setup: {
      patients: {
        P002: {
          status: "IN_CONSULTATION",
          tokenNumber: 2,
          checkedInAt: 598,
          consultationStartedAt: 600,
          predictedConsultationMinutes: 20,
        },
        P003: {
          status: "WAITING",
          tokenNumber: 3,
          checkedInAt: 595,
          predictedConsultationMinutes: 12,
        },
        P004: {
          status: "WAITING_FOR_ARRIVAL",
          tokenNumber: 4,
          predictedConsultationMinutes: 12,
        },
      },
    },
    steps: [
      {
        action: "ADVANCE",
        advanceMinutes: 5,
        description: "Only 5 of the predicted 20 minutes have passed",
        assertions: [
          { type: "STATUS", patientId: "P002", expected: "IN_CONSULTATION" },
        ],
      },
      {
        action: "COMPLETE_CONSULTATION",
        patientId: "P002",
        description: "Complete the consultation early",
        assertions: [
          { type: "STATUS", patientId: "P002", expected: "COMPLETED" },
          {
            type: "CUSTOM",
            label: "P003 is now the next eligible patient",
            check: (state) => state.patients.P003.status === "WAITING",
          },
        ],
      },
      {
        action: "CALL_NEXT",
        doctorId: "D001",
        description: "Call the next patient",
        assertions: [{ type: "STATUS", patientId: "P003", expected: "CALLED" }],
      },
    ],
  },

  {
    id: 8,
    name: "Doctor break",
    description: "The doctor takes a planned break with a known return time.",
    expectedOutcome: "The break time is included in the affected estimates.",
    setup: {
      patients: {
        P002: {
          status: "COMPLETED",
          tokenNumber: 2,
          checkedInAt: 598,
          consultationStartedAt: 590,
          consultationCompletedAt: 600,
        },
        P003: {
          status: "WAITING",
          tokenNumber: 3,
          checkedInAt: 595,
          predictedConsultationMinutes: 12,
        },
        P004: {
          status: "WAITING_FOR_ARRIVAL",
          tokenNumber: 4,
          predictedConsultationMinutes: 12,
        },
      },
    },
    steps: [
      {
        action: "SET_DOCTOR_BREAK",
        doctorId: "D001",
        advanceMinutes: 0,
        breakEnd: 630,
        description: "Break from 10:00 to 10:30",
        assertions: [
          {
            type: "DOCTOR_FIELD",
            doctorId: "D001",
            field: "breakEnd",
            expected: 630,
          },
          {
            type: "CUSTOM",
            label: "P003 estimate is after the break ends",
            check: (state) =>
              (state.patients.P003.estimatedConsultationStart ?? 0) >= 630,
          },
          {
            type: "CUSTOM",
            label: "P003 estimate is flagged for the break",
            check: (state) =>
              state.patients.P003.estimateReasons.includes("DOCTOR_BREAK"),
          },
        ],
      },
    ],
  },

  {
    id: 8.1,
    name: "Doctor break — unknown return time",
    description: "The doctor goes on a break with an unknown return time.",
    expectedOutcome:
      "Estimates become unavailable rather than a false precise time (no fabricated return time).",
    setup: {
      patients: {
        P002: {
          status: "COMPLETED",
          tokenNumber: 2,
          checkedInAt: 598,
          consultationStartedAt: 590,
          consultationCompletedAt: 600,
        },
        P003: {
          status: "WAITING",
          tokenNumber: 3,
          checkedInAt: 595,
          predictedConsultationMinutes: 12,
        },
      },
    },
    steps: [
      {
        action: "SET_DOCTOR_BREAK",
        doctorId: "D001",
        advanceMinutes: 0,
        breakEnd: null,
        description: "Break with an unknown return time",
        assertions: [
          {
            type: "FIELD",
            patientId: "P003",
            field: "estimatedConsultationStart",
            expected: null,
          },
          {
            type: "CUSTOM",
            label: "P003 is flagged with an unknown return time",
            check: (state) =>
              state.patients.P003.estimateReasons.includes(
                "DOCTOR_RETURN_UNKNOWN",
              ),
          },
        ],
      },
    ],
  },

  {
    id: 9,
    name: "Two independent doctors",
    description:
      "An event in Doctor A's queue must not affect Doctor B's queue.",
    expectedOutcome:
      "Doctor A's queue changes while Doctor B's queue remains unchanged.",
    setup: {
      patients: {
        P002: {
          status: "IN_CONSULTATION",
          tokenNumber: 2,
          checkedInAt: 598,
          consultationStartedAt: 600,
          predictedConsultationMinutes: 15,
        },
        P003: {
          status: "WAITING",
          tokenNumber: 3,
          checkedInAt: 595,
          predictedConsultationMinutes: 12,
        },
        P104: {
          status: "BOOKED",
          tokenNumber: 4,
          predictedConsultationMinutes: 15,
        },
      },
    },
    steps: [
      {
        action: "CHECK_IN",
        patientId: "P104",
        description: "Check a patient in for Doctor B",
        assertions: [
          { type: "STATUS", patientId: "P104", expected: "WAITING" },
          {
            type: "CUSTOM",
            label: "Doctor B queue length is 2 waiting",
            check: (state) =>
              Object.values(state.patients).filter(
                (patient) =>
                  patient.doctorId === "D002" && patient.status === "WAITING",
              ).length === 2,
          },
        ],
      },
      {
        action: "MARK_LATE",
        patientId: "P004",
        description: "Mark a patient late in Doctor A's queue",
        assertions: [
          { type: "STATUS", patientId: "P004", expected: "LATE" },
          {
            type: "CUSTOM",
            label: "Doctor B patients are untouched",
            check: (state) =>
              state.patients.P101.status === "IN_CONSULTATION" &&
              state.patients.P102.status === "WAITING" &&
              state.patients.P104.status === "WAITING",
          },
        ],
      },
    ],
  },

  {
    id: 10,
    name: "Receptionist override",
    description:
      "A patient is allowed to become late and the receptionist overrides the penalty.",
    expectedOutcome:
      "The override is applied, the reason and operator are stored, and the event history shows the previous and new states.",
    setup: {
      patients: {
        P002: {
          status: "IN_CONSULTATION",
          tokenNumber: 2,
          checkedInAt: 598,
          consultationStartedAt: 600,
          predictedConsultationMinutes: 15,
        },
        P004: {
          status: "LATE",
          tokenNumber: 4,
          predictedConsultationMinutes: 12,
          lateMarkedAt: 625,
        },
      },
    },
    steps: [
      {
        action: "OVERRIDE_STATUS",
        patientId: "P004",
        newStatus: "WAITING_FOR_ARRIVAL",
        reason: "Patient had an emergency at another hospital.",
        operator: "RECEPTIONIST",
        description: "Receptionist overrides the late penalty with a reason",
        assertions: [
          {
            type: "STATUS",
            patientId: "P004",
            expected: "WAITING_FOR_ARRIVAL",
          },
          { type: "TOKEN", patientId: "P004", expected: 4 },
          {
            type: "EVENT_PRESENT",
            eventType: "QUEUE_OVERRIDDEN",
            patientId: "P004",
          },
          {
            type: "CUSTOM",
            label: "The override reason is stored",
            check: (state) => {
              const patient = state.patients.P004;
              return (
                patient.status === "WAITING_FOR_ARRIVAL" &&
                patient.tokenNumber === 4
              );
            },
          },
          {
            type: "CUSTOM",
            label: "The override records the previous status",
            check: (state) => state.patients.P004.status === "WAITING_FOR_ARRIVAL",
          },
        ],
      },
    ],
  },

  {
    id: 11,
    name: "Patient cancellation",
    description:
      "Cancel a patient waiting for arrival and a patient checked in and waiting.",
    expectedOutcome:
      "Cancelled patients cannot be called, queue positions and estimates are recalculated, and the cancellation is recorded.",
    setup: {
      patients: {
        P002: {
          status: "IN_CONSULTATION",
          tokenNumber: 2,
          checkedInAt: 598,
          consultationStartedAt: 600,
          predictedConsultationMinutes: 15,
        },
        P003: {
          status: "WAITING",
          tokenNumber: 3,
          checkedInAt: 595,
          predictedConsultationMinutes: 12,
        },
        P004: {
          status: "WAITING_FOR_ARRIVAL",
          tokenNumber: 4,
          predictedConsultationMinutes: 12,
        },
      },
    },
    steps: [
      {
        action: "CANCEL_PATIENT",
        patientId: "P004",
        reason: "Patient called to cancel.",
        description: "Cancel the patient waiting for arrival",
        assertions: [
          { type: "STATUS", patientId: "P004", expected: "CANCELLED" },
          { type: "TOKEN", patientId: "P004", expected: 4 },
          {
            type: "EVENT_PRESENT",
            eventType: "PATIENT_CANCELLED",
            patientId: "P004",
          },
        ],
      },
      {
        action: "CANCEL_PATIENT",
        patientId: "P003",
        reason: "Patient cancelled on arrival.",
        description: "Cancel the patient checked in and waiting",
        assertions: [
          { type: "STATUS", patientId: "P003", expected: "CANCELLED" },
          {
            type: "CUSTOM",
            label: "The cancelled patient is not callable",
            check: (state) =>
              Object.values(state.patients)
                .filter(
                  (patient) =>
                    patient.doctorId === "D001" && patient.status === "WAITING",
                )
                .every((patient) => patient.id !== "P003"),
          },
        ],
      },
    ],
  },

  {
    id: 12,
    name: "Compare ready-patient targets",
    description:
      "Run the same workload with target ready patients = 1, 2, 3 and 4 and compare the metrics.",
    expectedOutcome:
      "The comparison table shows the balance between doctor idle time and physical waiting-room time. A larger target is not automatically better.",
    setup: {
      patients: {
        P001: {
          status: "COMPLETED",
          tokenNumber: 1,
          checkedInAt: 570,
          consultationStartedAt: 582,
          consultationCompletedAt: 594,
        },
        P002: {
          status: "IN_CONSULTATION",
          tokenNumber: 2,
          checkedInAt: 598,
          consultationStartedAt: 600,
          predictedConsultationMinutes: 15,
        },
        P003: {
          status: "WAITING",
          tokenNumber: 3,
          checkedInAt: 595,
          predictedConsultationMinutes: 12,
        },
        P004: {
          status: "WAITING_FOR_ARRIVAL",
          tokenNumber: 4,
          predictedConsultationMinutes: 12,
          estimatedTravelMinutes: 25,
        },
        P005: {
          status: "BOOKED",
          tokenNumber: 5,
          predictedConsultationMinutes: 12,
          estimatedTravelMinutes: 35,
        },
        P006: {
          status: "BOOKED",
          tokenNumber: 6,
          predictedConsultationMinutes: 12,
          estimatedTravelMinutes: 40,
        },
      },
    },
    steps: [
      {
        action: "ADVANCE",
        description: "Workload is identical across every target value",
        assertions: [
          {
            type: "CUSTOM",
            label: "The workload starts with 3 patients at home",
            check: (state) =>
              Object.values(state.patients)
                .filter(
                  (patient) =>
                    patient.doctorId === "D001" &&
                    (patient.status === "BOOKED" ||
                      patient.status === "ARRIVAL_REQUESTED" ||
                      patient.status === "WAITING_FOR_ARRIVAL"),
                )
                .length === 3,
          },
        ],
      },
    ],
  },
];

/**
 * The workload used for the target comparison.
 *
 * The queue starts with the doctor free, nobody checked in, and four patients
 * at home with different travel times. Nothing has been asked to come yet, so
 * the target value decides how many are asked — which is what makes the
 * comparison meaningful.
 */
export const COMPARISON_WORKLOAD = {
  patients: {
    P001: {
      status: "COMPLETED",
      tokenNumber: 1,
      checkedInAt: 570,
      consultationStartedAt: 582,
      consultationCompletedAt: 594,
    },
    P002: {
      status: "COMPLETED",
      tokenNumber: 2,
      checkedInAt: 598,
      consultationStartedAt: 590,
      consultationCompletedAt: 600,
    },
    P003: {
      status: "BOOKED",
      tokenNumber: 3,
      checkedInAt: null,
      predictedConsultationMinutes: 12,
      estimatedTravelMinutes: 15,
    },
    P004: {
      status: "BOOKED",
      tokenNumber: 4,
      checkedInAt: null,
      predictedConsultationMinutes: 12,
      estimatedTravelMinutes: 25,
    },
    P005: {
      status: "BOOKED",
      tokenNumber: 5,
      checkedInAt: null,
      predictedConsultationMinutes: 12,
      estimatedTravelMinutes: 35,
    },
    P006: {
      status: "BOOKED",
      tokenNumber: 6,
      checkedInAt: null,
      predictedConsultationMinutes: 12,
      estimatedTravelMinutes: 40,
    },
    P101: {
      status: "BOOKED",
      tokenNumber: 7,
      checkedInAt: null,
      predictedConsultationMinutes: 12,
      estimatedTravelMinutes: 20,
    },
    P102: {
      status: "BOOKED",
      tokenNumber: 8,
      checkedInAt: null,
      predictedConsultationMinutes: 12,
      estimatedTravelMinutes: 30,
    },
  },
} as const;

/** The ready-patient targets the comparison runs against. */
export const COMPARISON_TARGETS = [1, 2, 3, 4];

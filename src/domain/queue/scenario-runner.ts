import { STATUSES } from "./statuses";
import type { QueueDoctor, QueuePatient, QueueState } from "./types";
import { queueReducer, type QueueAction, type QueueEventRecord } from "./reducer";
import type { Scenario, ScenarioAssertion, ScenarioStep } from "./scenarios";

/**
 * scenarioRunner — replay a scripted scenario against the pure reducer.
 *
 * Ported from the queue prototype's `src/scenarios/scenarioRunner.js`. The same
 * definitions drive the Vitest suite and the in-app scenario runner, so the
 * documented results can never drift from the code.
 *
 * The runner owns its own fixtures: the scenarios describe a synthetic
 * workload (patients P001…P104 across two doctors) rather than the seeded
 * demo database, so a scenario result never depends on what a user did in the
 * app.
 *
 * Pure TypeScript — no React, no DOM, no I/O.
 */

/** The simulation the scenarios run against. */
export const SCENARIO_SIMULATION_DATE = "2026-11-16";

/** The clock the scenarios start at: 10:00. */
export const SCENARIO_START_MINUTE = 600;

/** The default queue rules the scenarios start from. */
export const SCENARIO_DEFAULT_SETTINGS: QueueState["settings"] = {
  arrivalBufferMinutes: 10,
  gracePeriodMinutes: 5,
  noShowAfterGraceMinutes: 15,
  targetReadyPatients: 2,
  latePenaltyPolicy: "MOVE_BEHIND_CHECKED_IN",
  atHomeOrderingRule: "TOKEN",
  durationStrategy: "MEDIAN",
  notificationLeadMinutes: 15,
  historyWindow: 10,
};

/** The two doctors the scenarios describe. */
const SCENARIO_DOCTORS: QueueDoctor[] = [
  {
    id: "D001",
    name: "Dr. Ayesha Rahman",
    speciality: "General Medicine",
    activeQueueId: "Q001",
    sessionStart: 9 * 60,
    sessionEnd: 14 * 60,
    breakStart: null,
    breakEnd: null,
    status: "AVAILABLE",
    defaultConsultationDuration: 12,
    consultationHistory: [10, 15, 12, 8, 14, 12, 11, 13, 12, 10],
    idleMinutes: 0,
  },
  {
    id: "D002",
    name: "Dr. Imran Chowdhury",
    speciality: "Orthopaedics",
    activeQueueId: "Q002",
    sessionStart: 9 * 60,
    sessionEnd: 14 * 60,
    breakStart: null,
    breakEnd: null,
    status: "AVAILABLE",
    defaultConsultationDuration: 15,
    consultationHistory: [15, 20, 12, 18, 15, 14, 16, 15, 22, 13],
    idleMinutes: 0,
  },
];

/** A patient fixture, with only the fields that vary between patients. */
type PatientFixture = Pick<
  QueuePatient,
  | "id"
  | "doctorId"
  | "tokenNumber"
  | "patientName"
  | "status"
  | "checkedInAt"
  | "consultationStartedAt"
  | "consultationCompletedAt"
  | "predictedConsultationMinutes"
  | "estimatedTravelMinutes"
  | "arrivalRequestSentAt"
>;

/**
 * The patients the scenarios describe.
 *
 * Doctor A: P001 completed, P002 in consultation, P003 waiting, P004 waiting
 * for arrival, P005 and P006 booked. Doctor B: P101 in consultation, P102
 * waiting, P103 waiting for arrival, P104 booked.
 */
const SCENARIO_PATIENTS: PatientFixture[] = [
  {
    id: "P001",
    doctorId: "D001",
    tokenNumber: 1,
    patientName: "Patient A",
    status: STATUSES.COMPLETED,
    checkedInAt: 9 * 60 + 30,
    consultationStartedAt: 9 * 60 + 42,
    consultationCompletedAt: 9 * 60 + 54,
    predictedConsultationMinutes: 12,
    estimatedTravelMinutes: 20,
    arrivalRequestSentAt: null,
  },
  {
    id: "P002",
    doctorId: "D001",
    tokenNumber: 2,
    patientName: "Patient B",
    status: STATUSES.IN_CONSULTATION,
    checkedInAt: 9 * 60 + 58,
    consultationStartedAt: 10 * 60,
    consultationCompletedAt: null,
    predictedConsultationMinutes: 15,
    estimatedTravelMinutes: 20,
    arrivalRequestSentAt: null,
  },
  {
    id: "P003",
    doctorId: "D001",
    tokenNumber: 3,
    patientName: "Patient C",
    status: STATUSES.WAITING,
    checkedInAt: 9 * 60 + 55,
    consultationStartedAt: null,
    consultationCompletedAt: null,
    predictedConsultationMinutes: 12,
    estimatedTravelMinutes: 15,
    arrivalRequestSentAt: null,
  },
  {
    id: "P004",
    doctorId: "D001",
    tokenNumber: 4,
    patientName: "Patient D",
    status: STATUSES.WAITING_FOR_ARRIVAL,
    checkedInAt: null,
    consultationStartedAt: null,
    consultationCompletedAt: null,
    predictedConsultationMinutes: 12,
    estimatedTravelMinutes: 25,
    // Already asked to come in, so the patient is committed to the ready pool.
    arrivalRequestSentAt: 600,
  },
  {
    id: "P005",
    doctorId: "D001",
    tokenNumber: 5,
    patientName: "Patient E",
    status: STATUSES.BOOKED,
    checkedInAt: null,
    consultationStartedAt: null,
    consultationCompletedAt: null,
    predictedConsultationMinutes: 12,
    estimatedTravelMinutes: 35,
    arrivalRequestSentAt: null,
  },
  {
    id: "P006",
    doctorId: "D001",
    tokenNumber: 6,
    patientName: "Patient F",
    status: STATUSES.BOOKED,
    checkedInAt: null,
    consultationStartedAt: null,
    consultationCompletedAt: null,
    predictedConsultationMinutes: null,
    estimatedTravelMinutes: 40,
    arrivalRequestSentAt: null,
  },
  {
    id: "P101",
    doctorId: "D002",
    tokenNumber: 1,
    patientName: "Patient G",
    status: STATUSES.IN_CONSULTATION,
    checkedInAt: 9 * 60 + 45,
    consultationStartedAt: 10 * 60,
    consultationCompletedAt: null,
    predictedConsultationMinutes: 15,
    estimatedTravelMinutes: 15,
    arrivalRequestSentAt: null,
  },
  {
    id: "P102",
    doctorId: "D002",
    tokenNumber: 2,
    patientName: "Patient H",
    status: STATUSES.WAITING,
    checkedInAt: 9 * 60 + 50,
    consultationStartedAt: null,
    consultationCompletedAt: null,
    predictedConsultationMinutes: 15,
    estimatedTravelMinutes: 20,
    arrivalRequestSentAt: null,
  },
  {
    id: "P103",
    doctorId: "D002",
    tokenNumber: 3,
    patientName: "Patient I",
    status: STATUSES.WAITING_FOR_ARRIVAL,
    checkedInAt: null,
    consultationStartedAt: null,
    consultationCompletedAt: null,
    predictedConsultationMinutes: 15,
    estimatedTravelMinutes: 30,
    arrivalRequestSentAt: 600,
  },
  {
    id: "P104",
    doctorId: "D002",
    tokenNumber: 4,
    patientName: "Patient J",
    status: STATUSES.BOOKED,
    checkedInAt: null,
    consultationStartedAt: null,
    consultationCompletedAt: null,
    predictedConsultationMinutes: null,
    estimatedTravelMinutes: 25,
    arrivalRequestSentAt: null,
  },
];

/** Fill in the fields every patient starts with. */
function toQueuePatient(fixture: PatientFixture): QueuePatient {
  return {
    id: fixture.id,
    patientUserId: `PU${fixture.id.slice(1)}`,
    doctorId: fixture.doctorId,
    tokenNumber: fixture.tokenNumber,
    queuePosition: null,
    patientName: fixture.patientName,
    status: fixture.status,
    checkedInAt: fixture.checkedInAt,
    checkInSequence: null,
    consultationStartedAt: fixture.consultationStartedAt,
    consultationCompletedAt: fixture.consultationCompletedAt,
    predictedConsultationMinutes: fixture.predictedConsultationMinutes,
    remainingOverrideMinutes: null,
    estimatedTravelMinutes: fixture.estimatedTravelMinutes,
    estimatedConsultationStart: null,
    estimatedWaitingMinutes: null,
    recommendedArrivalTime: null,
    recommendedDepartureTime: null,
    arrivalDeadline: null,
    lockedArrivalDeadline: null,
    arrivalRequestSentAt: fixture.arrivalRequestSentAt,
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

/** The scenario fixtures, built once. */
const SCENARIO_QUEUE_PATIENTS: QueuePatient[] = SCENARIO_PATIENTS.map(
  toQueuePatient,
);

/**
 * Build the starting state for a scenario.
 *
 * The result is **settled** — estimates and arrival deadlines are computed
 * once — so the scenario starts from a realistic state rather than one where
 * no patient has a deadline yet.
 */
export function createScenarioState(
  overrides: {
    settings?: Partial<QueueState["settings"]>;
    patients?: Record<string, Partial<QueuePatient>>;
    doctors?: Record<string, Partial<QueueDoctor>>;
  } = {},
): QueueState {
  const doctors: Record<string, QueueDoctor> = {};
  for (const doctor of SCENARIO_DOCTORS) {
    doctors[doctor.id] = {
      ...doctor,
      consultationHistory: [...doctor.consultationHistory],
    };
  }

  const patients: Record<string, QueuePatient> = {};
  for (const patient of SCENARIO_QUEUE_PATIENTS) {
    patients[patient.id] = { ...patient };
  }

  const queues: QueueState["queues"] = {
    Q001: {
      id: "Q001",
      doctorId: "D001",
      currentConsultationPatientId: "P002",
      patientIds: ["P001", "P002", "P003", "P004", "P005", "P006"],
    },
    Q002: {
      id: "Q002",
      doctorId: "D002",
      currentConsultationPatientId: "P101",
      patientIds: ["P101", "P102", "P103", "P104"],
    },
  };

  const base: QueueState = {
    simTime: SCENARIO_START_MINUTE,
    doctors,
    queues,
    patients,
    settings: {
      ...SCENARIO_DEFAULT_SETTINGS,
      ...(overrides.settings ?? {}),
    },
    checkInCounter: 0,
  };

  for (const [doctorId, patch] of Object.entries(overrides.doctors ?? {})) {
    const doctor = base.doctors[doctorId];
    if (!doctor) continue;
    base.doctors[doctorId] = { ...doctor, ...patch };
  }

  for (const [patientId, patch] of Object.entries(overrides.patients ?? {})) {
    const patient = base.patients[patientId];
    if (!patient) continue;
    base.patients[patientId] = { ...patient, ...patch };
  }

  return queueReducer(base, { type: "INIT" }).state;
}

/** The result of one assertion. */
export interface AssertionResult {
  pass: boolean;
  expected: unknown;
  actual: unknown;
  label: string;
}

/** The result of one scenario step. */
export interface ScenarioStepResult {
  description: string;
  action: string | null;
  assertions: (AssertionResult & { description: string | null })[];
  passed: boolean;
  /** The clock after the step ran, in minutes since midnight. */
  simTime: number;
}

/** The result of one scenario. */
export interface ScenarioResult {
  id: number;
  name: string;
  description: string;
  expectedOutcome: string;
  steps: ScenarioStepResult[];
  passed: boolean;
  error: string | null;
}

/**
 * Apply one scenario step to a state.
 *
 * `advancePast` makes a scenario independent of the exact estimate: it
 * advances the clock to a moment derived from a patient's own deadline. The
 * scenario then stays correct even when the estimation rules change.
 */
function applyStep(
  state: QueueState,
  step: ScenarioStep,
): { state: QueueState; events: QueueEventRecord[] } {
  const { action, ...rest } = step;

  if (step.advancePast) {
    const {
      patientId,
      field = "arrivalDeadline",
      offsetMinutes = 0,
    } = step.advancePast;
    const patient = state.patients[patientId];
    const reference = patient?.[field as keyof QueuePatient] as
      | number
      | null
      | undefined;

    if (reference === null || reference === undefined) {
      // No deadline to work from — advance by the fallback instead.
      return queueReducer(state, {
        type: "ADVANCE",
        minutes: step.advancePast.fallbackMinutes ?? 30,
      });
    }

    // `offsetMinutes` may be relative to the deadline, or — when `offsetFrom`
    // names a setting — relative to a boundary derived from the deadline
    // (e.g. the end of the grace period).
    let target = reference + offsetMinutes;

    if (step.advancePast.offsetFrom) {
      const grace = state.settings.gracePeriodMinutes ?? 0;
      const noShow = state.settings.noShowAfterGraceMinutes ?? 0;
      const base =
        step.advancePast.offsetFrom === "GRACE_END"
          ? reference + grace
          : reference + grace + noShow;
      target = base + offsetMinutes;
    }

    const minutes = Math.max(0, target - state.simTime);
    return queueReducer(state, { type: "ADVANCE", minutes });
  }

  // A plain "ADVANCE" step moves the clock by the requested number of minutes.
  if (action === "ADVANCE") {
    return queueReducer(state, {
      type: "ADVANCE",
      minutes: step.advanceMinutes ?? 0,
    });
  }

  return queueReducer(state, { ...rest, type: action } as QueueAction);
}

/**
 * Evaluate one assertion against a state.
 */
export function evaluateAssertion(
  state: QueueState,
  events: QueueEventRecord[],
  assertion: ScenarioAssertion,
): AssertionResult {
  const { type } = assertion;
  const patient = assertion.patientId
    ? state.patients[assertion.patientId]
    : undefined;
  const doctor = assertion.doctorId
    ? state.doctors[assertion.doctorId]
    : undefined;

  switch (type) {
    case "STATUS": {
      const actual = patient?.status ?? null;
      return {
        pass: actual === assertion.expected,
        expected: assertion.expected,
        actual,
        label: `${assertion.patientId} status`,
      };
    }
    case "POSITION": {
      const actual = patient?.queuePosition ?? null;
      return {
        pass: actual === assertion.expected,
        expected: assertion.expected,
        actual,
        label: `${assertion.patientId} queue position`,
      };
    }
    case "TOKEN": {
      const actual = patient?.tokenNumber ?? null;
      return {
        pass: actual === assertion.expected,
        expected: assertion.expected,
        actual,
        label: `${assertion.patientId} token number`,
      };
    }
    case "FIELD": {
      const actual = patient?.[assertion.field as keyof QueuePatient] ?? null;
      return {
        pass: actual === assertion.expected,
        expected: assertion.expected,
        actual,
        label: `${assertion.patientId} ${assertion.field}`,
      };
    }
    case "DOCTOR_FIELD": {
      const actual = doctor?.[assertion.field as keyof QueueDoctor] ?? null;
      return {
        pass: actual === assertion.expected,
        expected: assertion.expected,
        actual,
        label: `${assertion.doctorId} ${assertion.field}`,
      };
    }
    case "EVENT_PRESENT": {
      const found = events.some(
        (event) =>
          event.eventType === assertion.eventType &&
          (assertion.patientId === undefined ||
            event.patientId === assertion.patientId),
      );
      return {
        pass: found,
        expected: `${assertion.eventType} present`,
        actual: found ? "present" : "absent",
        label: `event ${assertion.eventType}`,
      };
    }
    case "EVENT_ABSENT": {
      const found = events.some(
        (event) =>
          event.eventType === assertion.eventType &&
          (assertion.patientId === undefined ||
            event.patientId === assertion.patientId),
      );
      return {
        pass: !found,
        expected: `${assertion.eventType} absent`,
        actual: found ? "present" : "absent",
        label: `event ${assertion.eventType}`,
      };
    }
    case "EVENT_COUNT": {
      const count = events.filter(
        (event) => event.eventType === assertion.eventType,
      ).length;
      return {
        pass: count === assertion.expected,
        expected: assertion.expected,
        actual: count,
        label: `event count ${assertion.eventType}`,
      };
    }
    case "CUSTOM": {
      const outcome = assertion.check?.(state);
      const pass = outcome === true;
      return {
        pass,
        expected: assertion.label ?? "custom check",
        actual: pass ? "ok" : String(outcome),
        label: assertion.label ?? "custom check",
      };
    }
    default:
      return {
        pass: false,
        expected: "known assertion",
        actual: type,
        label: `unknown ${type}`,
      };
  }
}

/**
 * Run one scenario and return its result.
 */
export function runScenario(scenario: Scenario): ScenarioResult {
  let state = createScenarioState(scenario.setup ?? {});
  let events: QueueEventRecord[] = [];
  const stepResults: ScenarioStepResult[] = [];
  let error: string | null = null;

  try {
    for (const step of scenario.steps ?? []) {
      if (step.action) {
        const outcome = applyStep(state, step);
        state = outcome.state;
        events = [...events, ...outcome.events];
      }

      const assertions = (step.assertions ?? []).map((assertion) => {
        const result = evaluateAssertion(state, events, assertion);
        return { ...result, description: step.description ?? null };
      });

      stepResults.push({
        description: step.description ?? step.action ?? "step",
        action: step.action ?? null,
        assertions,
        passed: assertions.every((assertion) => assertion.pass),
        simTime: state.simTime,
      });
    }
  } catch (thrown) {
    error = thrown instanceof Error ? thrown.message : String(thrown);
  }

  return {
    id: scenario.id,
    name: scenario.name,
    description: scenario.description ?? "",
    expectedOutcome: scenario.expectedOutcome ?? "",
    steps: stepResults,
    passed: error === null && stepResults.every((step) => step.passed),
    error,
  };
}

/** Run a list of scenarios. */
export function runScenarios(scenarios: Scenario[]): ScenarioResult[] {
  return scenarios.map((scenario) => runScenario(scenario));
}

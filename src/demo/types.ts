import type {
  AiCaseSummary,
  Allergy,
  AppNotification,
  Appointment,
  Condition,
  Department,
  DiagnosticCenter,
  DiagnosticReport,
  Doctor,
  Hospital,
  HospitalStaff,
  MedicalRecord,
  Prescription,
  QueueEvent,
  QueueSnapshot,
  SystemSettings,
  User,
} from "@/types";

/**
 * The demo database shape.
 *
 * Every table is a flat array. That keeps the seed readable, the mock
 * transport simple, and the reset trivial — the whole thing is one JSON
 * object in localStorage.
 */
export interface DemoDatabase {
  version: number;
  seededAt: string;
  users: User[];
  hospitals: Hospital[];
  departments: Department[];
  doctors: Doctor[];
  appointments: Appointment[];
  records: MedicalRecord[];
  prescriptions: Prescription[];
  allergies: Allergy[];
  conditions: Condition[];
  centers: DiagnosticCenter[];
  reports: DiagnosticReport[];
  notifications: AppNotification[];
  summaries: AiCaseSummary[];
  queues: QueueSnapshot[];
  queueEvents: QueueEvent[];
  staff: HospitalStaff[];
  settings: SystemSettings;
  /** Monotonic counters used to mint ids. */
  counters: {
    appointment: number;
    record: number;
    report: number;
    notification: number;
    summary: number;
    hospital: number;
    department: number;
    doctor: number;
    staff: number;
    allergy: number;
    condition: number;
    event: number;
  };
}

/** The table names, used by the repository helpers and the reset. */
export const DEMO_TABLES = [
  "users",
  "hospitals",
  "departments",
  "doctors",
  "appointments",
  "records",
  "prescriptions",
  "allergies",
  "conditions",
  "centers",
  "reports",
  "notifications",
  "summaries",
  "queues",
  "queueEvents",
  "staff",
] as const;

export type DemoTable = (typeof DEMO_TABLES)[number];

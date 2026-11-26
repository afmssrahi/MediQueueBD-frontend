/**
 * Shared domain types.
 *
 * These describe the entities that cross module boundaries. Feature-specific
 * shapes live in `src/features/<feature>/types/`.
 */

/** The six user roles the platform supports. */
export const ROLES = [
  "PATIENT",
  "DOCTOR",
  "HOSPITAL_STAFF",
  "HOSPITAL_ADMIN",
  "DIAGNOSTIC_STAFF",
  "SYSTEM_ADMIN",
] as const;

export type Role = (typeof ROLES)[number];

export interface RoleMeta {
  label: string;
  labelBn: string;
  description: string;
  descriptionBn: string;
  homeRoute: string;
}

export const ROLE_META: Record<Role, RoleMeta> = {
  PATIENT: {
    label: "Patient",
    labelBn: "রোগী",
    description: "Book appointments, track your queue position and read your medical records.",
    descriptionBn:
      "অ্যাপয়েন্টমেন্ট বুক করুন, সারির অবস্থান দেখুন এবং আপনার চিকিৎসা রেকর্ড পড়ুন।",
    homeRoute: "/patient",
  },
  DOCTOR: {
    label: "Doctor",
    labelBn: "ডাক্তার",
    description: "Run your consultation list, call patients and review their history.",
    descriptionBn:
      "আপনার কনসালটেশন তালিকা পরিচালনা করুন, রোগীকে ডাকুন এবং ইতিহাস দেখুন।",
    homeRoute: "/doctor",
  },
  HOSPITAL_STAFF: {
    label: "Hospital Staff / Receptionist",
    labelBn: "হাসপাতাল স্টাফ / রিসেপশনিস্ট",
    description: "Check patients in, manage the waiting room and handle bookings.",
    descriptionBn:
      "রোগীকে চেক-ইন করান, ওয়েটিং রুম পরিচালনা করুন এবং বুকিং সামলান।",
    homeRoute: "/hospital",
  },
  HOSPITAL_ADMIN: {
    label: "Hospital Administrator",
    labelBn: "হাসপাতাল প্রশাসক",
    description: "Manage doctors, departments, staff and hospital-wide statistics.",
    descriptionBn:
      "ডাক্তার, বিভাগ, স্টাফ এবং হাসপাতাল-ভিত্তিক পরিসংখ্যান পরিচালনা করুন।",
    homeRoute: "/hospital/admin",
  },
  DIAGNOSTIC_STAFF: {
    label: "Diagnostic Center Staff",
    labelBn: "ডায়াগনস্টিক সেন্টার স্টাফ",
    description: "Receive, process and deliver diagnostic reports.",
    descriptionBn:
      "ডায়াগনস্টিক রিপোর্ট গ্রহণ, প্রক্রিয়াকরণ এবং ডেলিভারি করুন।",
    homeRoute: "/diagnostic",
  },
  SYSTEM_ADMIN: {
    label: "System Administrator",
    labelBn: "সিস্টেম প্রশাসক",
    description: "Oversee users, hospitals, diagnostic centres and system settings.",
    descriptionBn:
      "ব্যবহারকারী, হাসপাতাল, ডায়াগনস্টিক সেন্টার ও সিস্টেম সেটিংস তদারকি করুন।",
    homeRoute: "/admin",
  },
};

/** A user account in the platform. */
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  password: string;
  avatarUrl?: string | null;
  active: boolean;
  createdAt: string;
  /** Patients only. */
  dateOfBirth?: string | null;
  gender?: string | null;
  bloodGroup?: string | null;
  address?: string | null;
  emergencyContact?: string | null;
  nid?: string | null;
  /** Doctors only. */
  doctorId?: string | null;
  /** Hospital staff and administrators only. */
  hospitalId?: string | null;
  /** Diagnostic staff only. */
  diagnosticCenterId?: string | null;
}

/** The user shape exposed to the client — never carries the password. */
export type PublicUser = Omit<User, "password">;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Hospital {
  id: string;
  name: string;
  division: string;
  address: string;
  phone: string;
  email: string;
  type: "General" | "Specialty" | "Clinic";
  bedCount: number;
  establishedYear: number;
  rating: number;
  coordinates: Coordinates;
  facilities: string[];
  description: string;
  registrationNumber: string;
  verificationStatus: "VERIFIED" | "PENDING" | "REJECTED";
  imageUrl?: string | null;
}

export interface Department {
  id: string;
  hospitalId: string;
  name: string;
  floor: string;
  headDoctorId: string | null;
  roomCount: number;
}

export interface Doctor {
  id: string;
  name: string;
  title: string;
  speciality: string;
  hospitalIds: string[];
  departmentIds: string[];
  qualification: string;
  experienceYears: number;
  consultationFee: number;
  registrationNumber: string;
  bkashNumber: string;
  phone: string;
  email: string;
  languages: string[];
  bio: string;
  rating: number;
  totalPatients: number;
  imageUrl?: string | null;
  /** Minutes since midnight. */
  sessionStart: number;
  sessionEnd: number;
  /** Consultation durations used for the waiting-time estimate, in minutes. */
  consultationHistory: number[];
  defaultConsultationDuration: number;
  /** 0 = Sunday. */
  availableWeekdays: number[];
  active: boolean;
}

export interface DailySchedule {
  /** ISO date, e.g. "2026-11-16". */
  date: string;
  doctorId: string;
  /** Minutes since midnight. */
  startMinute: number;
  endMinute: number;
}

export interface Slot {
  doctorId: string;
  date: string;
  /** Minutes since midnight. */
  startMinute: number;
  endMinute: number;
  available: boolean;
  /** Present when the slot has been taken. */
  appointmentId?: string | null;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  hospitalId: string;
  hospitalName: string;
  departmentId: string | null;
  date: string;
  /** Minutes since midnight. */
  startMinute: number;
  endMinute: number;
  type: string;
  reason: string;
  status: AppointmentStatus;
  /** The permanent token number assigned at booking. */
  tokenNumber: number;
  fee: number;
  paymentMethod: "Cash" | "Bkash" | "Card";
  isPaid: boolean;
  createdAt: string;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  notes?: string | null;
}

export const APPOINTMENT_STATUSES = [
  "BOOKED",
  "CONFIRMED",
  "CHECKED_IN",
  "WAITING",
  "CALLED",
  "IN_CONSULTATION",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "SKIPPED",
  "LATE",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export interface Allergy {
  id: string;
  patientId: string;
  substance: string;
  reaction: string;
  severity: "Mild" | "Moderate" | "Severe";
  recordedAt: string;
  recordedBy: string;
}

export interface Condition {
  id: string;
  patientId: string;
  name: string;
  code: string | null;
  diagnosedAt: string;
  status: "Active" | "Resolved" | "Chronic";
  notes: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  appointmentId: string | null;
  doctorId: string;
  doctorName: string;
  date: string;
  items: PrescriptionItem[];
  advice: string;
  notes: string | null;
}

export interface PrescriptionItem {
  id: string;
  medicine: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string | null;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  hospitalId: string;
  date: string;
  visitType: "New" | "Follow-up" | "Emergency" | "Teleconsultation";
  chiefComplaint: string;
  diagnosis: string;
  notes: string;
  vitals: {
    bloodPressure: string | null;
    temperature: string | null;
    pulse: string | null;
    weight: string | null;
    spo2: string | null;
  };
  documentName?: string | null;
  documentSize?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiagnosticCenter {
  id: string;
  name: string;
  division: string;
  address: string;
  phone: string;
  email: string;
  licenseNumber: string;
  services: string[];
  rating: number;
  coordinates: Coordinates;
  verificationStatus: "VERIFIED" | "PENDING" | "REJECTED";
  imageUrl?: string | null;
}

export const REPORT_STATUSES = [
  "PENDING",
  "PROCESSING",
  "READY",
  "DELIVERED",
  "REJECTED",
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

export interface DiagnosticReport {
  id: string;
  patientId: string;
  patientName: string;
  centerId: string;
  centerName: string;
  testName: string;
  reportType: string;
  status: ReportStatus;
  referredBy: string | null;
  doctorName: string | null;
  collectedDate: string | null;
  deliveredDate: string | null;
  fileName: string | null;
  fileSize: number | null;
  summary: string | null;
  createdAt: string;
}

export const NOTIFICATION_TYPES = [
  "APPOINTMENT",
  "APPOINTMENT_REMINDER",
  "QUEUE_POSITION",
  "QUEUE_UPDATE",
  "ESTIMATE_UPDATE",
  "REPORT_READY",
  "SYSTEM",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  /** Optional deep link into the app. */
  href?: string | null;
}

/**
 * A generated case summary.
 *
 * `simulated` is `true` for the demo summaries the mock transport produces,
 * and `false` for the ones the real AI summary service returns. The field was
 * widened from the literal `true` so a real provider can be represented.
 */
export interface AiCaseSummary {
  id: string;
  patientId: string;
  generatedAt: string;
  /** True when the summary came from the demo script rather than the service. */
  simulated: boolean;
  headline: string;
  summary: string;
  keyFindings: string[];
  currentMedications: string[];
  allergies: string[];
  conditions: string[];
  recommendations: string[];
  reviewed: boolean;
  editedSummary: string | null;
}

/** One uploaded prescription or medical record. */
export interface AiDocument {
  id: string;
  patientId: string;
  filename: string;
  mime: string;
  bytes: number;
  sha256: string;
  note: string | null;
  /** "upload" for a file the patient sent, "import" for one pulled from the EMR. */
  source: string;
  /** The id this document has in the main MediQueue system. */
  externalId: string | null;
  uploadedAt: string;
  fileUrl: string;
}

/** A published paper the summary leans on. */
export interface AiCitation {
  id: string;
  summaryId: string;
  pmid: string | null;
  doi: string | null;
  pmcid: string | null;
  title: string;
  authors: string | null;
  journal: string | null;
  year: number | null;
  url: string | null;
  isOpenAccess: boolean;
  citedBy: number | null;
  why: string | null;
}

/** The vitals a document recorded. */
export interface AiVitals {
  bloodPressure?: string | null;
  temperature?: string | null;
  pulse?: string | null;
  heartRate?: string | null;
  weight?: string | null;
  spo2?: string | null;
  oxygenSaturation?: string | null;
}

/** One entry in the patient's running timeline. */
export interface AiTimelineEntry {
  summaryId: string;
  documentId: string;
  filename: string;
  uploadedAt: string;
  headline: string;
  summary: string;
  originalSummary: string;
  keyFindings: string[];
  medications: string[];
  allergies: string[];
  conditions: string[];
  recommendations: string[];
  vitals: AiVitals;
  advice: string | null;
  followUp: string | null;
  provider: string | null;
  model: string | null;
  confidence: number | null;
  needsReview: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  citations: AiCitation[];
}

/** The cumulative history — the side note on the patient's profile. */
export interface AiHistory {
  headline: string;
  summary: string;
  timeline: AiTimelineEntry[];
  generatedAt?: string;
}

/** The structured clinical data the AI read out of one document. */
export interface AiStructuredData {
  diagnoses: { name: string; term: string; code?: string }[];
  medicines: {
    name: string;
    dose: string;
    frequency: string;
    duration: string;
    instructions: string | null;
  }[];
  allergies: string[];
  vitals: AiVitals;
  advice: string | null;
  followUpDate: string | null;
  doctorName: string | null;
  notes: string[];
}

/** One document, with the summary the service built from it. */
export interface AiDocumentDetail {
  document: AiDocument;
  summary: AiCaseSummary | null;
  citations: AiCitation[];
  extraction: {
    id: string;
    provider: string;
    model: string | null;
    status: string;
    error: string | null;
    confidence: number | null;
    duration_ms: number | null;
    created_at: string;
  } | null;
}

/** The result of uploading one or more documents. */
export interface AiUploadResult {
  uploaded: { document: AiDocument; duplicate: boolean }[];
  results: {
    document: AiDocument;
    summary: AiCaseSummary | null;
    citations: AiCitation[];
    error?: string;
  }[];
  history: AiHistory;
}

/** The payload that folds the AI findings into the medical record. */
export interface AiEmrExport {
  target: string;
  patientId: string;
  externalPatientId: string | null;
  summaryId: string;
  documentId: string;
  generatedAt: string;
  summary: {
    headline: string;
    text: string;
    keyFindings: string[];
    recommendations: string[];
    advice: string | null;
    followUp: string | null;
    needsReview: boolean;
    reviewedBy: string | null;
    reviewedAt: string | null;
    provider: string | null;
    model: string | null;
    confidence: number | null;
  };
  conditions: {
    name: string;
    code: string | null;
    status: string;
    diagnosedAt: string;
    notes: string;
  }[];
  allergies: {
    substance: string;
    reaction: string;
    severity: string;
    recordedAt: string;
    recordedBy: string;
  }[];
  prescriptions: {
    date: string;
    doctorName: string | null;
    advice: string;
    notes: string;
    items: {
      medicine: string;
      dose: string;
      frequency: string;
      duration: string;
      instructions: string | null;
    }[];
  }[];
  records: {
    date: string;
    visitType: string;
    chiefComplaint: string;
    diagnosis: string;
    notes: string;
    vitals: {
      bloodPressure: string | null;
      temperature: string | null;
      pulse: string | null;
      weight: string | null;
      spo2: string | null;
    };
    documentName: string | null;
    documentSize: number | null;
  }[];
}

/** The merged export for a whole patient. */
export interface AiEmrExportBundle {
  status: string;
  exported: number;
  payload: {
    target: string;
    patientId: string;
    externalPatientId: string | null;
    conditions: AiEmrExport["conditions"];
    allergies: AiEmrExport["allergies"];
    prescriptions: AiEmrExport["prescriptions"];
    records: AiEmrExport["records"];
    summary: AiEmrExport["summary"] | null;
  };
  /** The outcome of the server-to-server delivery, when there was one. */
  push?: {
    status: "pushed" | "failed" | "skipped";
    detail: string;
    result: unknown;
  };
}

/** What the main API files when the AI payload is synced into the record. */
export interface EmrSyncResult {
  patientId: string;
  /** How many rows were added — the rest were already on file. */
  created: {
    conditions: number;
    allergies: number;
    prescriptions: number;
    records: number;
  };
  /** How many were already on file and were left alone. */
  skipped: {
    conditions: number;
    allergies: number;
    prescriptions: number;
    records: number;
  };
  /** The summary that was filed on the profile. */
  summary: {
    headline: string;
    text: string;
    needsReview: boolean;
    provider: string | null;
    model: string | null;
    confidence: number | null;
  } | null;
  message: string;
}

/** What the service reports about itself. */
export interface AiServiceHealth {
  status: string;
  service: string;
  database: "sqlite" | "mysql";
  provider: {
    active: string;
    model: string;
    mode: string;
    note: string;
  };
  literature: { enabled: boolean; sources: string[] };
  limits: {
    maxUploadBytes: number;
    maxDocumentsPerPatient: number;
    extractConcurrency: number;
  };
}

export interface QueueSnapshot {
  doctorId: string;
  date: string;
  /** Minutes since midnight. */
  currentMinute: number;
  currentPatientId: string | null;
  entries: QueueEntry[];
}

export interface QueueEntry {
  appointmentId: string;
  /** The patient's user id — how a patient recognises their own entry. */
  patientId: string;
  patientName: string;
  tokenNumber: number;
  queuePosition: number;
  status: string;
  checkedInAt: number | null;
  estimatedConsultationStart: number | null;
  estimatedWaitingMinutes: number | null;
  recommendedArrivalTime: number | null;
  arrivalDeadline: number | null;
  recommendedDepartureTime: number | null;
  estimatedTravelMinutes: number | null;
  isProvisional: boolean;
  estimateReasons: string[];
  arrivalRequestSentAt: number | null;
  lateMarkedAt: number | null;
  noShowAt: number | null;
  consultationStartedAt: number | null;
  consultationCompletedAt: number | null;
  predictedConsultationMinutes: number | null;
}

export interface QueueEvent {
  id: string;
  doctorId: string | null;
  patientId: string | null;
  patientName: string | null;
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
  createdAt: string;
}

export interface HospitalStaff {
  id: string;
  hospitalId: string;
  name: string;
  email: string;
  phone: string;
  role: "Receptionist" | "Nurse" | "Administrator" | "Pharmacist";
  shift: string;
  active: boolean;
  joinedAt: string;
}

export interface SystemSettings {
  appointmentLeadDays: number;
  slotDurationMinutes: number;
  arrivalBufferMinutes: number;
  gracePeriodMinutes: number;
  noShowAfterGraceMinutes: number;
  targetReadyPatients: number;
  latePenaltyPolicy: "MOVE_BEHIND_CHECKED_IN" | "KEEP_POSITION" | "MARK_NO_SHOW";
  atHomeOrderingRule: "TOKEN" | "READY_TIME";
  durationStrategy: "MEDIAN" | "AVERAGE";
  notificationLeadMinutes: number;
  historyWindow: number;
  maintenanceMode: boolean;
  allowRegistration: boolean;
}

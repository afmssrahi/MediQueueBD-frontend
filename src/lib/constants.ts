/**
 * Application-wide constants.
 *
 * Anything that is referenced by more than one feature lives here so the value
 * is defined once. Demo-specific numbers are grouped under `DEMO`.
 */

export const APP_NAME = "MediQueue BD";
export const APP_TAGLINE = "Smart appointments, queues and waiting times";

/** The versioned key of the persisted demo database. Bump on schema change. */
export const DEMO_DB_STORAGE_KEY = "mediqueue.db.v1";

/** The versioned key of the persisted client session. */
export const SESSION_STORAGE_KEY = "mediqueue.session.v1";

/** The versioned key of the persisted UI preferences. */
export const UI_STORAGE_KEY = "mediqueue.ui.v1";

/** localStorage key for the "remember me" flag on the login form. */
export const REMEMBER_ME_STORAGE_KEY = "mediqueue.remember.v1";

export const DEMO = {
  /** Simulated network latency range for the mock transport, in milliseconds. */
  LATENCY_MIN_MS: 180,
  LATENCY_MAX_MS: 520,
  /** Password used by every demo account. */
  PASSWORD: "demo1234",
} as const;

export const DIVISIONS = [
  "Dhaka",
  "Chattogram",
  "Rajshahi",
  "Khulna",
  "Barishal",
  "Sylhet",
  "Rangpur",
  "Mymensingh",
  "Bogura",
] as const;

export const SPECIALITIES = [
  "General Medicine",
  "Cardiology",
  "Orthopaedics",
  "Gynaecology & Obstetrics",
  "Paediatrics",
  "Dermatology",
  "Neurology",
  "Gastroenterology",
  "Pulmonology",
  "Endocrinology",
  "Nephrology",
  "ENT",
  "Ophthalmology",
  "Dermatology & Venereology",
  "Psychiatry",
  "Urology",
] as const;

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export const GENDERS = ["Male", "Female", "Other"] as const;

export const APPOINTMENT_TYPES = ["New", "Follow-up", "Emergency"] as const;

export const REPORT_TYPES = [
  "Blood Test",
  "X-Ray",
  "Ultrasound",
  "ECG",
  "CT Scan",
  "MRI",
  "Urine Test",
  "Pathology",
] as const;

export const TIMEZONE_LABEL = "Asia/Dhaka";

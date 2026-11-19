import { format, parseISO } from "date-fns";
import { addDaysIso } from "@/lib/format";
import type {
  AiCaseSummary,
  Allergy,
  AppNotification,
  Appointment,
  AppointmentStatus,
  Condition,
  DiagnosticReport,
  MedicalRecord,
  Prescription,
  QueueEntry,
  QueueEvent,
  QueueSnapshot,
  SystemSettings,
} from "@/types";
import { CENTERS, DEPARTMENTS, DOCTORS, HOSPITALS, USERS } from "./entities";

/**
 * Clinical seed data.
 *
 * Appointments are generated relative to today so the demo always shows a
 * live "current" queue, some history and some future bookings.
 */

export const TODAY = format(new Date(), "yyyy-MM-dd");

/** The demo queue rules — the same values the queue engine uses. */
export const DEFAULT_SETTINGS: SystemSettings = {
  appointmentLeadDays: 14,
  slotDurationMinutes: 15,
  arrivalBufferMinutes: 10,
  gracePeriodMinutes: 5,
  noShowAfterGraceMinutes: 15,
  targetReadyPatients: 2,
  latePenaltyPolicy: "MOVE_BEHIND_CHECKED_IN",
  atHomeOrderingRule: "TOKEN",
  durationStrategy: "MEDIAN",
  notificationLeadMinutes: 15,
  historyWindow: 10,
  maintenanceMode: false,
  allowRegistration: true,
};

const PATIENT_IDS = ["U101", "U102", "U103", "U104", "U105", "U106", "U107", "U108"];

function patientName(id: string): string {
  return USERS.find((user) => user.id === id)?.name ?? "Patient";
}

function doctorById(id: string) {
  const doctor = DOCTORS.find((item) => item.id === id);
  if (!doctor) throw new Error(`Unknown doctor ${id}`);
  return doctor;
}

function departmentForDoctor(doctorId: string) {
  const doctor = doctorById(doctorId);
  return DEPARTMENTS.find((item) => item.id === doctor.departmentIds[0]) ?? null;
}

function hospitalForDoctor(doctorId: string) {
  const doctor = doctorById(doctorId);
  return HOSPITALS.find((item) => item.id === doctor.hospitalIds[0]) ?? null;
}

/**
 * Build the appointment list.
 *
 * Each doctor gets a run of appointments across yesterday, today and the
 * coming week, so every dashboard has something to show.
 */
export function buildAppointments(): Appointment[] {
  const appointments: Appointment[] = [];
  let counter = 1000;

  // Token numbers are per doctor per day: a patient is token 1 for one
  // doctor on one date. The counter is keyed the same way so a doctor who
  // sees twenty patients numbers them 1…20, not 61…80.
  const tokenCounters = new Map<string, number>();

  const nextTokenNumber = (doctorId: string, date: string): number => {
    const key = `${doctorId}::${date}`;
    const next = (tokenCounters.get(key) ?? 0) + 1;
    tokenCounters.set(key, next);
    return next;
  };

  const push = (
    doctorId: string,
    patientId: string,
    date: string,
    startMinute: number,
    status: AppointmentStatus,
    options: Partial<Appointment> = {},
  ) => {
    const doctor = doctorById(doctorId);
    const hospital = hospitalForDoctor(doctorId);
    const department = departmentForDoctor(doctorId);
    counter += 1;

    appointments.push({
      id: `AP${counter}`,
      patientId,
      patientName: patientName(patientId),
      doctorId,
      doctorName: doctor.name,
      hospitalId: hospital?.id ?? "H001",
      hospitalName: hospital?.name ?? "MediQueue City Hospital",
      departmentId: department?.id ?? null,
      date,
      startMinute,
      endMinute: startMinute + doctor.defaultConsultationDuration,
      type: options.type ?? "New",
      reason: options.reason ?? "General consultation",
      status,
      tokenNumber: nextTokenNumber(doctorId, date),
      fee: doctor.consultationFee,
      paymentMethod: options.paymentMethod ?? "Bkash",
      isPaid: options.isPaid ?? true,
      createdAt: new Date(
        parseISO(date).getTime() - 3 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      cancelledAt: options.cancelledAt ?? null,
      cancelReason: options.cancelReason ?? null,
      notes: options.notes ?? null,
    });
  };

  // ── Yesterday: completed history ─────────────────────────────────────
  DOCTORS.forEach((doctor, doctorIndex) => {
    for (let index = 0; index < 4; index += 1) {
      const patientId = PATIENT_IDS[(doctorIndex + index) % PATIENT_IDS.length];
      push(
        doctor.id,
        patientId,
        addDaysIso(TODAY, -1),
        doctor.sessionStart + index * 30,
        "COMPLETED",
        { type: index % 2 === 0 ? "Follow-up" : "New" },
      );
    }
  });

  // ── Today: the live queue ────────────────────────────────────────────
  // Dr Ayesha Rahman runs the busiest list — the queue board opens on her.
  push("D001", "U101", TODAY, 9 * 60 + 30, "COMPLETED", {
    reason: "Follow-up for hypertension",
    type: "Follow-up",
  });
  push("D001", "U102", TODAY, 9 * 60 + 45, "IN_CONSULTATION", {
    reason: "Persistent cough for two weeks",
  });
  push("D001", "U103", TODAY, 10 * 60, "WAITING", {
    reason: "Chest discomfort on exertion",
  });
  push("D001", "U104", TODAY, 10 * 60 + 15, "CHECKED_IN", {
    reason: "Routine diabetes review",
    type: "Follow-up",
  });
  push("D001", "U107", TODAY, 10 * 60 + 45, "BOOKED", {
    reason: "Fever and body ache",
  });
  push("D001", "U108", TODAY, 11 * 60, "BOOKED", {
    reason: "Headache and dizziness",
  });

  push("D002", "U101", TODAY, 10 * 60, "IN_CONSULTATION", {
    reason: "ECG review and medication adjustment",
    type: "Follow-up",
  });
  push("D002", "U105", TODAY, 10 * 60 + 30, "WAITING", {
    reason: "Palpitations and breathlessness",
  });
  push("D002", "U103", TODAY, 11 * 60, "BOOKED", {
    reason: "Blood pressure check",
  });

  push("D003", "U106", TODAY, 12 * 60, "BOOKED", {
    reason: "Knee pain after injury",
  });
  push("D003", "U104", TODAY, 12 * 60 + 30, "BOOKED", {
    reason: "Lower back pain",
  });

  push("D004", "U102", TODAY, 9 * 60 + 30, "COMPLETED", {
    reason: "Child vaccination schedule",
    type: "Follow-up",
  });
  push("D004", "U107", TODAY, 9 * 60 + 45, "WAITING", {
    reason: "Recurrent fever in a child",
  });

  push("D005", "U106", TODAY, 11 * 60, "BOOKED", {
    reason: "Antenatal check-up",
    type: "Follow-up",
  });
  push("D008", "U104", TODAY, 17 * 60, "BOOKED", {
    reason: "Acid reflux",
  });
  push("D010", "U101", TODAY, 9 * 60 + 30, "WAITING", {
    reason: "Chronic kidney disease review",
    type: "Follow-up",
  });
  push("D011", "U108", TODAY, 14 * 60, "BOOKED", {
    reason: "Recurring migraines",
  });
  push("D013", "U105", TODAY, 8 * 60 + 30, "BOOKED", {
    reason: "General check-up",
  });

  // ── Tomorrow and the week ahead ──────────────────────────────────────
  const upcomingDates = [1, 2, 3, 5, 7, 10, 14];

  upcomingDates.forEach((daysAhead, index) => {
    const date = addDaysIso(TODAY, daysAhead);
    const doctor = DOCTORS[index % DOCTORS.length];
    const patientId = PATIENT_IDS[(index * 3) % PATIENT_IDS.length];
    const startMinute = doctor.sessionStart + (index % 4) * 30;

    push(doctor.id, patientId, date, startMinute, "CONFIRMED", {
      reason: "Scheduled consultation",
      type: index % 3 === 0 ? "Follow-up" : "New",
    });
  });

  // One cancelled appointment so the history screen shows every status.
  push("D013", "U107", addDaysIso(TODAY, -2), 10 * 60, "CANCELLED", {
    cancelReason: "Patient could not attend",
    cancelledAt: new Date(parseISO(addDaysIso(TODAY, -3)).getTime()).toISOString(),
    isPaid: false,
  });

  return appointments;
}

/** Seed medical records. */
export function buildRecords(): MedicalRecord[] {
  const records: MedicalRecord[] = [];
  let counter = 500;

  const push = (
    patientId: string,
    doctorId: string,
    date: string,
    data: Partial<MedicalRecord> = {},
  ) => {
    const doctor = doctorById(doctorId);
    const hospital = hospitalForDoctor(doctorId);
    counter += 1;
    records.push({
      id: `MR${counter}`,
      patientId,
      doctorId,
      doctorName: doctor.name,
      hospitalId: hospital?.id ?? "H001",
      date,
      visitType: data.visitType ?? "New",
      chiefComplaint:
        data.chiefComplaint ?? "General consultation for routine review",
      diagnosis: data.diagnosis ?? "Essential hypertension — stable",
      notes: data.notes ?? "Continue current medication. Review in one month.",
      vitals: data.vitals ?? {
        bloodPressure: "130/85",
        temperature: "36.8 °C",
        pulse: "78 bpm",
        weight: "68 kg",
        spo2: "98%",
      },
      documentName: data.documentName ?? null,
      documentSize: data.documentSize ?? null,
      createdAt: new Date(parseISO(date).getTime()).toISOString(),
      updatedAt: new Date(parseISO(date).getTime()).toISOString(),
    });
  };

  push("U101", "D001", addDaysIso(TODAY, -30), {
    chiefComplaint: "Routine blood pressure review",
    diagnosis: "Essential hypertension — controlled",
    notes: "Continue Amlodipine 5 mg once daily. Lifestyle counselling given.",
    visitType: "Follow-up",
  });
  push("U101", "D010", addDaysIso(TODAY, -12), {
    chiefComplaint: "Reduced urine output, swelling of ankles",
    diagnosis: "Chronic kidney disease, stage 2",
    notes: "Renal function tests ordered. Advised low-salt diet.",
  });
  push("U101", "D001", addDaysIso(TODAY, -1), {
    chiefComplaint: "Blood pressure check",
    diagnosis: "Essential hypertension — controlled",
    notes: "Reading 128/82. Continue current regimen.",
    visitType: "Follow-up",
  });

  push("U102", "D004", addDaysIso(TODAY, -20), {
    chiefComplaint: "Fever with rash in a 4-year-old child",
    diagnosis: "Viral fever with exanthem",
    notes: "Paracetamol advised. Review if the rash spreads.",
    visitType: "New",
  });
  push("U102", "D001", addDaysIso(TODAY, -1), {
    chiefComplaint: "Persistent cough for two weeks",
    diagnosis: "Upper respiratory tract infection",
    notes: "No chest X-ray indicated at this stage. Adequate hydration advised.",
  });

  push("U103", "D002", addDaysIso(TODAY, -25), {
    chiefComplaint: "Chest pain on exertion",
    diagnosis: "Stable angina — awaiting stress test",
    notes: "ECG recorded. Aspirin 75 mg daily advised.",
  });
  push("U103", "D010", addDaysIso(TODAY, -8), {
    chiefComplaint: "Breathlessness on climbing stairs",
    diagnosis: "Mild anaemia — iron deficiency suspected",
    notes: "Haemoglobin 9.8 g/dL. Started on oral iron.",
  });

  push("U104", "D003", addDaysIso(TODAY, -18), {
    chiefComplaint: "Lower back pain after lifting a heavy bag",
    diagnosis: "Lumbar muscle strain",
    notes: "Rest, warm compress and physiotherapy referral given.",
  });
  push("U104", "D009", addDaysIso(TODAY, -6), {
    chiefComplaint: "Itchy rash on both forearms",
    diagnosis: "Contact dermatitis",
    notes: "Topical steroid advised. Avoid suspected irritant.",
  });

  push("U105", "D013", addDaysIso(TODAY, -40), {
    chiefComplaint: "General weakness and fatigue",
    diagnosis: "Iron deficiency anaemia",
    notes: "Haemoglobin 10.2 g/dL. Started on oral iron.",
  });

  push("U106", "D005", addDaysIso(TODAY, -14), {
    chiefComplaint: "Antenatal check-up — 24 weeks",
    diagnosis: "Normal pregnancy, first trimester screening normal",
    notes: "Blood pressure and weight normal. Next visit in four weeks.",
    visitType: "Follow-up",
  });

  push("U107", "D001", addDaysIso(TODAY, -9), {
    chiefComplaint: "Intermittent fever for five days",
    diagnosis: "Enteric fever — suspected",
    notes: "Blood culture sent. Started on empirical antibiotics.",
  });

  push("U108", "D011", addDaysIso(TODAY, -16), {
    chiefComplaint: "Recurring unilateral headache with nausea",
    diagnosis: "Migraine without aura",
    notes: "Acute and prophylaxis therapy discussed. Sleep hygiene advised.",
  });

  return records;
}

/** Seed prescriptions. */
export function buildPrescriptions(): Prescription[] {
  const prescriptions: Prescription[] = [];
  let counter = 700;

  const push = (
    patientId: string,
    doctorId: string,
    date: string,
    items: Prescription["items"],
    advice: string,
    appointmentId: string | null = null,
  ) => {
    const doctor = doctorById(doctorId);
    counter += 1;
    prescriptions.push({
      id: `PR${counter}`,
      patientId,
      appointmentId,
      doctorId,
      doctorName: doctor.name,
      date,
      items,
      advice,
      notes: null,
    });
  };

  push(
    "U101",
    "D001",
    addDaysIso(TODAY, -30),
    [
      { id: "I1", medicine: "Amlodipine", dose: "5 mg", frequency: "Once daily", duration: "30 days", instructions: "Take in the morning" },
      { id: "I2", medicine: "Losartan", dose: "50 mg", frequency: "Once daily", duration: "30 days", instructions: "Take after food" },
    ],
    "Reduce salt intake to under 5 g per day. Walk 30 minutes daily.",
  );
  push(
    "U101",
    "D010",
    addDaysIso(TODAY, -12),
    [
      { id: "I1", medicine: "Sevelamer Carbonate", dose: "400 mg", frequency: "Three times daily", duration: "14 days", instructions: "Take with meals" },
    ],
    "Avoid NSAIDs. Drink at least two litres of water daily.",
  );

  push(
    "U102",
    "D001",
    addDaysIso(TODAY, -1),
    [
      { id: "I1", medicine: "Azithromycin", dose: "500 mg", frequency: "Once daily", duration: "3 days", instructions: "Take on an empty stomach" },
      { id: "I2", medicine: "Cetirizine", dose: "10 mg", frequency: "Once at night", duration: "5 days", instructions: "May cause drowsiness" },
    ],
    "Complete the antibiotic course. Seek care if the fever persists beyond three days.",
  );

  push(
    "U103",
    "D002",
    addDaysIso(TODAY, -25),
    [
      { id: "I1", medicine: "Aspirin", dose: "75 mg", frequency: "Once daily", duration: "30 days", instructions: "Take after food" },
      { id: "I2", medicine: "Atorvastatin", dose: "20 mg", frequency: "Once at night", duration: "30 days", instructions: "" },
    ],
    "Report any new chest discomfort immediately.",
  );

  push(
    "U103",
    "D010",
    addDaysIso(TODAY, -8),
    [
      { id: "I1", medicine: "Ferrous Sulphate", dose: "200 mg", frequency: "Twice daily", duration: "30 days", instructions: "Take with vitamin C" },
    ],
    "Expect dark stools. Recheck haemoglobin after one month.",
  );

  push(
    "U104",
    "D009",
    addDaysIso(TODAY, -6),
    [
      { id: "I1", medicine: "Mometasone Cream", dose: "0.1%", frequency: "Twice daily", duration: "7 days", instructions: "Apply to the affected area" },
      { id: "I2", medicine: "Cetirizine", dose: "10 mg", frequency: "Once at night", duration: "7 days", instructions: "" },
    ],
    "Keep the area dry and avoid scratching.",
  );

  push(
    "U105",
    "D013",
    addDaysIso(TODAY, -40),
    [
      { id: "I1", medicine: "Ferrous Sulphate", dose: "200 mg", frequency: "Twice daily", duration: "60 days", instructions: "Take after food" },
    ],
    "Increase iron-rich foods. Review after two months.",
  );

  push(
    "U106",
    "D005",
    addDaysIso(TODAY, -14),
    [
      { id: "I1", medicine: "Ferrous Sulphate", dose: "200 mg", frequency: "Once daily", duration: "30 days", instructions: "Take after food" },
      { id: "I2", medicine: "Folic Acid", dose: "5 mg", frequency: "Once daily", duration: "30 days", instructions: "" },
    ],
    "Return immediately for bleeding, severe headache or reduced fetal movement.",
  );

  push(
    "U107",
    "D001",
    addDaysIso(TODAY, -9),
    [
      { id: "I1", medicine: "Cefixime", dose: "200 mg", frequency: "Twice daily", duration: "7 days", instructions: "Take after food" },
    ],
    "Drink plenty of fluids. Return if the fever continues after three days.",
  );

  push(
    "U108",
    "D011",
    addDaysIso(TODAY, -16),
    [
      { id: "I1", medicine: "Sumatriptan", dose: "50 mg", frequency: "As needed at onset", duration: "3 months", instructions: "Maximum 2 tablets in 24 hours" },
      { id: "I2", medicine: "Propranolol", dose: "40 mg", frequency: "Twice daily", duration: "3 months", instructions: "Do not stop abruptly" },
    ],
    "Maintain a headache diary. Avoid bright screens before sleep.",
  );

  return prescriptions;
}

/** Seed allergies. */
export function buildAllergies(): Allergy[] {
  return [
    {
      id: "AL001",
      patientId: "U101",
      substance: "Penicillin",
      reaction: "Skin rash and swelling",
      severity: "Severe",
      recordedAt: addDaysIso(TODAY, -120),
      recordedBy: "Dr. Ayesha Rahman",
    },
    {
      id: "AL002",
      patientId: "U102",
      substance: "Pollen",
      reaction: "Sneezing and watery eyes",
      severity: "Mild",
      recordedAt: addDaysIso(TODAY, -90),
      recordedBy: "Dr. Mahfuzur Rahman",
    },
    {
      id: "AL003",
      patientId: "U103",
      substance: "Aspirin",
      reaction: "Stomach bleeding",
      severity: "Severe",
      recordedAt: addDaysIso(TODAY, -200),
      recordedBy: "Dr. Imran Chowdhury",
    },
    {
      id: "AL004",
      patientId: "U104",
      substance: "Latex",
      reaction: "Contact dermatitis",
      severity: "Moderate",
      recordedAt: addDaysIso(TODAY, -150),
      recordedBy: "Dr. Sadia Afreen",
    },
    {
      id: "AL005",
      patientId: "U106",
      substance: "Shellfish",
      reaction: "Urticaria",
      severity: "Moderate",
      recordedAt: addDaysIso(TODAY, -60),
      recordedBy: "Dr. Nusrat Jahan",
    },
  ];
}

/** Seed chronic conditions. */
export function buildConditions(): Condition[] {
  return [
    {
      id: "CN001",
      patientId: "U101",
      name: "Essential hypertension",
      code: "I10",
      diagnosedAt: addDaysIso(TODAY, -400),
      status: "Chronic",
      notes: "Controlled on antihypertensives.",
    },
    {
      id: "CN002",
      patientId: "U101",
      name: "Chronic kidney disease, stage 2",
      code: "N18.2",
      diagnosedAt: addDaysIso(TODAY, -365),
      status: "Active",
      notes: "Monitored every three months.",
    },
    {
      id: "CN003",
      patientId: "U102",
      name: "Type 2 diabetes mellitus",
      code: "E11",
      diagnosedAt: addDaysIso(TODAY, -300),
      status: "Chronic",
      notes: "Controlled with metformin.",
    },
    {
      id: "CN004",
      patientId: "U103",
      name: "Stable angina",
      code: "I20",
      diagnosedAt: addDaysIso(TODAY, -240),
      status: "Active",
      notes: "Stress test pending.",
    },
    {
      id: "CN005",
      patientId: "U105",
      name: "Iron deficiency anaemia",
      code: "D50.9",
      diagnosedAt: addDaysIso(TODAY, -180),
      status: "Active",
      notes: "On oral iron.",
    },
    {
      id: "CN006",
      patientId: "U108",
      name: "Migraine without aura",
      code: "G43.0",
      diagnosedAt: addDaysIso(TODAY, -500),
      status: "Chronic",
      notes: "Prophylaxis therapy in place.",
    },
  ];
}

/** Seed diagnostic reports. */
export function buildReports(): DiagnosticReport[] {
  const reports: DiagnosticReport[] = [];
  let counter = 900;

  const push = (
    patientId: string,
    centerId: string,
    testName: string,
    reportType: string,
    status: DiagnosticReport["status"],
    date: string,
    summary: string | null,
    referredBy: string | null,
  ) => {
    const center = CENTERS.find((item) => item.id === centerId);
    counter += 1;
    reports.push({
      id: `RP${counter}`,
      patientId,
      patientName: patientName(patientId),
      centerId,
      centerName: center?.name ?? "MediQueue Dhanmondi Diagnostic Lab",
      testName,
      reportType,
      status,
      referredBy,
      doctorName: referredBy,
      collectedDate: date,
      deliveredDate:
        status === "DELIVERED" || status === "READY"
          ? addDaysIso(date, 1)
          : null,
      fileName: `${testName.replace(/\s+/g, "-").toLowerCase()}-${patientId}.pdf`,
      fileSize: 180000 + counter * 1200,
      summary,
      createdAt: new Date(parseISO(date).getTime()).toISOString(),
    });
  };

  push("U101", "DC001", "Complete Blood Count", "Blood Test", "DELIVERED", addDaysIso(TODAY, -14), "Haemoglobin 12.8 g/dL. WBC 6,400/µL. Platelets 240,000/µL. Within normal limits.", "Dr. Ayesha Rahman");
  push("U101", "DC001", "Renal Function Test", "Blood Test", "DELIVERED", addDaysIso(TODAY, -13), "Serum creatinine 1.4 mg/dL, eGFR 58 mL/min. Mildly reduced.", "Dr. Habibur Rahman");
  push("U101", "DC002", "Ultrasound of Abdomen", "Ultrasound", "READY", addDaysIso(TODAY, -2), "Both kidneys normal in size and echogenicity. No calculus. Mild hydronephrosis on the left.", "Dr. Habibur Rahman");
  push("U101", "DC001", "Lipid Profile", "Blood Test", "PROCESSING", TODAY, null, "Dr. Ayesha Rahman");

  push("U102", "DC003", "Blood Sugar (Fasting)", "Blood Test", "DELIVERED", addDaysIso(TODAY, -10), "Fasting blood sugar 7.8 mmol/L. Raised.", "Dr. Ayesha Rahman");
  push("U102", "DC005", "Urine R/E", "Urine Test", "DELIVERED", addDaysIso(TODAY, -10), "Pus cells 6–8/HPF. Nitrite positive. Suggestive of urinary infection.", "Dr. Ayesha Rahman");

  push("U103", "DC001", "ECG", "ECG", "DELIVERED", addDaysIso(TODAY, -25), "Sinus rhythm. ST depression 1 mm in lead V4. No acute changes.", "Dr. Imran Chowdhury");
  push("U103", "DC002", "Chest X-Ray", "X-Ray", "DELIVERED", addDaysIso(TODAY, -25), "Cardiothoracic ratio within normal limits. Lungs clear.", "Dr. Imran Chowdhury");
  push("U103", "DC001", "Lipid Profile", "Blood Test", "DELIVERED", addDaysIso(TODAY, -24), "Total cholesterol 232 mg/dL, LDL 158 mg/dL. Elevated.", "Dr. Imran Chowdhury");

  push("U104", "DC003", "Complete Blood Count", "Blood Test", "DELIVERED", addDaysIso(TODAY, -6), "Haemoglobin 9.8 g/dL. Microcytic hypochromic picture.", "Dr. Sadia Afreen");
  push("U104", "DC004", "Ultrasound of Abdomen", "Ultrasound", "PENDING", TODAY, null, null);

  push("U105", "DC006", "Complete Blood Count", "Blood Test", "DELIVERED", addDaysIso(TODAY, -40), "Haemoglobin 10.2 g/dL. Mild anaemia.", "Dr. Rokeya Sultana");
  push("U105", "DC001", "Thyroid Profile", "Blood Test", "PROCESSING", addDaysIso(TODAY, -1), null, "Dr. Rokeya Sultana");

  push("U107", "DC001", "Blood Culture", "Pathology", "PROCESSING", addDaysIso(TODAY, -8), null, "Dr. Ayesha Rahman");
  push("U107", "DC005", "Complete Blood Count", "Blood Test", "READY", addDaysIso(TODAY, -2), "Haemoglobin 11.1 g/dL. WBC 9,800/µL.", "Dr. Ayesha Rahman");

  push("U106", "DC003", "Ultrasound of Abdomen", "Ultrasound", "DELIVERED", addDaysIso(TODAY, -14), "Single intrauterine gestation, 24 weeks, normal growth. Normal liquor volume.", "Dr. Nusrat Jahan");
  push("U108", "DC006", "Complete Blood Count", "Blood Test", "DELIVERED", addDaysIso(TODAY, -16), "Haemoglobin 13.4 g/dL. All other parameters within normal limits.", "Dr. Zarin Tasnim");

  return reports;
}

/** Seed notifications. */
export function buildNotifications(): AppNotification[] {
  const now = Date.now();
  const minutesAgo = (minutes: number) =>
    new Date(now - minutes * 60 * 1000).toISOString();

  return [
    {
      id: "NT001",
      userId: "U001",
      type: "QUEUE_POSITION",
      title: "You are next in the queue",
      body: "Dr. Ayesha Rahman has called token 12. Please proceed to room 204.",
      read: false,
      createdAt: minutesAgo(4),
      href: "/patient/queue",
    },
    {
      id: "NT002",
      userId: "U001",
      type: "APPOINTMENT_REMINDER",
      title: "Appointment tomorrow at 10:00",
      body: "Your appointment with Dr. Ayesha Rahman is tomorrow. Arrive 10 minutes early.",
      read: false,
      createdAt: minutesAgo(95),
      href: "/patient/appointments",
    },
    {
      id: "NT003",
      userId: "U001",
      type: "REPORT_READY",
      title: "Your ultrasound report is ready",
      body: "The abdominal ultrasound report from MediQueue Gulshan Imaging Centre is ready to view.",
      read: false,
      createdAt: minutesAgo(260),
      href: "/patient/reports",
    },
    {
      id: "NT004",
      userId: "U001",
      type: "ESTIMATE_UPDATE",
      title: "Your waiting time estimate changed",
      body: "The estimated start time moved because a patient ahead of you checked in.",
      read: true,
      createdAt: minutesAgo(310),
      href: "/patient/queue",
    },
    {
      id: "NT005",
      userId: "U003",
      type: "QUEUE_UPDATE",
      title: "Patient checked in",
      body: "A patient checked in at reception for Dr. Ayesha Rahman's list.",
      read: false,
      createdAt: minutesAgo(12),
      href: "/hospital/queue",
    },
    {
      id: "NT006",
      userId: "U003",
      type: "APPOINTMENT",
      title: "New appointment booked",
      body: "A new appointment was booked for Dr. Ayesha Rahman today at 10:45.",
      read: false,
      createdAt: minutesAgo(35),
      href: "/hospital/appointments",
    },
    {
      id: "NT007",
      userId: "U004",
      type: "SYSTEM",
      title: "Hospital verification complete",
      body: "MediQueue City Hospital has been verified. You can now publish doctor schedules.",
      read: true,
      createdAt: minutesAgo(1400),
      href: "/hospital/admin",
    },
    {
      id: "NT008",
      userId: "U005",
      type: "REPORT_READY",
      title: "New report received",
      body: "A Complete Blood Count report arrived for a walk-in patient.",
      read: false,
      createdAt: minutesAgo(48),
      href: "/diagnostic/reports",
    },
    {
      id: "NT009",
      userId: "U006",
      type: "SYSTEM",
      title: "New hospital registration",
      body: "MediQueue Mirpur Community Hospital submitted a registration request.",
      read: false,
      createdAt: minutesAgo(220),
      href: "/admin/hospitals",
    },
    {
      id: "NT010",
      userId: "U002",
      type: "QUEUE_UPDATE",
      title: "Two patients are waiting",
      body: "Two patients have checked in for your list this morning.",
      read: false,
      createdAt: minutesAgo(8),
      href: "/doctor/queue",
    },
  ];
}

/** Seed AI case summaries. */
export function buildSummaries(): AiCaseSummary[] {
  return [
    {
      id: "AS001",
      patientId: "U101",
      generatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      simulated: true,
      headline:
        "Two-year history of hypertension with early chronic kidney disease, currently stable on dual antihypertensive therapy.",
      summary:
        "Rumana Ahmed has been under care since 2025 for essential hypertension, controlled on amlodipine and losartan. A routine check in the past year identified stage 2 chronic kidney disease with an eGFR of 58 mL/min, and she was started on a phosphate binder with advice to avoid NSAIDs. Her most recent visit recorded a blood pressure of 128/82 and her renal function tests are pending. Her medical record also carries a severe penicillin allergy with rash and swelling, which should be checked before any prescription.",
      keyFindings: [
        "Blood pressure controlled on dual antihypertensive therapy (128/82 at the last visit)",
        "Chronic kidney disease stage 2 with eGFR 58 mL/min, monitored quarterly",
        "Severe penicillin allergy documented since 2025",
        "No hospital admissions recorded in the last twelve months",
      ],
      currentMedications: [
        "Amlodipine 5 mg — once daily",
        "Losartan 50 mg — once daily",
        "Sevelamer Carbonate 400 mg — three times daily with meals",
      ],
      allergies: ["Penicillin — skin rash and swelling (severe)"],
      conditions: ["Essential hypertension (chronic)", "Chronic kidney disease, stage 2 (active)"],
      recommendations: [
        "Review the pending lipid profile before the next appointment",
        "Continue the two-litre daily fluid intake advice",
        "Confirm renal function every three months",
      ],
      reviewed: false,
      editedSummary: null,
    },
    {
      id: "AS002",
      patientId: "U103",
      generatedAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
      simulated: true,
      headline:
        "Stable angina with raised cholesterol, under cardiology follow-up with a stress test pending.",
      summary:
        "Tanvir Ahmed was assessed in the past month for exertional chest pain. An ECG showed sinus rhythm with ST depression in lead V4 and the chest X-ray was clear. He was started on low-dose aspirin and atorvastatin, and a stress test has been requested. A later primary-care review found mild breathlessness on exertion and haemoglobin of 9.8 g/dL, prompting oral iron. His record notes a severe aspirin allergy with gastrointestinal bleeding, which contradicts the current aspirin advice and must be reviewed by the treating cardiologist.",
      keyFindings: [
        "Exertional chest pain with ST depression in V4 on ECG",
        "Aspirin allergy on record conflicts with the current aspirin prescription",
        "Mild iron deficiency anaemia (haemoglobin 9.8 g/dL)",
        "Lipid profile raised — total cholesterol 232 mg/dL, LDL 158 mg/dL",
      ],
      currentMedications: [
        "Aspirin 75 mg — once daily",
        "Atorvastatin 20 mg — once at night",
        "Ferrous Sulphate 200 mg — twice daily with vitamin C",
      ],
      allergies: ["Aspirin — stomach bleeding (severe)"],
      conditions: ["Stable angina (active)"],
      recommendations: [
        "Resolve the aspirin allergy conflict before the next dose",
        "Complete the pending stress test",
        "Repeat haemoglobin after one month of iron therapy",
      ],
      reviewed: true,
      editedSummary:
        "Tanvir Ahmed is under cardiology follow-up for exertional chest pain. An ECG showed ST depression in lead V4 and a chest X-ray was clear. He was started on low-dose aspirin and atorvastatin, and a stress test has been requested. A later primary-care review found mild breathlessness on exertion with haemoglobin of 9.8 g/dL, prompting oral iron. His record notes a severe aspirin allergy with gastrointestinal bleeding, which conflicts with the current aspirin prescription and must be reviewed by the treating cardiologist before the next dose.",
    },
  ];
}

/**
 * Seed the queue snapshots.
 *
 * The queue is stored per doctor for today, with the entries the doctor
 * board shows. The estimates are seeded rather than computed so the first
 * paint is immediate; the queue engine recomputes them on the first action.
 */
export function buildQueues(appointments: Appointment[]): QueueSnapshot[] {
  // The snapshot must reference today's real appointment ids, otherwise the
  // check-in times and arrival deadlines below are silently dropped when the
  // queue is rebuilt.
  const todayForDoctor = appointments.filter(
    (item) => item.doctorId === "D001" && item.date === TODAY,
  );

  const appointmentIdFor = (patientId: string): string =>
    todayForDoctor.find((item) => item.patientId === patientId)?.id ?? "";

  const entries: QueueEntry[] = [
    {
      appointmentId: appointmentIdFor("U102"),
      patientId: "U102",
      patientName: "Shirin Sultana",
      tokenNumber: 2,
      queuePosition: 1,
      status: "IN_CONSULTATION",
      checkedInAt: 9 * 60 + 58,
      estimatedConsultationStart: 10 * 60,
      estimatedWaitingMinutes: 0,
      recommendedArrivalTime: 9 * 60 + 50,
      arrivalDeadline: 9 * 60 + 50,
      recommendedDepartureTime: 9 * 60 + 30,
      estimatedTravelMinutes: 20,
      isProvisional: false,
      estimateReasons: ["CURRENT_CONSULTATION_RUNNING"],
      arrivalRequestSentAt: 8 * 60 + 30,
      lateMarkedAt: null,
      noShowAt: null,
      consultationStartedAt: 10 * 60,
      consultationCompletedAt: null,
      predictedConsultationMinutes: 12,
    },
    {
      appointmentId: appointmentIdFor("U103"),
      patientId: "U103",
      patientName: "Tanvir Ahmed",
      tokenNumber: 3,
      queuePosition: 2,
      status: "WAITING",
      checkedInAt: 9 * 60 + 55,
      estimatedConsultationStart: 10 * 60 + 12,
      estimatedWaitingMinutes: 12,
      recommendedArrivalTime: 10 * 60 + 2,
      arrivalDeadline: 10 * 60 + 2,
      recommendedDepartureTime: 9 * 60 + 47,
      estimatedTravelMinutes: 15,
      isProvisional: false,
      estimateReasons: [],
      arrivalRequestSentAt: 9 * 60,
      lateMarkedAt: null,
      noShowAt: null,
      consultationStartedAt: null,
      consultationCompletedAt: null,
      predictedConsultationMinutes: 12,
    },
    {
      appointmentId: appointmentIdFor("U104"),
      patientId: "U104",
      patientName: "Farzana Akter",
      tokenNumber: 4,
      queuePosition: 3,
      status: "CHECKED_IN",
      checkedInAt: 10 * 60 + 2,
      estimatedConsultationStart: 10 * 60 + 24,
      estimatedWaitingMinutes: 24,
      recommendedArrivalTime: 10 * 60 + 14,
      arrivalDeadline: 10 * 60 + 14,
      recommendedDepartureTime: 9 * 60 + 49,
      estimatedTravelMinutes: 25,
      isProvisional: false,
      estimateReasons: [],
      arrivalRequestSentAt: 9 * 60 + 30,
      lateMarkedAt: null,
      noShowAt: null,
      consultationStartedAt: null,
      consultationCompletedAt: null,
      predictedConsultationMinutes: 12,
    },
    {
      appointmentId: appointmentIdFor("U107"),
      patientId: "U107",
      patientName: "Imtiaz Hossain",
      tokenNumber: 5,
      queuePosition: 4,
      status: "BOOKED",
      checkedInAt: null,
      estimatedConsultationStart: 10 * 60 + 36,
      estimatedWaitingMinutes: 36,
      recommendedArrivalTime: 10 * 60 + 26,
      arrivalDeadline: null,
      recommendedDepartureTime: 10 * 60 + 26 - 35,
      estimatedTravelMinutes: 35,
      isProvisional: true,
      estimateReasons: ["AT_HOME_ARRIVAL_ASSUMED"],
      arrivalRequestSentAt: null,
      lateMarkedAt: null,
      noShowAt: null,
      consultationStartedAt: null,
      consultationCompletedAt: null,
      predictedConsultationMinutes: null,
    },
    {
      appointmentId: appointmentIdFor("U108"),
      patientId: "U108",
      patientName: "Nusima Khatun",
      tokenNumber: 6,
      queuePosition: 5,
      status: "BOOKED",
      checkedInAt: null,
      estimatedConsultationStart: 10 * 60 + 48,
      estimatedWaitingMinutes: 48,
      recommendedArrivalTime: 10 * 60 + 38,
      arrivalDeadline: null,
      recommendedDepartureTime: 10 * 60 + 38 - 20,
      estimatedTravelMinutes: 20,
      isProvisional: true,
      estimateReasons: ["AT_HOME_ARRIVAL_ASSUMED"],
      arrivalRequestSentAt: null,
      lateMarkedAt: null,
      noShowAt: null,
      consultationStartedAt: null,
      consultationCompletedAt: null,
      predictedConsultationMinutes: null,
    },
  ];

  return [
    {
      doctorId: "D001",
      date: TODAY,
      currentMinute: 10 * 60 + 8,
      currentPatientId: "U102",
      entries,
    },
  ];
}

/** Seed queue event history. */
export function buildQueueEvents(): QueueEvent[] {
  const base = Date.now();
  const at = (minutesAgo: number) =>
    new Date(base - minutesAgo * 60 * 1000).toISOString();

  return [
    {
      id: "QE001",
      doctorId: "D001",
      patientId: "U101",
      patientName: "Mahbubur Rahman",
      eventType: "CONSULTATION_COMPLETED",
      description: "Consultation completed with Mahbubur Rahman (token 01) after 12 min.",
      actor: "SYSTEM",
      previousStatus: "IN_CONSULTATION",
      newStatus: "COMPLETED",
      previousPosition: 1,
      newPosition: null,
      reason: null,
      reasons: ["PATIENT_COMPLETED"],
      minute: 9 * 60 + 42,
      createdAt: at(86),
    },
    {
      id: "QE002",
      doctorId: "D001",
      patientId: "U102",
      patientName: "Shirin Sultana",
      eventType: "CONSULTATION_STARTED",
      description: "Consultation started with Shirin Sultana (token 02).",
      actor: "Dr. Ayesha Rahman",
      previousStatus: "CALLED",
      newStatus: "IN_CONSULTATION",
      previousPosition: 1,
      newPosition: 1,
      reason: null,
      reasons: [],
      minute: 10 * 60,
      createdAt: at(8),
    },
    {
      id: "QE003",
      doctorId: "D001",
      patientId: "U104",
      patientName: "Farzana Akter",
      eventType: "CHECK_IN",
      description: "Farzana Akter (token 04) checked in at reception.",
      actor: "Jahangir Alam",
      previousStatus: "ARRIVAL_REQUESTED",
      newStatus: "WAITING",
      previousPosition: 4,
      newPosition: 3,
      reason: null,
      reasons: ["PATIENT_CHECKED_IN"],
      minute: 10 * 60 + 2,
      createdAt: at(6),
    },
    {
      id: "QE004",
      doctorId: "D001",
      patientId: "U107",
      patientName: "Imtiaz Hossain",
      eventType: "ESTIMATE_UPDATED",
      description: "Estimate for Imtiaz Hossain (token 05) updated.",
      actor: "SYSTEM",
      previousStatus: null,
      newStatus: null,
      previousPosition: 5,
      newPosition: 4,
      reason: null,
      reasons: ["QUEUE_REORDERED", "AT_HOME_ARRIVAL_ASSUMED"],
      minute: 10 * 60 + 8,
      createdAt: at(2),
    },
  ];
}

/** The demo accounts shown on the login screen. */
export const DEMO_ACCOUNTS = [
  {
    role: "PATIENT" as const,
    email: "patient@mediqueue.bd",
    name: "Rumana Ahmed",
    label: "Patient",
    labelBn: "রোগী",
  },
  {
    role: "DOCTOR" as const,
    email: "doctor@mediqueue.bd",
    name: "Dr. Ayesha Rahman",
    label: "Doctor",
    labelBn: "ডাক্তার",
  },
  {
    role: "HOSPITAL_STAFF" as const,
    email: "staff@mediqueue.bd",
    name: "Jahangir Alam",
    label: "Hospital staff",
    labelBn: "হাসপাতাল স্টাফ",
  },
  {
    role: "HOSPITAL_ADMIN" as const,
    email: "hospitaladmin@mediqueue.bd",
    name: "Shahnaz Parveen",
    label: "Hospital admin",
    labelBn: "হাসপাতাল প্রশাসক",
  },
  {
    role: "DIAGNOSTIC_STAFF" as const,
    email: "diagnostic@mediqueue.bd",
    name: "Kamrul Hasan",
    label: "Diagnostic staff",
    labelBn: "ডায়াগনস্টিক স্টাফ",
  },
  {
    role: "SYSTEM_ADMIN" as const,
    email: "admin@mediqueue.bd",
    name: "Nusrat Jahan",
    label: "System admin",
    labelBn: "সিস্টেম প্রশাসক",
  },
];

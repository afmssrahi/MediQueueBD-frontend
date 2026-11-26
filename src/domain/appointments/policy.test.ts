import { describe, expect, it } from "vitest";
import {
  DEFAULT_POLICY,
  canTransition,
  checkBookingAllowed,
  checkChangeAllowed,
  findDuplicateBooking,
  hasAppointmentStarted,
  isInsideChangeWindow,
  isLocked,
  isWithinBookingWindow,
  meetsMinimumNotice,
} from "@/domain/appointments/policy";
import type { Appointment } from "@/types";

/**
 * The appointment policy.
 *
 * The rules a clinic applies, tested on their own — no database, no
 * transport. The booking lifecycle itself is covered by `booking.test.ts`;
 * this file is about the rules in isolation.
 */

/** A booking, with the fields the policy reads. */
function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "AP1",
    patientId: "U001",
    patientName: "Rumana Ahmed",
    doctorId: "D001",
    doctorName: "Dr. Ayesha Rahman",
    hospitalId: "H001",
    hospitalName: "MediQueue City Hospital",
    departmentId: null,
    date: "2026-03-10",
    startMinute: 10 * 60,
    endMinute: 10 * 60 + 15,
    type: "New",
    reason: "A headache that has lasted two weeks",
    status: "CONFIRMED",
    tokenNumber: 3,
    fee: 800,
    paymentMethod: "Cash",
    isPaid: false,
    createdAt: "2026-03-01T08:30:00.000Z",
    cancelledAt: null,
    cancelReason: null,
    notes: null,
    ...overrides,
  };
}

/** A policy check for a booking that should be allowed. */
function allowBooking(
  overrides: Partial<Parameters<typeof checkBookingAllowed>[0]> = {},
) {
  return checkBookingAllowed({
    patientId: "U001",
    doctorId: "D001",
    date: "2026-03-10",
    startMinute: 10 * 60,
    appointments: [],
    isClinicDay: true,
    slotIsTaken: false,
    today: "2026-03-01",
    nowMinute: 9 * 60,
    settings: DEFAULT_POLICY,
    ...overrides,
  });
}

describe("the booking window", () => {
  it("allows a booking on the first day of the window", () => {
    expect(isWithinBookingWindow("2026-03-01", "2026-03-01", 14)).toBe(true);
  });

  it("allows a booking on the last day of the window", () => {
    expect(isWithinBookingWindow("2026-03-15", "2026-03-01", 14)).toBe(true);
  });

  it("refuses a booking the day after the window", () => {
    expect(isWithinBookingWindow("2026-03-16", "2026-03-01", 14)).toBe(false);
  });

  it("refuses a booking in the past", () => {
    expect(isWithinBookingWindow("2026-02-28", "2026-03-01", 14)).toBe(false);
  });
});

describe("the notice period", () => {
  it("allows a slot exactly the notice period away", () => {
    expect(
      meetsMinimumNotice("2026-03-01", 11 * 60, "2026-03-01", 9 * 60, 120),
    ).toBe(true);
  });

  it("refuses a slot inside the notice period", () => {
    expect(
      meetsMinimumNotice("2026-03-01", 10 * 60 + 59, "2026-03-01", 9 * 60, 120),
    ).toBe(false);
  });

  it("allows any slot on a later day", () => {
    expect(
      meetsMinimumNotice("2026-03-02", 9 * 60, "2026-03-01", 9 * 60, 120),
    ).toBe(true);
  });

  it("ignores the rule when the notice is zero", () => {
    expect(
      meetsMinimumNotice("2026-03-01", 9 * 60 + 1, "2026-03-01", 9 * 60, 0),
    ).toBe(true);
  });
});

describe("the booking check", () => {
  it("allows a booking that breaks no rule", () => {
    expect(allowBooking().allowed).toBe(true);
  });

  it("refuses a booking beyond the lead time", () => {
    const result = allowBooking({ date: "2026-04-01" });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.refusal.code).toBe("OUTSIDE_BOOKING_WINDOW");
      expect(result.refusal.field).toBe("date");
    }
  });

  it("refuses a booking on a day the doctor does not work", () => {
    const result = allowBooking({ isClinicDay: false });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.refusal.code).toBe("CLINIC_CLOSED");
    }
  });

  it("refuses a booking inside the notice period", () => {
    const result = allowBooking({
      date: "2026-03-01",
      startMinute: 10 * 60,
      nowMinute: 9 * 60 + 30,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.refusal.code).toBe("LEAD_TIME_NOT_MET");
      expect(result.refusal.field).toBe("startMinute");
    }
  });

  it("refuses a booking on a taken slot", () => {
    const result = allowBooking({ slotIsTaken: true });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.refusal.code).toBe("SLOT_TAKEN");
    }
  });

  it("refuses a second booking with the same doctor on the same day", () => {
    const existing = appointment({ id: "AP2", status: "CONFIRMED" });

    const result = allowBooking({ appointments: [existing] });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.refusal.code).toBe("DUPLICATE_BOOKING");
    }
  });

  it("allows a second booking with the same doctor on a different day", () => {
    const existing = appointment({
      id: "AP2",
      date: "2026-03-11",
      status: "CONFIRMED",
    });

    expect(allowBooking({ appointments: [existing] }).allowed).toBe(true);
  });

  it("ignores a cancelled booking when looking for a duplicate", () => {
    const existing = appointment({ id: "AP2", status: "CANCELLED" });

    expect(allowBooking({ appointments: [existing] }).allowed).toBe(true);
  });

  it("reports the taken slot before the duplicate booking", () => {
    const existing = appointment({ id: "AP2", status: "CONFIRMED" });

    const result = allowBooking({
      appointments: [existing],
      slotIsTaken: true,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.refusal.code).toBe("SLOT_TAKEN");
    }
  });
});

describe("the duplicate booking finder", () => {
  it("finds the live booking for the same doctor and day", () => {
    const existing = appointment({ id: "AP2" });

    const found = findDuplicateBooking(
      [existing],
      "U001",
      "D001",
      "2026-03-10",
    );
    expect(found?.id).toBe("AP2");
  });

  it("ignores the booking being moved", () => {
    const existing = appointment({ id: "AP2" });

    const found = findDuplicateBooking(
      [existing],
      "U001",
      "D001",
      "2026-03-10",
      "AP2",
    );
    expect(found).toBeNull();
  });
});

describe("the change check", () => {
  const settings = DEFAULT_POLICY;

  it("allows the owner to change their own booking", () => {
    const result = checkChangeAllowed({
      appointment: appointment(),
      actorId: "U001",
      actorRole: "PATIENT",
      today: "2026-03-01",
      nowMinute: 9 * 60,
      settings,
    });
    expect(result.allowed).toBe(true);
  });

  it("refuses a change by somebody else", () => {
    const result = checkChangeAllowed({
      appointment: appointment(),
      actorId: "U002",
      actorRole: "PATIENT",
      today: "2026-03-01",
      nowMinute: 9 * 60,
      settings,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.refusal.code).toBe("NOT_ALLOWED");
    }
  });

  it("refuses a change to a locked booking", () => {
    const result = checkChangeAllowed({
      appointment: appointment({ status: "CANCELLED" }),
      actorId: "U001",
      actorRole: "PATIENT",
      today: "2026-03-01",
      nowMinute: 9 * 60,
      settings,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.refusal.code).toBe("INVALID_TRANSITION");
    }
  });

  it("refuses a change by staff of another hospital", () => {
    const result = checkChangeAllowed({
      appointment: appointment(),
      actorId: "U003",
      actorRole: "HOSPITAL_STAFF",
      actorHospitalId: "H002",
      today: "2026-03-01",
      nowMinute: 9 * 60,
      settings,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.refusal.code).toBe("NOT_ALLOWED");
    }
  });

  it("allows staff of the same hospital", () => {
    const result = checkChangeAllowed({
      appointment: appointment(),
      actorId: "U003",
      actorRole: "HOSPITAL_STAFF",
      actorHospitalId: "H001",
      today: "2026-03-01",
      nowMinute: 9 * 60,
      settings,
    });
    expect(result.allowed).toBe(true);
  });

  it("allows a doctor to act on their own list", () => {
    const result = checkChangeAllowed({
      appointment: appointment(),
      actorId: "U002",
      actorRole: "DOCTOR",
      actorDoctorId: "D001",
      today: "2026-03-01",
      nowMinute: 9 * 60,
      settings,
    });
    expect(result.allowed).toBe(true);
  });

  it("refuses a doctor acting on another doctor's list", () => {
    const result = checkChangeAllowed({
      appointment: appointment(),
      actorId: "U002",
      actorRole: "DOCTOR",
      actorDoctorId: "D009",
      today: "2026-03-01",
      nowMinute: 9 * 60,
      settings,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.refusal.code).toBe("NOT_ALLOWED");
    }
  });

  it("refuses a change after the appointment has started", () => {
    const result = checkChangeAllowed({
      appointment: appointment({ date: "2026-03-01" }),
      actorId: "U001",
      actorRole: "PATIENT",
      today: "2026-03-01",
      nowMinute: 10 * 60,
      settings,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.refusal.code).toBe("ALREADY_PAST");
    }
  });

  it("refuses a change inside the cutoff window", () => {
    const result = checkChangeAllowed({
      appointment: appointment({ date: "2026-03-01" }),
      actorId: "U001",
      actorRole: "PATIENT",
      today: "2026-03-01",
      nowMinute: 8 * 60 + 30,
      settings,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.refusal.code).toBe("ALREADY_PAST");
    }
  });
});

describe("the start and cutoff checks", () => {
  it("knows an appointment has not started yet", () => {
    expect(
      hasAppointmentStarted(
        appointment({ date: "2026-03-10" }),
        "2026-03-01",
        9 * 60,
      ),
    ).toBe(false);
  });

  it("knows an appointment has started", () => {
    expect(
      hasAppointmentStarted(
        appointment({ date: "2026-03-01" }),
        "2026-03-01",
        10 * 60,
      ),
    ).toBe(true);
  });

  it("knows an appointment in the past has started", () => {
    expect(
      hasAppointmentStarted(
        appointment({ date: "2026-02-28" }),
        "2026-03-01",
        9 * 60,
      ),
    ).toBe(true);
  });

  it("allows a change well before the appointment", () => {
    expect(
      isInsideChangeWindow(
        appointment({ date: "2026-03-10" }),
        "2026-03-01",
        9 * 60,
        120,
      ),
    ).toBe(true);
  });

  it("refuses a change inside the cutoff", () => {
    expect(
      isInsideChangeWindow(
        appointment({ date: "2026-03-01" }),
        "2026-03-01",
        8 * 60 + 30,
        120,
      ),
    ).toBe(false);
  });
});

describe("the status ladder", () => {
  it("locks the finished statuses", () => {
    expect(isLocked("COMPLETED")).toBe(true);
    expect(isLocked("CANCELLED")).toBe(true);
    expect(isLocked("NO_SHOW")).toBe(true);
  });

  it("does not lock the live statuses", () => {
    expect(isLocked("BOOKED")).toBe(false);
    expect(isLocked("CONFIRMED")).toBe(false);
    expect(isLocked("WAITING")).toBe(false);
    expect(isLocked("IN_CONSULTATION")).toBe(false);
  });

  it("allows a booking to be confirmed", () => {
    expect(canTransition("BOOKED", "CONFIRMED")).toBe(true);
  });

  it("allows a skipped patient to come back", () => {
    expect(canTransition("SKIPPED", "WAITING")).toBe(true);
  });

  it("refuses a completed appointment being reopened", () => {
    expect(canTransition("COMPLETED", "BOOKED")).toBe(false);
  });

  it("refuses a cancelled appointment being reopened", () => {
    expect(canTransition("CANCELLED", "CONFIRMED")).toBe(false);
  });

  it("refuses a jump from booked straight to in consultation", () => {
    expect(canTransition("BOOKED", "IN_CONSULTATION")).toBe(false);
  });
});

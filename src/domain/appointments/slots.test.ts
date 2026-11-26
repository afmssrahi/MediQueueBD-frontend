import { describe, expect, it } from "vitest";
import {
  bookableDates,
  generateSlots,
  isDoctorAvailableOn,
  isDuringBreak,
  isInsideNoticePeriod,
  isInThePast,
  nextBookableDate,
  nextTokenNumber,
} from "@/domain/appointments/slots";
import type { Appointment, Doctor } from "@/types";

/**
 * The slot grid.
 *
 * The rules that decide which slots exist and why each one is closed. No
 * database and no transport — the grid is a pure function of the doctor's
 * session, the existing bookings and the current time.
 */

/** A doctor who works 09:00–14:00, Monday to Friday, with a 12:30 break. */
function doctor(overrides: Partial<Doctor> = {}): Doctor {
  return {
    id: "D001",
    name: "Dr. Ayesha Rahman",
    title: "Consultant",
    speciality: "Medicine",
    hospitalIds: ["H001"],
    departmentIds: [],
    qualification: "MBBS, FCPS",
    experienceYears: 10,
    consultationFee: 800,
    registrationNumber: "A-34122",
    bkashNumber: "+8801711-000001",
    phone: "+880 1711 000001",
    email: "ayesha@example.bd",
    languages: ["Bangla", "English"],
    bio: "",
    rating: 4.8,
    totalPatients: 100,
    imageUrl: null,
    sessionStart: 9 * 60,
    sessionEnd: 14 * 60,
    consultationHistory: [],
    defaultConsultationDuration: 12,
    availableWeekdays: [1, 2, 3, 4, 5],
    lunchBreakStart: 12 * 60 + 30,
    lunchBreakEnd: 13 * 60,
    active: true,
    ...overrides,
  };
}

/** A booking, with the fields the slot grid reads. */
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
    reason: "A headache",
    status: "CONFIRMED",
    tokenNumber: 1,
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

describe("the slot grid", () => {
  it("cuts the session into fixed slots", () => {
    const slots = generateSlots(doctor(), "2026-03-10", [], 15, {
      today: "2026-03-10",
      nowMinute: 8 * 60,
    });

    // 09:00 to 14:00 in 15-minute steps, minus the break.
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].startMinute).toBe(9 * 60);
  });

  it("closes a slot that is already booked", () => {
    const slots = generateSlots(
      doctor(),
      "2026-03-10",
      [appointment({ startMinute: 10 * 60, status: "CONFIRMED" })],
      15,
      { today: "2026-03-10", nowMinute: 8 * 60 },
    );

    const taken = slots.find((slot) => slot.startMinute === 10 * 60);
    expect(taken?.available).toBe(false);
    expect(taken?.unavailableReason).toBe("BOOKED");
    expect(taken?.appointmentId).toBe("AP1");
  });

  it("leaves the slot free when the booking is cancelled", () => {
    const slots = generateSlots(
      doctor(),
      "2026-03-10",
      [appointment({ startMinute: 10 * 60, status: "CANCELLED" })],
      15,
      { today: "2026-03-10", nowMinute: 8 * 60 },
    );

    const freed = slots.find((slot) => slot.startMinute === 10 * 60);
    expect(freed?.available).toBe(true);
  });

  it("closes a slot in the doctor's break", () => {
    const slots = generateSlots(doctor(), "2026-03-10", [], 15, {
      today: "2026-03-10",
      nowMinute: 8 * 60,
    });

    const inBreak = slots.find((slot) => slot.startMinute === 12 * 60 + 30);
    expect(inBreak?.available).toBe(false);
    expect(inBreak?.unavailableReason).toBe("BREAK");
  });

  it("closes a slot that has already passed", () => {
    const slots = generateSlots(doctor(), "2026-03-10", [], 15, {
      today: "2026-03-10",
      nowMinute: 10 * 60,
    });

    const past = slots.find((slot) => slot.startMinute === 9 * 60 + 45);
    expect(past?.available).toBe(false);
    expect(past?.unavailableReason).toBe("PAST");
  });

  it("closes a slot inside the notice period", () => {
    const slots = generateSlots(doctor(), "2026-03-10", [], 15, {
      today: "2026-03-10",
      nowMinute: 10 * 60,
      minimumNoticeMinutes: 120,
    });

    const tooClose = slots.find((slot) => slot.startMinute === 11 * 60 + 30);
    expect(tooClose?.available).toBe(false);
    expect(tooClose?.unavailableReason).toBe("NOTICE");
  });

  it("leaves a slot open when the notice period is zero", () => {
    const slots = generateSlots(doctor(), "2026-03-10", [], 15, {
      today: "2026-03-10",
      nowMinute: 10 * 60,
      minimumNoticeMinutes: 0,
    });

    const open = slots.find((slot) => slot.startMinute === 10 * 60 + 15);
    expect(open?.available).toBe(true);
  });

  it("returns no slots when the session is empty", () => {
    const slots = generateSlots(
      doctor({ sessionStart: 12 * 60, sessionEnd: 12 * 60 }),
      "2026-03-10",
      [],
      15,
    );

    expect(slots).toHaveLength(0);
  });
});

describe("the slot helpers", () => {
  it("knows a slot has passed", () => {
    expect(
      isInThePast("2026-03-10", 9 * 60, {
        today: "2026-03-10",
        nowMinute: 10 * 60,
      }),
    ).toBe(true);
  });

  it("knows a slot is still ahead", () => {
    expect(
      isInThePast("2026-03-10", 11 * 60, {
        today: "2026-03-10",
        nowMinute: 10 * 60,
      }),
    ).toBe(false);
  });

  it("knows a slot on another day is not in the past", () => {
    expect(
      isInThePast("2026-03-11", 9 * 60, {
        today: "2026-03-10",
        nowMinute: 10 * 60,
      }),
    ).toBe(false);
  });

  it("knows a slot inside the notice period", () => {
    expect(
      isInsideNoticePeriod("2026-03-10", 10 * 60 + 30, {
        today: "2026-03-10",
        nowMinute: 10 * 60,
        minimumNoticeMinutes: 120,
      }),
    ).toBe(true);
  });

  it("knows a slot on another day is outside the notice period", () => {
    expect(
      isInsideNoticePeriod("2026-03-11", 10 * 60, {
        today: "2026-03-10",
        nowMinute: 10 * 60,
        minimumNoticeMinutes: 120,
      }),
    ).toBe(false);
  });

  it("knows a slot is in the break", () => {
    expect(isDuringBreak(doctor(), 12 * 60 + 30, 12 * 60 + 45)).toBe(true);
  });

  it("knows a slot is not in the break", () => {
    expect(isDuringBreak(doctor(), 10 * 60, 10 * 60 + 15)).toBe(false);
  });

  it("knows the days the doctor works", () => {
    // 2026-03-10 is a Tuesday.
    expect(isDoctorAvailableOn(doctor(), "2026-03-10")).toBe(true);
    // 2026-03-14 is a Saturday.
    expect(isDoctorAvailableOn(doctor(), "2026-03-14")).toBe(false);
  });

  it("offers only the clinic days", () => {
    const dates = bookableDates(doctor(), "2026-03-09", 14);
    expect(dates).toContain("2026-03-10");
    expect(dates).not.toContain("2026-03-14");
  });

  it("finds the next bookable date", () => {
    // 2026-03-14 is a Saturday — the next clinic day is the Monday.
    expect(nextBookableDate(doctor(), "2026-03-14", 14)).toBe("2026-03-16");
  });

  it("returns null when the doctor has no clinic in the window", () => {
    const weekendsOnly = doctor({ availableWeekdays: [0] });
    expect(nextBookableDate(weekendsOnly, "2026-03-09", 5)).toBeNull();
  });
});

describe("the token number", () => {
  it("starts at one", () => {
    expect(nextTokenNumber([], "D001", "2026-03-10")).toBe(1);
  });

  it("is the highest token of the day, plus one", () => {
    const appointments = [
      appointment({ id: "AP1", tokenNumber: 3 }),
      appointment({ id: "AP2", tokenNumber: 7 }),
    ];
    expect(nextTokenNumber(appointments, "D001", "2026-03-10")).toBe(8);
  });

  it("is per doctor and per day", () => {
    const appointments = [
      appointment({ id: "AP1", tokenNumber: 3, doctorId: "D002" }),
      appointment({ id: "AP2", tokenNumber: 7, date: "2026-03-11" }),
    ];
    expect(nextTokenNumber(appointments, "D001", "2026-03-10")).toBe(1);
  });
});

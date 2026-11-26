import { beforeEach, describe, expect, it } from "vitest";
import { readDb, resetDb } from "@/demo/db";
import { mockTransport } from "@/api/mock-handlers";
import type { TransportRequest } from "@/api/transport";
import { addDaysIso, todayIso, weekdayOf } from "@/lib/format";
import type { Appointment, Slot } from "@/types";

/**
 * The Phase 3 booking gate.
 *
 * book → confirm → appears in the patient's list → cancel → the slot frees up
 * → reschedule works, and a second attempt at the same slot is rejected.
 *
 * The tests drive the mock transport directly, which is the same path the
 * service layer takes, so they exercise the real slot rules.
 */

const PATIENT_ID = "U001";

/** Send a request through the mock transport and unwrap the envelope. */
async function call<T>(
  method: string,
  path: string,
  options: { query?: Record<string, string>; body?: unknown } = {},
): Promise<T> {
  const request: TransportRequest = {
    method,
    path,
    query: options.query,
    body: options.body,
    userId: PATIENT_ID,
  };

  const response = await mockTransport.request<T>(request);

  if (!response.success) {
    throw new Error(`${response.error.code}: ${response.error.message}`);
  }

  return response.data;
}

/**
 * The first bookable date for the given doctor.
 *
 * The date is built from the local calendar day and the weekday is read back
 * from the ISO string, so the two always agree. Deriving the weekday from a
 * `Date` and the date from `toISOString()` mixes the local and the UTC
 * calendar, which disagrees for any time between midnight and 06:00 in
 * Bangladesh — and the seeded clinics do not run on every weekday.
 */
function firstBookableDate(doctorId: string): string {
  const db = readDb();
  const doctor = db.doctors.find((item) => item.id === doctorId);
  if (!doctor) throw new Error("The seed has no doctor with clinic days.");

  const tomorrow = addDaysIso(todayIso(), 1);

  for (let offset = 0; offset < 14; offset += 1) {
    const iso = addDaysIso(tomorrow, offset);
    if (doctor.availableWeekdays.includes(weekdayOf(iso))) return iso;
  }

  throw new Error("The seed has no bookable date in the next two weeks.");
}

describe("the appointment booking lifecycle", () => {
  beforeEach(() => {
    resetDb();
  });

  it("books an appointment and returns a token number", async () => {
    const doctors = await call<{ id: string }[]>("GET", "/doctors", {
      query: { active: "true" },
    });
    const doctorId = doctors[0].id;
    const date = firstBookableDate(doctorId);

    const slots = await call<{ slots: Slot[] }>("GET", "/slots", {
      query: { doctorId, date },
    });
    const free = slots.slots.find((slot) => slot.available);
    expect(free).toBeDefined();

    const appointment = await call<Appointment>("POST", "/appointments", {
      body: {
        patientId: PATIENT_ID,
        doctorId,
        date,
        startMinute: free!.startMinute,
        type: "New",
        reason: "Recurring headache for two weeks",
        paymentMethod: "Bkash",
        isPaid: true,
      },
    });

    expect(appointment.tokenNumber).toBeGreaterThan(0);
    expect(appointment.status).toBe("CONFIRMED");
    expect(appointment.date).toBe(date);
    expect(appointment.startMinute).toBe(free!.startMinute);
  });

  it("lists the booked appointment under the patient", async () => {
    const doctors = await call<{ id: string }[]>("GET", "/doctors", {
      query: { active: "true" },
    });
    const doctorId = doctors[0].id;
    const date = firstBookableDate(doctorId);

    const slots = await call<{ slots: Slot[] }>("GET", "/slots", {
      query: { doctorId, date },
    });
    const free = slots.slots.find((slot) => slot.available)!;

    const booked = await call<Appointment>("POST", "/appointments", {
      body: {
        patientId: PATIENT_ID,
        doctorId,
        date,
        startMinute: free.startMinute,
        type: "New",
        reason: "Follow-up on a medication change",
        paymentMethod: "Cash",
      },
    });

    const mine = await call<Appointment[]>("GET", "/appointments", {
      query: { patientId: PATIENT_ID },
    });

    expect(mine.some((item) => item.id === booked.id)).toBe(true);
  });

  it("rejects a second booking on a slot that is already taken", async () => {
    const doctors = await call<{ id: string }[]>("GET", "/doctors", {
      query: { active: "true" },
    });
    const doctorId = doctors[0].id;
    const date = firstBookableDate(doctorId);

    const slots = await call<{ slots: Slot[] }>("GET", "/slots", {
      query: { doctorId, date },
    });
    const free = slots.slots.find((slot) => slot.available)!;

    const body = {
      patientId: PATIENT_ID,
      doctorId,
      date,
      startMinute: free.startMinute,
      type: "New",
      reason: "A first booking for this slot",
      paymentMethod: "Cash",
    };

    await call<Appointment>("POST", "/appointments", { body });

    // The second attempt must fail with the double-booking guard.
    const response = await mockTransport.request<Appointment>({
      method: "POST",
      path: "/appointments",
      body: { ...body, reason: "A second booking for the same slot" },
      userId: PATIENT_ID,
    });

    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.error.code).toBe("SLOT_TAKEN");
    }
  });

  it("releases the slot when the appointment is cancelled", async () => {
    const doctors = await call<{ id: string }[]>("GET", "/doctors", {
      query: { active: "true" },
    });
    const doctorId = doctors[0].id;
    const date = firstBookableDate(doctorId);

    const slots = await call<{ slots: Slot[] }>("GET", "/slots", {
      query: { doctorId, date },
    });
    const free = slots.slots.find((slot) => slot.available)!;

    const booked = await call<Appointment>("POST", "/appointments", {
      body: {
        patientId: PATIENT_ID,
        doctorId,
        date,
        startMinute: free.startMinute,
        type: "New",
        reason: "A booking that will be cancelled",
        paymentMethod: "Cash",
      },
    });

    // The slot is taken while the booking is live.
    const takenSlots = await call<{ slots: Slot[] }>("GET", "/slots", {
      query: { doctorId, date },
    });
    const taken = takenSlots.slots.find(
      (slot) => slot.startMinute === free.startMinute,
    );
    expect(taken?.available).toBe(false);

    const cancelled = await call<Appointment>(
      "POST",
      `/appointments/${booked.id}/cancel`,
      { body: { reason: "The patient cannot attend" } },
    );
    expect(cancelled.status).toBe("CANCELLED");

    // The slot is free again.
    const freeSlots = await call<{ slots: Slot[] }>("GET", "/slots", {
      query: { doctorId, date },
    });
    const released = freeSlots.slots.find(
      (slot) => slot.startMinute === free.startMinute,
    );
    expect(released?.available).toBe(true);
  });

  it("moves an appointment to a new slot when it is rescheduled", async () => {
    const doctors = await call<{ id: string }[]>("GET", "/doctors", {
      query: { active: "true" },
    });
    const doctorId = doctors[0].id;
    const date = firstBookableDate(doctorId);

    const slots = await call<{ slots: Slot[] }>("GET", "/slots", {
      query: { doctorId, date },
    });
    const free = slots.slots.filter((slot) => slot.available);
    const taken = free[0];
    const target = free[1];

    const booked = await call<Appointment>("POST", "/appointments", {
      body: {
        patientId: PATIENT_ID,
        doctorId,
        date,
        startMinute: taken.startMinute,
        type: "New",
        reason: "A booking that will be rescheduled",
        paymentMethod: "Cash",
      },
    });

    const rescheduled = await call<Appointment>(
      "PATCH",
      `/appointments/${booked.id}/reschedule`,
      { body: { date, startMinute: target.startMinute } },
    );

    expect(rescheduled.startMinute).toBe(target.startMinute);
    // The token number never changes.
    expect(rescheduled.tokenNumber).toBe(booked.tokenNumber);

    const afterSlots = await call<{ slots: Slot[] }>("GET", "/slots", {
      query: { doctorId, date },
    });
    const oldSlot = afterSlots.slots.find(
      (slot) => slot.startMinute === taken.startMinute,
    );
    const newSlot = afterSlots.slots.find(
      (slot) => slot.startMinute === target.startMinute,
    );

    expect(oldSlot?.available).toBe(true);
    expect(newSlot?.available).toBe(false);
  });

  it("refuses to reschedule onto a slot that is already taken", async () => {
    const doctors = await call<{ id: string }[]>("GET", "/doctors", {
      query: { active: "true" },
    });
    const doctorId = doctors[0].id;
    const date = firstBookableDate(doctorId);

    const slots = await call<{ slots: Slot[] }>("GET", "/slots", {
      query: { doctorId, date },
    });
    const free = slots.slots.filter((slot) => slot.available);

    const first = await call<Appointment>("POST", "/appointments", {
      body: {
        patientId: PATIENT_ID,
        doctorId,
        date,
        startMinute: free[0].startMinute,
        type: "New",
        reason: "The first of two competing bookings",
        paymentMethod: "Cash",
      },
    });

    const second = await call<Appointment>("POST", "/appointments", {
      body: {
        patientId: PATIENT_ID,
        doctorId,
        date,
        startMinute: free[1].startMinute,
        type: "New",
        reason: "The second of two competing bookings",
        paymentMethod: "Cash",
      },
    });

    const response = await mockTransport.request<Appointment>({
      method: "PATCH",
      path: `/appointments/${second.id}/reschedule`,
      body: { date, startMinute: free[0].startMinute },
      userId: PATIENT_ID,
    });

    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.error.code).toBe("SLOT_TAKEN");
    }

    // The first booking is untouched.
    const still = await call<Appointment>(
      "GET",
      `/appointments/${first.id}`,
    );
    expect(still.startMinute).toBe(free[0].startMinute);
  });
});

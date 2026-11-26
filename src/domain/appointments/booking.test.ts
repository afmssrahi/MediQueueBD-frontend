import { beforeEach, describe, expect, it } from "vitest";
import { readDb, resetDb } from "@/demo/db";
import { mockTransport } from "@/api/mock-handlers";
import type { TransportRequest } from "@/api/transport";
import { addDaysIso, todayIso, weekdayOf } from "@/lib/format";
import type { Appointment, Slot } from "@/types";

/**
 * The appointment booking lifecycle.
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
  options: {
    query?: Record<string, string>;
    body?: unknown;
    userId?: string;
  } = {},
): Promise<T> {
  const request: TransportRequest = {
    method,
    path,
    query: options.query,
    body: options.body,
    userId: options.userId ?? PATIENT_ID,
  };

  const response = await mockTransport.request<T>(request);

  if (!response.success) {
    throw new Error(`${response.error.code}: ${response.error.message}`);
  }

  return response.data;
}

/** Send a request and keep the failure envelope. */
async function callRaw<T>(
  method: string,
  path: string,
  options: {
    query?: Record<string, string>;
    body?: unknown;
    userId?: string;
  } = {},
) {
  return mockTransport.request<T>({
    method,
    path,
    query: options.query,
    body: options.body,
    userId: options.userId ?? PATIENT_ID,
  });
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

/** The first free slot of a doctor on a date. */
async function firstFreeSlot(
  doctorId: string,
  date: string,
): Promise<Slot> {
  const slots = await call<{ slots: Slot[] }>("GET", "/slots", {
    query: { doctorId, date },
  });
  const free = slots.slots.find((slot) => slot.available);
  if (!free) throw new Error("The seed has no free slot on that date.");
  return free;
}

/** The body of a booking. */
function bookingBody(
  doctorId: string,
  date: string,
  startMinute: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    patientId: PATIENT_ID,
    doctorId,
    date,
    startMinute,
    type: "New",
    reason: "Recurring headache for two weeks",
    paymentMethod: "Cash",
    ...overrides,
  };
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
      body: bookingBody(doctorId, date, free!.startMinute),
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

    const free = await firstFreeSlot(doctorId, date);

    const booked = await call<Appointment>("POST", "/appointments", {
      body: bookingBody(doctorId, date, free.startMinute),
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

    const free = await firstFreeSlot(doctorId, date);

    await call<Appointment>("POST", "/appointments", {
      body: bookingBody(doctorId, date, free.startMinute),
    });

    // The second attempt must fail with the double-booking guard.
    const response = await callRaw<Appointment>("POST", "/appointments", {
      body: bookingBody(doctorId, date, free.startMinute, {
        reason: "A second booking for the same slot",
      }),
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

    const free = await firstFreeSlot(doctorId, date);

    const booked = await call<Appointment>("POST", "/appointments", {
      body: bookingBody(doctorId, date, free.startMinute),
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
      body: bookingBody(doctorId, date, taken.startMinute),
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

    // Two different patients take the two slots, so the reschedule has a
    // genuine conflict to hit. Each patient books for themselves.
    const first = await call<Appointment>("POST", "/appointments", {
      userId: "U101",
      body: {
        ...bookingBody(doctorId, date, free[0].startMinute),
        patientId: "U101",
      },
    });

    const second = await call<Appointment>("POST", "/appointments", {
      userId: "U102",
      body: {
        ...bookingBody(doctorId, date, free[1].startMinute),
        patientId: "U102",
      },
    });

    // The owner of the second booking tries to move it onto the first
    // booking's slot.
    const response = await callRaw<Appointment>(
      "PATCH",
      `/appointments/${second.id}/reschedule`,
      {
        userId: "U102",
        body: { date, startMinute: free[0].startMinute },
      },
    );

    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.error.code).toBe("SLOT_TAKEN");
    }

    // The first booking is untouched.
    const still = await call<Appointment>(
      "GET",
      `/appointments/${first.id}`,
      { userId: "U101" },
    );
    expect(still.startMinute).toBe(free[0].startMinute);
  });
});

describe("the realistic booking rules", () => {
  beforeEach(() => {
    resetDb();
  });

  it("refuses a booking beyond the lead time", async () => {
    const doctors = await call<{ id: string }[]>("GET", "/doctors", {
      query: { active: "true" },
    });
    const doctorId = doctors[0].id;

    // The seed allows fourteen days, so the twentieth is outside the window.
    const tooFar = addDaysIso(todayIso(), 20);
    const free = await firstFreeSlot(doctorId, tooFar);

    const response = await callRaw<Appointment>("POST", "/appointments", {
      body: bookingBody(doctorId, tooFar, free.startMinute),
    });

    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.error.code).toBe("OUTSIDE_BOOKING_WINDOW");
    }
  });

  it("refuses a booking on a day the doctor does not work", async () => {
    const doctors = await call<{ id: string }[]>("GET", "/doctors", {
      query: { active: "true" },
    });
    const doctorId = doctors[0].id;

    // Find a weekday the doctor is not in the clinic on.
    const db = readDb();
    const doctor = db.doctors.find((item) => item.id === doctorId)!;
    let closedDate = "";
    for (let offset = 1; offset < 14; offset += 1) {
      const iso = addDaysIso(todayIso(), offset);
      if (!doctor.availableWeekdays.includes(weekdayOf(iso))) {
        closedDate = iso;
        break;
      }
    }
    expect(closedDate).not.toBe("");

    const free = await firstFreeSlot(doctorId, closedDate);

    const response = await callRaw<Appointment>("POST", "/appointments", {
      body: bookingBody(doctorId, closedDate, free.startMinute),
    });

    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.error.code).toBe("CLINIC_CLOSED");
    }
  });

  it("refuses a second booking with the same doctor on the same day", async () => {
    const doctors = await call<{ id: string }[]>("GET", "/doctors", {
      query: { active: "true" },
    });
    const doctorId = doctors[0].id;
    const date = firstBookableDate(doctorId);

    const slots = await call<{ slots: Slot[] }>("GET", "/slots", {
      query: { doctorId, date },
    });
    const free = slots.slots.filter((slot) => slot.available);

    await call<Appointment>("POST", "/appointments", {
      body: bookingBody(doctorId, date, free[0].startMinute),
    });

    // A different slot, same doctor, same day — the patient must reschedule
    // the booking they already have instead.
    const response = await callRaw<Appointment>("POST", "/appointments", {
      body: bookingBody(doctorId, date, free[1].startMinute),
    });

    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.error.code).toBe("DUPLICATE_BOOKING");
    }
  });

  it("refuses a cancellation without a reason", async () => {
    const doctors = await call<{ id: string }[]>("GET", "/doctors", {
      query: { active: "true" },
    });
    const doctorId = doctors[0].id;
    const date = firstBookableDate(doctorId);
    const free = await firstFreeSlot(doctorId, date);

    const booked = await call<Appointment>("POST", "/appointments", {
      body: bookingBody(doctorId, date, free.startMinute),
    });

    const response = await callRaw<Appointment>(
      "POST",
      `/appointments/${booked.id}/cancel`,
      { body: {} },
    );

    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("does not let a patient cancel somebody else's booking", async () => {
    const doctors = await call<{ id: string }[]>("GET", "/doctors", {
      query: { active: "true" },
    });
    const doctorId = doctors[0].id;
    const date = firstBookableDate(doctorId);
    const free = await firstFreeSlot(doctorId, date);

    const booked = await call<Appointment>("POST", "/appointments", {
      userId: "U101",
      body: {
        ...bookingBody(doctorId, date, free.startMinute),
        patientId: "U101",
      },
    });

    // U001 is not the owner of this booking.
    const response = await callRaw<Appointment>(
      "POST",
      `/appointments/${booked.id}/cancel`,
      { body: { reason: "Not my appointment" } },
    );

    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.error.code).toBe("NOT_ALLOWED");
    }
  });

  it("does not let a patient book for somebody else", async () => {
    const doctors = await call<{ id: string }[]>("GET", "/doctors", {
      query: { active: "true" },
    });
    const doctorId = doctors[0].id;
    const date = firstBookableDate(doctorId);
    const free = await firstFreeSlot(doctorId, date);

    const response = await callRaw<Appointment>("POST", "/appointments", {
      body: bookingBody(doctorId, date, free.startMinute, {
        patientId: "U101",
      }),
    });

    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.error.code).toBe("NOT_ALLOWED");
    }
  });

  it("sends a notification when a booking is made", async () => {
    const doctors = await call<{ id: string }[]>("GET", "/doctors", {
      query: { active: "true" },
    });
    const doctorId = doctors[0].id;
    const date = firstBookableDate(doctorId);
    const free = await firstFreeSlot(doctorId, date);

    const booked = await call<Appointment>("POST", "/appointments", {
      body: bookingBody(doctorId, date, free.startMinute),
    });

    const notifications = await call<
      { id: string; title: string; read: boolean }[]
    >("GET", "/notifications");

    const match = notifications.find((item) =>
      item.title.includes(String(booked.tokenNumber)),
    );
    expect(match).toBeDefined();
    expect(match?.read).toBe(false);
  });
});

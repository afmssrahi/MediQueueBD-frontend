import { fail, ok } from "@/api/envelope";
import { readDb, writeDb } from "@/demo/db";
import { format, parseISO } from "date-fns";
import type {
  AppNotification,
  Appointment,
  AppointmentStatus,
  Slot,
} from "@/types";
import {
  bookableDates,
  findSlotConflict,
  generateSlots,
  isDoctorAvailableOn,
  nextTokenNumber,
} from "@/domain/appointments/slots";
import {
  DEFAULT_POLICY,
  checkBookingAllowed,
  checkChangeAllowed,
  canTransition,
  isLocked,
  isStaffRole,
  type AppointmentPolicySettings,
} from "@/domain/appointments/policy";
import { bodyOf, queryOf, type HandlerMap } from "../mock-transport";

/**
 * The appointment endpoints.
 *
 * Every rule that matters lives in `src/domain/appointments/policy.ts`, so
 * the browser and the future backend enforce exactly the same things.
 */

/** Today, as an ISO string. */
function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** The current time, in minutes since midnight. */
function nowMinute(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/** The policy settings, taken from the demo database. */
function policyOf(settings: {
  appointmentLeadDays: number;
  minimumNoticeMinutes?: number;
  changeCutoffMinutes?: number;
}): AppointmentPolicySettings {
  return {
    appointmentLeadDays: settings.appointmentLeadDays,
    minimumNoticeMinutes:
      settings.minimumNoticeMinutes ?? DEFAULT_POLICY.minimumNoticeMinutes,
    changeCutoffMinutes:
      settings.changeCutoffMinutes ?? DEFAULT_POLICY.changeCutoffMinutes,
  };
}

/** The signed-in user's record, when there is one. */
function actorOf(userId: string | null | undefined) {
  if (!userId) return null;
  const db = readDb();
  return db.users.find((item) => item.id === userId) ?? null;
}

/**
 * Appointments a user is allowed to see.
 *
 * A patient sees their own. A doctor sees their own list. Hospital staff and
 * administrators see their hospital. Only a system administrator sees the
 * whole platform.
 */
function scopeAppointments(
  appointments: Appointment[],
  actor: ReturnType<typeof actorOf>,
): Appointment[] {
  if (!actor) return [];

  if (actor.role === "PATIENT") {
    return appointments.filter((item) => item.patientId === actor.id);
  }

  if (actor.role === "DOCTOR") {
    if (!actor.doctorId) return [];
    return appointments.filter((item) => item.doctorId === actor.doctorId);
  }

  if (actor.role === "HOSPITAL_STAFF" || actor.role === "HOSPITAL_ADMIN") {
    if (!actor.hospitalId) return [];
    return appointments.filter((item) => item.hospitalId === actor.hospitalId);
  }

  if (actor.role === "SYSTEM_ADMIN") return appointments;

  // Diagnostic staff have no business with appointments.
  return [];
}

/** May this actor see this one appointment? */
function canSee(
  appointment: Appointment,
  actor: ReturnType<typeof actorOf>,
): boolean {
  if (!actor) return false;
  if (actor.role === "SYSTEM_ADMIN") return true;

  if (actor.role === "PATIENT") return appointment.patientId === actor.id;

  if (actor.role === "DOCTOR") {
    return Boolean(actor.doctorId) && appointment.doctorId === actor.doctorId;
  }

  if (actor.role === "HOSPITAL_STAFF" || actor.role === "HOSPITAL_ADMIN") {
    return Boolean(actor.hospitalId) && appointment.hospitalId === actor.hospitalId;
  }

  return false;
}

/** Build a notification for a user. */
function buildNotification(
  db: { counters: { notification: number } },
  userId: string,
  type: AppNotification["type"],
  title: string,
  body: string,
  href: string | null,
): AppNotification {
  return {
    id: `NT${db.counters.notification + 1}`,
    userId,
    type,
    title,
    body,
    read: false,
    createdAt: new Date().toISOString(),
    href,
  };
}

export const appointmentHandlers: HandlerMap = {
  "GET /appointments": (request) => {
    const query = queryOf(request);
    const db = readDb();
    const actor = actorOf(request.userId);

    let appointments = scopeAppointments(db.appointments, actor);

    if (query.patientId) {
      appointments = appointments.filter(
        (item) => item.patientId === query.patientId,
      );
    }
    if (query.doctorId) {
      appointments = appointments.filter(
        (item) => item.doctorId === query.doctorId,
      );
    }
    if (query.hospitalId) {
      appointments = appointments.filter(
        (item) => item.hospitalId === query.hospitalId,
      );
    }
    if (query.status) {
      appointments = appointments.filter(
        (item) => item.status === query.status,
      );
    }
    if (query.type) {
      appointments = appointments.filter((item) => item.type === query.type);
    }
    if (query.date) {
      appointments = appointments.filter((item) => item.date === query.date);
    }
    if (query.from) {
      appointments = appointments.filter((item) => item.date >= query.from);
    }
    if (query.to) {
      appointments = appointments.filter((item) => item.date <= query.to);
    }
    if (query.search) {
      const needle = query.search.toLowerCase();
      appointments = appointments.filter((item) =>
        `${item.patientName} ${item.doctorName} ${item.hospitalName} ${item.tokenNumber} ${item.reason}`
          .toLowerCase()
          .includes(needle),
      );
    }

    const sort = query.sort ?? "date";
    appointments = [...appointments].sort((a, b) => {
      if (sort === "date") {
        const keyA = `${a.date} ${String(a.startMinute).padStart(4, "0")}`;
        const keyB = `${b.date} ${String(b.startMinute).padStart(4, "0")}`;
        return keyA.localeCompare(keyB);
      }
      if (sort === "token") return a.tokenNumber - b.tokenNumber;
      if (sort === "fee") return b.fee - a.fee;
      return a.doctorName.localeCompare(b.doctorName);
    });

    return ok(appointments, {
      total: appointments.length,
      page: 1,
      pageSize: appointments.length,
      totalPages: 1,
    });
  },

  "GET /appointments/:id": (request) => {
    const query = queryOf(request);
    const db = readDb();
    const actor = actorOf(request.userId);
    const appointment = db.appointments.find((item) => item.id === query.id);

    if (!appointment) {
      return fail("NOT_FOUND", "No such appointment.", 404);
    }

    if (!canSee(appointment, actor)) {
      return fail("NOT_ALLOWED", "You cannot view this appointment.", 403);
    }

    return ok(appointment);
  },

  "POST /appointments": (request) => {
    const body = bodyOf(request);
    const db = readDb();
    const actor = actorOf(request.userId);

    const doctorId = String(body.doctorId ?? "");
    const date = String(body.date ?? "");
    const startMinute = Number(body.startMinute);
    const requestedPatientId = String(body.patientId ?? request.userId ?? "");

    const fields: Record<string, string> = {};
    if (!doctorId) fields.doctorId = "Choose a doctor";
    if (!date) fields.date = "Choose a date";
    if (!Number.isFinite(startMinute)) fields.startMinute = "Choose a slot";
    if (!requestedPatientId) fields.patientId = "Choose a patient";
    if (Object.keys(fields).length > 0) {
      return fail("VALIDATION_ERROR", "Please correct the highlighted fields.", 400, fields);
    }

    // A patient books for themselves. Staff may book on behalf of a patient.
    const bookingOnBehalf = isStaffRole(actor?.role);
    const patientId = bookingOnBehalf ? requestedPatientId : (actor?.id ?? "");

    if (!bookingOnBehalf && requestedPatientId && actor && requestedPatientId !== actor.id) {
      return fail("NOT_ALLOWED", "You can only book an appointment for yourself.", 403);
    }

    const doctor = db.doctors.find((item) => item.id === doctorId);
    if (!doctor) {
      return fail("NOT_FOUND", "No such doctor.", 404);
    }

    const patient = db.users.find((item) => item.id === patientId);
    if (!patient) {
      return fail("NOT_FOUND", "No such patient.", 404);
    }

    const policy = policyOf(db.settings);
    const today = todayIso();
    const now = nowMinute();

    const slots = generateSlots(
      doctor,
      date,
      db.appointments,
      db.settings.slotDurationMinutes,
      { today, nowMinute: now, minimumNoticeMinutes: policy.minimumNoticeMinutes },
    );

    const conflict = findSlotConflict(slots, startMinute, db.appointments, {
      doctorId,
      date,
    });

    const decision = checkBookingAllowed({
      patientId,
      doctorId,
      date,
      startMinute,
      appointments: db.appointments,
      isClinicDay: isDoctorAvailableOn(doctor, date),
      slotIsTaken: conflict !== null,
      today,
      nowMinute: now,
      settings: policy,
    });

    if (!decision.allowed) {
      return fail(
        decision.refusal.code,
        decision.refusal.message,
        decision.refusal.code === "SLOT_TAKEN" ? 409 : 400,
        decision.refusal.field ? { [decision.refusal.field]: decision.refusal.message } : undefined,
      );
    }

    const slot = slots.find((item) => item.startMinute === startMinute);
    if (!slot) {
      return fail(
        "INVALID_SLOT",
        "That slot is outside the doctor's clinic hours.",
        400,
        { startMinute: "That slot is outside the clinic hours" },
      );
    }

    if (!slot.available) {
      return fail(
        "INVALID_SLOT",
        slot.unavailableReason === "PAST"
          ? "That time has already passed."
          : slot.unavailableReason === "BREAK"
            ? "The doctor is on a break at that time."
            : "That slot is not available.",
        400,
        { startMinute: "That slot is not available" },
      );
    }

    const department = db.departments.find((item) =>
      doctor.departmentIds.includes(item.id),
    );
    const hospital = db.hospitals.find((item) =>
      doctor.hospitalIds.includes(item.id),
    );

    const created: Appointment = {
      id: `AP${db.counters.appointment + 1}`,
      patientId: patient.id,
      patientName: patient.name,
      doctorId: doctor.id,
      doctorName: doctor.name,
      hospitalId: hospital?.id ?? "H001",
      hospitalName: hospital?.name ?? "MediQueue City Hospital",
      departmentId: department?.id ?? null,
      date,
      startMinute,
      endMinute: startMinute + db.settings.slotDurationMinutes,
      type: String(body.type ?? "New"),
      reason: String(body.reason ?? ""),
      status: "CONFIRMED",
      tokenNumber: nextTokenNumber(db.appointments, doctorId, date),
      fee: doctor.consultationFee,
      paymentMethod: (body.paymentMethod as Appointment["paymentMethod"]) ?? "Cash",
      isPaid: body.isPaid === true,
      createdAt: new Date().toISOString(),
      cancelledAt: null,
      cancelReason: null,
      notes: (body.notes as string) ?? null,
      bookedBy: actor?.id ?? patient.id,
      source: bookingOnBehalf ? "STAFF" : "PATIENT",
    };

    const notification = buildNotification(
      db,
      patient.id,
      "APPOINTMENT",
      `Appointment confirmed — token ${created.tokenNumber}`,
      `${doctor.name} on ${format(parseISO(date), "d MMM yyyy")}. Token ${created.tokenNumber}.`,
      "/patient/appointments",
    );

    writeDb((current) => ({
      ...current,
      appointments: [...current.appointments, created],
      notifications: [notification, ...current.notifications],
      counters: {
        ...current.counters,
        appointment: current.counters.appointment + 1,
        notification: current.counters.notification + 1,
      },
    }));

    return ok(created);
  },

  "POST /appointments/:id/cancel": (request) => {
    const query = queryOf(request);
    const body = bodyOf(request);
    const db = readDb();
    const actor = actorOf(request.userId);
    const appointment = db.appointments.find((item) => item.id === query.id);

    if (!appointment) {
      return fail("NOT_FOUND", "No such appointment.", 404);
    }

    if (!canSee(appointment, actor)) {
      return fail("NOT_ALLOWED", "You cannot change this appointment.", 403);
    }

    const decision = checkChangeAllowed({
      appointment,
      actorId: actor?.id ?? null,
      actorRole: actor?.role,
      actorHospitalId: actor?.hospitalId,
      actorDoctorId: actor?.doctorId,
      today: todayIso(),
      nowMinute: nowMinute(),
      settings: policyOf(db.settings),
    });

    if (!decision.allowed) {
      return fail(
        decision.refusal.code,
        decision.refusal.message,
        403,
      );
    }

    const reason = String(body.reason ?? "").trim();
    if (!reason) {
      return fail(
        "VALIDATION_ERROR",
        "Please give a reason for the cancellation.",
        400,
        { reason: "A reason is required" },
      );
    }

    const updated: Appointment = {
      ...appointment,
      status: "CANCELLED",
      cancelledAt: new Date().toISOString(),
      cancelReason: reason,
    };

    const notification = buildNotification(
      db,
      appointment.patientId,
      "APPOINTMENT",
      "Your appointment was cancelled",
      `${appointment.doctorName} on ${format(parseISO(appointment.date), "d MMM yyyy")} was cancelled. Reason: ${reason}`,
      "/patient/appointments",
    );

    writeDb((current) => ({
      ...current,
      appointments: current.appointments.map((item) =>
        item.id === updated.id ? updated : item,
      ),
      notifications: [notification, ...current.notifications],
      counters: {
        ...current.counters,
        notification: current.counters.notification + 1,
      },
    }));

    return ok(updated);
  },

  "PATCH /appointments/:id/reschedule": (request) => {
    const query = queryOf(request);
    const body = bodyOf(request);
    const db = readDb();
    const actor = actorOf(request.userId);
    const appointment = db.appointments.find((item) => item.id === query.id);

    if (!appointment) {
      return fail("NOT_FOUND", "No such appointment.", 404);
    }

    if (!canSee(appointment, actor)) {
      return fail("NOT_ALLOWED", "You cannot change this appointment.", 403);
    }

    const decision = checkChangeAllowed({
      appointment,
      actorId: actor?.id ?? null,
      actorRole: actor?.role,
      actorHospitalId: actor?.hospitalId,
      actorDoctorId: actor?.doctorId,
      today: todayIso(),
      nowMinute: nowMinute(),
      settings: policyOf(db.settings),
    });

    if (!decision.allowed) {
      return fail(decision.refusal.code, decision.refusal.message, 403);
    }

    const date = String(body.date ?? appointment.date);
    const startMinute = Number(body.startMinute ?? appointment.startMinute);

    const doctor = db.doctors.find((item) => item.id === appointment.doctorId);
    if (!doctor) {
      return fail("NOT_FOUND", "The doctor for this appointment no longer exists.", 404);
    }

    if (!isDoctorAvailableOn(doctor, date)) {
      return fail(
        "DOCTOR_UNAVAILABLE",
        "The doctor does not hold a clinic on that date.",
        400,
        { date: "The doctor is not available on that date" },
      );
    }

    const today = todayIso();
    const now = nowMinute();
    const policy = policyOf(db.settings);

    const slots = generateSlots(
      doctor,
      date,
      db.appointments,
      db.settings.slotDurationMinutes,
      { today, nowMinute: now, minimumNoticeMinutes: policy.minimumNoticeMinutes },
    );

    const conflict = findSlotConflict(slots, startMinute, db.appointments, {
      doctorId: doctor.id,
      date,
      ignoreAppointmentId: appointment.id,
    });

    if (conflict) {
      return fail(
        "SLOT_TAKEN",
        "This slot has just been taken. Please pick another slot.",
        409,
        { startMinute: "This slot is no longer available" },
      );
    }

    const slot = slots.find((item) => item.startMinute === startMinute);
    if (!slot) {
      return fail(
        "INVALID_SLOT",
        "That slot is outside the doctor's clinic hours.",
        400,
        { startMinute: "That slot is outside the clinic hours" },
      );
    }

    if (!slot.available) {
      return fail(
        "INVALID_SLOT",
        slot.unavailableReason === "PAST"
          ? "That time has already passed."
          : slot.unavailableReason === "BREAK"
            ? "The doctor is on a break at that time."
            : "That slot is not available.",
        400,
        { startMinute: "That slot is not available" },
      );
    }

    const updated: Appointment = {
      ...appointment,
      date,
      startMinute,
      endMinute: startMinute + db.settings.slotDurationMinutes,
      status: "CONFIRMED",
      // The token number is permanent — it is assigned at booking and never
      // changes, so a reschedule keeps the number the patient already has.
      tokenNumber: appointment.tokenNumber,
    };

    const notification = buildNotification(
      db,
      appointment.patientId,
      "APPOINTMENT",
      "Your appointment was moved",
      `${doctor.name} on ${format(parseISO(date), "d MMM yyyy")}. Your token number stays ${appointment.tokenNumber}.`,
      "/patient/appointments",
    );

    writeDb((current) => ({
      ...current,
      appointments: current.appointments.map((item) =>
        item.id === updated.id ? updated : item,
      ),
      notifications: [notification, ...current.notifications],
      counters: {
        ...current.counters,
        notification: current.counters.notification + 1,
      },
    }));

    return ok(updated);
  },

  /**
   * Change the status of an appointment.
   *
   * The live transitions — check in, call, start, complete — belong to the
   * queue reducer, which drives the waiting-time engine. This endpoint is for
   * the administrative moves that sit outside that ladder: striking a patient
   * off as a no-show, or reinstating a booking.
   */
  "PATCH /appointments/:id/status": (request) => {
    const query = queryOf(request);
    const body = bodyOf(request);
    const db = readDb();
    const actor = actorOf(request.userId);
    const appointment = db.appointments.find((item) => item.id === query.id);

    if (!appointment) {
      return fail("NOT_FOUND", "No such appointment.", 404);
    }

    if (!canSee(appointment, actor)) {
      return fail("NOT_ALLOWED", "You cannot change this appointment.", 403);
    }

    const nextStatus = String(body.status ?? "") as AppointmentStatus;

    if (!isStaffRole(actor?.role)) {
      return fail(
        "NOT_ALLOWED",
        "Only hospital staff can change the status of an appointment.",
        403,
      );
    }

    if (isLocked(appointment.status)) {
      return fail(
        "INVALID_TRANSITION",
        `An appointment that is already ${appointment.status.toLowerCase()} cannot be changed.`,
        409,
      );
    }

    if (!canTransition(appointment.status, nextStatus)) {
      return fail(
        "INVALID_TRANSITION",
        `An appointment cannot move from ${appointment.status} to ${nextStatus}.`,
        409,
      );
    }

    const updated: Appointment = {
      ...appointment,
      status: nextStatus,
      cancelledAt:
        nextStatus === "CANCELLED" ? new Date().toISOString() : appointment.cancelledAt,
      cancelReason:
        nextStatus === "CANCELLED"
          ? String(body.reason ?? "Cancelled by the hospital.")
          : appointment.cancelReason,
      notes: body.notes !== undefined ? String(body.notes) : appointment.notes,
    };

    const notification = buildNotification(
      db,
      appointment.patientId,
      "APPOINTMENT",
      `Your appointment is now ${nextStatus.toLowerCase().replace(/_/g, " ")}`,
      `${appointment.doctorName} on ${format(parseISO(appointment.date), "d MMM yyyy")}. Token ${appointment.tokenNumber}.`,
      "/patient/appointments",
    );

    writeDb((current) => ({
      ...current,
      appointments: current.appointments.map((item) =>
        item.id === updated.id ? updated : item,
      ),
      notifications: [notification, ...current.notifications],
      counters: {
        ...current.counters,
        notification: current.counters.notification + 1,
      },
    }));

    return ok(updated);
  },

  "GET /slots": (request) => {
    const query = queryOf(request);
    const db = readDb();

    const doctorId = String(query.doctorId ?? "");
    const date = String(query.date ?? "");

    if (!doctorId || !date) {
      return fail("VALIDATION_ERROR", "A doctor and a date are required.", 400, {
        ...(doctorId ? {} : { doctorId: "Choose a doctor" }),
        ...(date ? {} : { date: "Choose a date" }),
      });
    }

    const doctor = db.doctors.find((item) => item.id === doctorId);
    if (!doctor) {
      return fail("NOT_FOUND", "No such doctor.", 404);
    }

    const today = todayIso();
    const now = nowMinute();
    const policy = policyOf(db.settings);

    const slots = generateSlots(
      doctor,
      date,
      db.appointments,
      db.settings.slotDurationMinutes,
      { today, nowMinute: now, minimumNoticeMinutes: policy.minimumNoticeMinutes },
    );

    const doctorPayload = {
      doctorId: doctor.id,
      doctorName: doctor.name,
      speciality: doctor.speciality,
      sessionStart: doctor.sessionStart,
      sessionEnd: doctor.sessionEnd,
      consultationFee: doctor.consultationFee,
      /** The break is shown so the grid explains the gaps in it. */
      breakStart: doctor.lunchBreakStart ?? null,
      breakEnd: doctor.lunchBreakEnd ?? null,
      isClinicDay: isDoctorAvailableOn(doctor, date),
      slots,
    };

    return ok(doctorPayload);
  },

  "GET /doctors/:id/schedule": (request) => {
    const query = queryOf(request);
    const db = readDb();
    const doctor = db.doctors.find((item) => item.id === query.id);

    if (!doctor) {
      return fail("NOT_FOUND", "No such doctor.", 404);
    }

    const fromDate = query.from ?? todayIso();
    const dates = bookableDates(doctor, fromDate, 14);
    const today = todayIso();
    const now = nowMinute();
    const policy = policyOf(db.settings);

    const schedule = dates.map((date) => {
      const slots = generateSlots(
        doctor,
        date,
        db.appointments,
        db.settings.slotDurationMinutes,
        { today, nowMinute: now, minimumNoticeMinutes: policy.minimumNoticeMinutes },
      );
      return {
        date,
        available: slots.filter((slot: Slot) => slot.available).length,
        total: slots.length,
      };
    });

    return ok({
      doctorId: doctor.id,
      sessionStart: doctor.sessionStart,
      sessionEnd: doctor.sessionEnd,
      availableWeekdays: doctor.availableWeekdays,
      schedule,
    });
  },

  "GET /doctors/:id/availability": (request) => {
    const query = queryOf(request);
    const db = readDb();
    const doctor = db.doctors.find((item) => item.id === query.id);

    if (!doctor) {
      return fail("NOT_FOUND", "No such doctor.", 404);
    }

    const fromDate = query.from ?? todayIso();
    const dates = bookableDates(doctor, fromDate, 14);
    const today = todayIso();
    const now = nowMinute();
    const policy = policyOf(db.settings);

    const availability = dates.map((date) => {
      const slots = generateSlots(
        doctor,
        date,
        db.appointments,
        db.settings.slotDurationMinutes,
        { today, nowMinute: now, minimumNoticeMinutes: policy.minimumNoticeMinutes },
      );
      const available = slots.filter((slot: Slot) => slot.available).length;
      const total = slots.length;
      const ratio = total === 0 ? 0 : available / total;

      return {
        date,
        available,
        total,
        // The heatmap uses three bands rather than a continuous scale.
        level: ratio === 0 ? "full" : ratio < 0.4 ? "busy" : "open",
      };
    });

    return ok({
      doctorId: doctor.id,
      availability,
    });
  },
};

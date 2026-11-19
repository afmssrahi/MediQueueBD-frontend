import { fail, ok } from "@/api/envelope";
import { readDb, writeDb } from "@/demo/db";
import { format, parseISO } from "date-fns";
import type { Appointment, Slot } from "@/types";
import {
  bookableDates,
  findSlotConflict,
  generateSlots,
  isDoctorAvailableOn,
  nextTokenNumber,
} from "@/domain/appointments/slots";
import { bodyOf, queryOf, type HandlerMap } from "../mock-transport";

/** Appointments a user is allowed to see. */
function scopeAppointments(
  appointments: Appointment[],
  userId: string | null | undefined,
  role: string | undefined,
): Appointment[] {
  if (!userId) return appointments;

  if (role === "PATIENT") {
    return appointments.filter((item) => item.patientId === userId);
  }

  return appointments;
}

export const appointmentHandlers: HandlerMap = {
  "GET /appointments": (request) => {
    const query = queryOf(request);
    const db = readDb();

    let appointments = scopeAppointments(
      db.appointments,
      request.userId,
      query.role,
    );

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
        `${item.patientName} ${item.doctorName} ${item.hospitalName} ${item.tokenNumber}`
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
    const appointment = db.appointments.find((item) => item.id === query.id);

    if (!appointment) {
      return fail("NOT_FOUND", "No such appointment.", 404);
    }

    return ok(appointment);
  },

  "POST /appointments": (request) => {
    const body = bodyOf(request);
    const db = readDb();

    const doctorId = String(body.doctorId ?? "");
    const date = String(body.date ?? "");
    const startMinute = Number(body.startMinute);
    const patientId = String(body.patientId ?? request.userId ?? "");

    const fields: Record<string, string> = {};
    if (!doctorId) fields.doctorId = "Choose a doctor";
    if (!date) fields.date = "Choose a date";
    if (!Number.isFinite(startMinute)) fields.startMinute = "Choose a slot";
    if (!patientId) fields.patientId = "Choose a patient";
    if (Object.keys(fields).length > 0) {
      return fail("VALIDATION_ERROR", "Please correct the highlighted fields.", 400, fields);
    }

    const doctor = db.doctors.find((item) => item.id === doctorId);
    if (!doctor) {
      return fail("NOT_FOUND", "No such doctor.", 404);
    }

    const patient = db.users.find((item) => item.id === patientId);
    if (!patient) {
      return fail("NOT_FOUND", "No such patient.", 404);
    }

    if (!isDoctorAvailableOn(doctor, date)) {
      return fail(
        "DOCTOR_UNAVAILABLE",
        "The doctor does not hold a clinic on that date.",
        400,
        { date: "The doctor is not available on that date" },
      );
    }

    const slots = generateSlots(
      doctor,
      date,
      db.appointments,
      db.settings.slotDurationMinutes,
    );

    const conflict = findSlotConflict(slots, startMinute, db.appointments, {
      doctorId,
      date,
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

    const department = db.departments.find(
      (item) => doctor.departmentIds.includes(item.id),
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
    };

    writeDb((current) => ({
      ...current,
      appointments: [...current.appointments, created],
      counters: {
        ...current.counters,
        appointment: current.counters.appointment + 1,
      },
    }));

    return ok(created);
  },

  "POST /appointments/:id/cancel": (request) => {
    const query = queryOf(request);
    const body = bodyOf(request);
    const db = readDb();
    const appointment = db.appointments.find((item) => item.id === query.id);

    if (!appointment) {
      return fail("NOT_FOUND", "No such appointment.", 404);
    }

    if (["COMPLETED", "CANCELLED"].includes(appointment.status)) {
      return fail(
        "INVALID_TRANSITION",
        `An appointment that is already ${appointment.status.toLowerCase()} cannot be cancelled.`,
        409,
      );
    }

    const updated: Appointment = {
      ...appointment,
      status: "CANCELLED",
      cancelledAt: new Date().toISOString(),
      cancelReason: String(body.reason ?? "Cancelled by the patient."),
    };

    writeDb((current) => ({
      ...current,
      appointments: current.appointments.map((item) =>
        item.id === updated.id ? updated : item,
      ),
    }));

    return ok(updated);
  },

  "PATCH /appointments/:id/reschedule": (request) => {
    const query = queryOf(request);
    const body = bodyOf(request);
    const db = readDb();
    const appointment = db.appointments.find((item) => item.id === query.id);

    if (!appointment) {
      return fail("NOT_FOUND", "No such appointment.", 404);
    }

    if (["COMPLETED", "CANCELLED"].includes(appointment.status)) {
      return fail(
        "INVALID_TRANSITION",
        `An appointment that is already ${appointment.status.toLowerCase()} cannot be rescheduled.`,
        409,
      );
    }

    const date = String(body.date ?? appointment.date);
    const startMinute = Number(body.startMinute ?? appointment.startMinute);

    const doctor = db.doctors.find((item) => item.id === appointment.doctorId);
    if (!doctor) {
      return fail("NOT_FOUND", "The doctor for this appointment no longer exists.", 404);
    }

    const slots = generateSlots(
      doctor,
      date,
      db.appointments,
      db.settings.slotDurationMinutes,
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

    writeDb((current) => ({
      ...current,
      appointments: current.appointments.map((item) =>
        item.id === updated.id ? updated : item,
      ),
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

    const slots = generateSlots(
      doctor,
      date,
      db.appointments,
      db.settings.slotDurationMinutes,
    );

    const doctorPayload = {
      doctorId: doctor.id,
      doctorName: doctor.name,
      speciality: doctor.speciality,
      sessionStart: doctor.sessionStart,
      sessionEnd: doctor.sessionEnd,
      consultationFee: doctor.consultationFee,
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

    const fromDate = query.from ?? format(new Date(), "yyyy-MM-dd");
    const dates = bookableDates(doctor, fromDate, 14);

    const schedule = dates.map((date) => {
      const slots = generateSlots(
        doctor,
        date,
        db.appointments,
        db.settings.slotDurationMinutes,
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

    const fromDate = query.from ?? format(new Date(), "yyyy-MM-dd");
    const dates = bookableDates(doctor, fromDate, 14);

    const availability = dates.map((date) => {
      const slots = generateSlots(
        doctor,
        date,
        db.appointments,
        db.settings.slotDurationMinutes,
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

export { parseISO };

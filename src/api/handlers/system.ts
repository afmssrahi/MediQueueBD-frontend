import { fail, ok } from "@/api/envelope";
import { readDb, resetDb, writeDb } from "@/demo/db";
import { format } from "date-fns";
import type { HospitalStaff, SystemSettings } from "@/types";
import { bodyOf, queryOf, type HandlerMap } from "../mock-transport";

function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export const notificationHandlers: HandlerMap = {
  "GET /notifications": (request) => {
    const query = queryOf(request);
    const db = readDb();

    let notifications = request.userId
      ? db.notifications.filter((item) => item.userId === request.userId)
      : db.notifications;

    if (query.type) {
      notifications = notifications.filter((item) => item.type === query.type);
    }
    if (query.unread === "true") {
      notifications = notifications.filter((item) => !item.read);
    }

    notifications = [...notifications].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );

    return ok(notifications, {
      total: notifications.length,
      page: 1,
      pageSize: notifications.length,
      totalPages: 1,
    });
  },

  "PATCH /notifications/:id/read": (request) => {
    const query = queryOf(request);
    const db = readDb();
    const notification = db.notifications.find((item) => item.id === query.id);

    if (!notification) {
      return fail("NOT_FOUND", "No such notification.", 404);
    }

    writeDb((current) => ({
      ...current,
      notifications: current.notifications.map((item) =>
        item.id === notification.id ? { ...item, read: true } : item,
      ),
    }));

    return ok({ ...notification, read: true });
  },

  "PATCH /notifications/read-all": (request) => {
    writeDb((current) => ({
      ...current,
      notifications: current.notifications.map((item) =>
        request.userId && item.userId !== request.userId
          ? item
          : { ...item, read: true },
      ),
    }));

    return ok({ success: true });
  },

  "DELETE /notifications/:id": (request) => {
    const query = queryOf(request);
    const db = readDb();

    if (!db.notifications.some((item) => item.id === query.id)) {
      return fail("NOT_FOUND", "No such notification.", 404);
    }

    writeDb((current) => ({
      ...current,
      notifications: current.notifications.filter(
        (item) => item.id !== query.id,
      ),
    }));

    return ok({ success: true });
  },
};

export const systemHandlers: HandlerMap = {
  "GET /stats/system": () => {
    const db = readDb();
    const today = todayIso();

    const appointments = db.appointments;
    const completed = appointments.filter(
      (item) => item.status === "COMPLETED",
    ).length;
    const noShow = appointments.filter(
      (item) => item.status === "NO_SHOW",
    ).length;
    const cancelled = appointments.filter(
      (item) => item.status === "CANCELLED",
    ).length;

    const byDate = new Map<string, number>();
    for (const appointment of appointments) {
      byDate.set(appointment.date, (byDate.get(appointment.date) ?? 0) + 1);
    }

    const appointmentsPerDay = [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([date, count]) => ({ date, count }));

    const byRole = db.users.reduce<Record<string, number>>((accumulator, user) => {
      accumulator[user.role] = (accumulator[user.role] ?? 0) + 1;
      return accumulator;
    }, {});

    return ok({
      totalUsers: db.users.length,
      activeUsers: db.users.filter((item) => item.active).length,
      usersByRole: byRole,
      totalHospitals: db.hospitals.length,
      verifiedHospitals: db.hospitals.filter(
        (item) => item.verificationStatus === "VERIFIED",
      ).length,
      totalCenters: db.centers.length,
      totalDoctors: db.doctors.length,
      totalPatients: db.users.filter((item) => item.role === "PATIENT").length,
      totalAppointments: appointments.length,
      appointmentsToday: appointments.filter((item) => item.date === today).length,
      completedAppointments: completed,
      cancelledAppointments: cancelled,
      noShowAppointments: noShow,
      totalRecords: db.records.length,
      totalReports: db.reports.length,
      appointmentsPerDay,
      noShowRate:
        appointments.length > 0
          ? Math.round((noShow / appointments.length) * 100)
          : 0,
    });
  },

  "GET /stats/center": (request) => {
    const query = queryOf(request);
    const db = readDb();

    let reports = db.reports;
    if (query.centerId) {
      reports = reports.filter((item) => item.centerId === query.centerId);
    }

    const today = todayIso();

    const byStatus = reports.reduce<Record<string, number>>(
      (accumulator, report) => {
        accumulator[report.status] = (accumulator[report.status] ?? 0) + 1;
        return accumulator;
      },
      {},
    );

    const byDate = new Map<string, number>();
    for (const report of reports) {
      const date = report.collectedDate ?? today;
      byDate.set(date, (byDate.get(date) ?? 0) + 1);
    }

    const reportsPerDay = [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([date, count]) => ({ date, count }));

    return ok({
      totalReports: reports.length,
      inQueue: byStatus.PENDING ?? 0,
      processing: byStatus.PROCESSING ?? 0,
      readyForDelivery: byStatus.READY ?? 0,
      delivered: byStatus.DELIVERED ?? 0,
      deliveredToday: reports.filter(
        (item) => item.deliveredDate === today,
      ).length,
      byStatus,
      reportsPerDay,
      averageProcessingHours: 18,
    });
  },

  "GET /staff": (request) => {
    const query = queryOf(request);
    const db = readDb();

    let staff = db.staff;
    if (query.hospitalId) {
      staff = staff.filter((item) => item.hospitalId === query.hospitalId);
    }

    return ok(staff, {
      total: staff.length,
      page: 1,
      pageSize: staff.length,
      totalPages: 1,
    });
  },

  "POST /staff": (request) => {
    const body = bodyOf(request);
    const db = readDb();

    const name = String(body.name ?? "").trim();
    const hospitalId = String(body.hospitalId ?? "");

    if (!name || !hospitalId) {
      return fail("VALIDATION_ERROR", "Please correct the highlighted fields.", 400, {
        ...(name ? {} : { name: "Name is required" }),
        ...(hospitalId ? {} : { hospitalId: "Choose a hospital" }),
      });
    }

    const created: HospitalStaff = {
      id: `S${String(db.counters.staff + 1).padStart(3, "0")}`,
      hospitalId,
      name,
      email: String(body.email ?? ""),
      phone: String(body.phone ?? ""),
      role: (body.role as HospitalStaff["role"]) ?? "Receptionist",
      shift: String(body.shift ?? "Day (9:00 – 17:00)"),
      active: true,
      joinedAt: todayIso(),
    };

    writeDb((current) => ({
      ...current,
      staff: [...current.staff, created],
      counters: { ...current.counters, staff: current.counters.staff + 1 },
    }));

    return ok(created);
  },

  "PATCH /staff/:id": (request) => {
    const query = queryOf(request);
    const body = bodyOf(request);
    const db = readDb();
    const member = db.staff.find((item) => item.id === query.id);

    if (!member) {
      return fail("NOT_FOUND", "No such staff member.", 404);
    }

    const updated: HospitalStaff = {
      ...member,
      name: body.name !== undefined ? String(body.name) : member.name,
      role:
        body.role !== undefined
          ? (body.role as HospitalStaff["role"])
          : member.role,
      shift: body.shift !== undefined ? String(body.shift) : member.shift,
      active:
        body.active !== undefined ? body.active === true : member.active,
    };

    writeDb((current) => ({
      ...current,
      staff: current.staff.map((item) =>
        item.id === updated.id ? updated : item,
      ),
    }));

    return ok(updated);
  },

  "GET /system/settings": () => {
    const db = readDb();
    return ok(db.settings);
  },

  "PATCH /system/settings": (request) => {
    const body = bodyOf(request);

    writeDb((current) => ({
      ...current,
      settings: { ...current.settings, ...body } as SystemSettings,
    }));

    const db = readDb();
    return ok(db.settings);
  },

  "POST /system/reset": () => {
    resetDb();
    return ok({ success: true, message: "The demo database has been reset." });
  },
};

import { fail, ok } from "@/api/envelope";
import { readDb, writeDb } from "@/demo/db";
import { DEMO_ACCOUNTS } from "@/demo/seed";
import type { PublicUser, User } from "@/types";
import { bodyOf, queryOf, type HandlerMap } from "../mock-transport";

/** Strip the password from a user before it leaves the mock transport. */
export function toPublicUser(user: User): PublicUser {
  const rest: Omit<User, "password"> = { ...user };
  delete (rest as Partial<User>).password;
  return rest as PublicUser;
}

export const authHandlers: HandlerMap = {
  "POST /auth/login": (request) => {
    const body = bodyOf(request);
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return fail(
        "VALIDATION_ERROR",
        "Email and password are required.",
        400,
        {
          ...(email ? {} : { email: "Email is required" }),
          ...(password ? {} : { password: "Password is required" }),
        },
      );
    }

    const db = readDb();
    const user = db.users.find(
      (item) => item.email.toLowerCase() === email,
    );

    if (!user || user.password !== password) {
      return fail(
        "INVALID_CREDENTIALS",
        "That email and password combination is not in the demo data.",
        401,
      );
    }

    if (!user.active) {
      return fail(
        "ACCOUNT_INACTIVE",
        "This account has been deactivated.",
        403,
      );
    }

    return ok(toPublicUser(user));
  },

  "POST /auth/register": (request) => {
    const body = bodyOf(request);
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const role = String(body.role ?? "PATIENT");

    const fields: Record<string, string> = {};
    if (!name) fields.name = "Name is required";
    if (!email) fields.email = "Email is required";
    if (!password || password.length < 6)
      fields.password = "Password must be at least 6 characters";
    if (fields.name || fields.email || fields.password) {
      return fail("VALIDATION_ERROR", "Please correct the highlighted fields.", 400, fields);
    }

    const db = readDb();
    if (db.users.some((item) => item.email.toLowerCase() === email)) {
      return fail(
        "EMAIL_TAKEN",
        "An account with that email already exists.",
        409,
        { email: "That email is already registered" },
      );
    }

    const created: User = {
      id: `U${Date.now().toString().slice(-8)}`,
      name,
      email,
      phone: String(body.phone ?? ""),
      role: role as User["role"],
      password,
      active: true,
      createdAt: new Date().toISOString(),
      dateOfBirth: (body.dateOfBirth as string) ?? null,
      gender: (body.gender as string) ?? null,
      bloodGroup: (body.bloodGroup as string) ?? null,
      address: (body.address as string) ?? null,
      emergencyContact: (body.emergencyContact as string) ?? null,
      nid: (body.nid as string) ?? null,
    };

    writeDb((current) => ({
      ...current,
      users: [...current.users, created],
    }));

    return ok(toPublicUser(created));
  },

  "POST /auth/logout": () => ok({ success: true }),

  "POST /auth/forgot-password": (request) => {
    const body = bodyOf(request);
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!email) {
      return fail("VALIDATION_ERROR", "Email is required.", 400, {
        email: "Email is required",
      });
    }

    // The prototype never sends an email. The response says so plainly so
    // nobody expects a message that will not arrive.
    return ok({
      sent: false,
      simulated: true,
      message:
        "No email is sent in this prototype. Resetting the password only updates the demo database.",
    });
  },

  "POST /auth/reset-password": (request) => {
    const body = bodyOf(request);
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!password || password.length < 6) {
      return fail("VALIDATION_ERROR", "Please correct the highlighted fields.", 400, {
        password: "Password must be at least 6 characters",
      });
    }

    const db = readDb();
    const user = db.users.find((item) => item.email.toLowerCase() === email);

    if (!user) {
      return fail("NOT_FOUND", "No account uses that email address.", 404, {
        email: "No account uses that email address",
      });
    }

    writeDb((current) => ({
      ...current,
      users: current.users.map((item) =>
        item.id === user.id ? { ...item, password } : item,
      ),
    }));

    return ok({ success: true, simulated: true });
  },

  "GET /auth/demo-accounts": () =>
    ok(
      DEMO_ACCOUNTS.map((account) => ({
        ...account,
        password: DEMO_PASSWORD_PLACEHOLDER,
      })),
    ),
};

/** The password every demo account uses. */
export const DEMO_PASSWORD_PLACEHOLDER = "demo1234";

export const userHandlers: HandlerMap = {
  "GET /users/me": (request) => {
    const db = readDb();
    const user = db.users.find((item) => item.id === request.userId);

    if (!user) {
      return fail("NOT_FOUND", "No signed-in user was found.", 404);
    }

    return ok(toPublicUser(user));
  },

  "PATCH /users/me": (request) => {
    const body = bodyOf(request);
    const db = readDb();
    const user = db.users.find((item) => item.id === request.userId);

    if (!user) {
      return fail("NOT_FOUND", "No signed-in user was found.", 404);
    }

    const updated: User = {
      ...user,
      name: body.name !== undefined ? String(body.name) : user.name,
      phone: body.phone !== undefined ? String(body.phone) : user.phone,
      address: body.address !== undefined ? String(body.address) : user.address,
      dateOfBirth:
        body.dateOfBirth !== undefined
          ? (body.dateOfBirth as string)
          : user.dateOfBirth,
      gender: body.gender !== undefined ? (body.gender as string) : user.gender,
      bloodGroup:
        body.bloodGroup !== undefined
          ? (body.bloodGroup as string)
          : user.bloodGroup,
      emergencyContact:
        body.emergencyContact !== undefined
          ? (body.emergencyContact as string)
          : user.emergencyContact,
      nid: body.nid !== undefined ? (body.nid as string) : user.nid,
    };

    writeDb((current) => ({
      ...current,
      users: current.users.map((item) =>
        item.id === updated.id ? updated : item,
      ),
    }));

    return ok(toPublicUser(updated));
  },

  "POST /users/me/password": (request) => {
    const body = bodyOf(request);
    const db = readDb();
    const user = db.users.find((item) => item.id === request.userId);

    if (!user) {
      return fail("NOT_FOUND", "No signed-in user was found.", 404);
    }

    if (user.password !== String(body.currentPassword ?? "")) {
      return fail("INVALID_CREDENTIALS", "The current password is incorrect.", 401, {
        currentPassword: "The current password is incorrect",
      });
    }

    const password = String(body.newPassword ?? "");
    if (password.length < 6) {
      return fail("VALIDATION_ERROR", "Please correct the highlighted fields.", 400, {
        newPassword: "Password must be at least 6 characters",
      });
    }

    writeDb((current) => ({
      ...current,
      users: current.users.map((item) =>
        item.id === user.id ? { ...item, password } : item,
      ),
    }));

    return ok({ success: true });
  },

  "GET /users": (request) => {
    const query = queryOf(request);
    const db = readDb();
    const actor = db.users.find((item) => item.id === request.userId);

    // Only the system administrator sees the whole user directory.
    if (!actor || actor.role !== "SYSTEM_ADMIN") {
      return fail(
        "NOT_ALLOWED",
        "Only the system administrator can list the user directory.",
        403,
      );
    }

    let users = db.users;

    if (query.role) {
      users = users.filter((item) => item.role === query.role);
    }
    if (query.active !== undefined && query.active !== "") {
      const active = query.active === "true";
      users = users.filter((item) => item.active === active);
    }
    if (query.search) {
      const needle = query.search.toLowerCase();
      users = users.filter((item) =>
        `${item.name} ${item.email} ${item.phone}`.toLowerCase().includes(needle),
      );
    }

    return ok(
      users.map(toPublicUser),
      { total: users.length, page: 1, pageSize: users.length, totalPages: 1 },
    );
  },

  "GET /patients": (request) => {
    const query = queryOf(request);
    const db = readDb();
    const actor = db.users.find((item) => item.id === request.userId);

    // A patient may only look themselves up.
    if (!actor) return ok([]);

    if (actor.role === "PATIENT") {
      return ok([toPublicUser(actor)]);
    }

    // Staff see the patients of their own hospital — the people whose
    // appointments they book at the counter.
    const hospitalId = query.hospitalId ?? actor.hospitalId ?? undefined;

    if (!hospitalId || !actor.hospitalId || hospitalId !== actor.hospitalId) {
      if (actor.role !== "SYSTEM_ADMIN") {
        return fail(
          "NOT_ALLOWED",
          "You can only look up the patients of your own hospital.",
          403,
        );
      }
    }

    const patientIds = new Set(
      db.appointments
        .filter((item) => item.hospitalId === hospitalId)
        .map((item) => item.patientId),
    );

    let patients = db.users.filter(
      (item) => item.role === "PATIENT" && patientIds.has(item.id),
    );

    if (query.search) {
      const needle = query.search.toLowerCase();
      patients = patients.filter((item) =>
        `${item.name} ${item.email} ${item.phone}`.toLowerCase().includes(needle),
      );
    }

    return ok(
      patients.map(toPublicUser),
      { total: patients.length, page: 1, pageSize: patients.length, totalPages: 1 },
    );
  },

  "PATCH /users/:id/status": (request) => {
    const query = queryOf(request);
    const body = bodyOf(request);
    const db = readDb();
    const user = db.users.find((item) => item.id === query.id);

    if (!user) {
      return fail("NOT_FOUND", "No such user.", 404);
    }

    const active = body.active === true || body.active === "true";

    writeDb((current) => ({
      ...current,
      users: current.users.map((item) =>
        item.id === user.id ? { ...item, active } : item,
      ),
    }));

    return ok(toPublicUser({ ...user, active }));
  },
};

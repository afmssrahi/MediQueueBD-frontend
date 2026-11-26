# How to use the appointment feature

Step by step — as a patient, at the reception desk, and from the code.

---

## Before you start

The app runs on demo data, so there is nothing to install beyond Docker.

```bash
cd frontend
docker compose up --build
```

Open <http://localhost:3000> and sign in.

---

## 1. As a patient

### Sign in

```
patient@mediqueue.bd  /  demo1234
```

### Book an appointment

1. Open **Book appointment** in the sidebar.
2. **Pick a doctor.** Search by name or speciality, then pick one from the
   list.
3. **Pick a date.** Only the days the doctor actually holds a clinic are
   offered — a doctor who works Monday to Thursday does not show a Saturday.
   Each date says how many slots are still free.
4. **Pick a slot.** The grid shows the doctor's session in 15-minute steps.
   A closed slot is greyed out and the tooltip says why:
   - *Already booked* — somebody else has it.
   - *This time has passed* — it is already today and the time has gone.
   - *The doctor is on a break* — no appointments are offered during it.
   - *Too close to book* — the clinic needs at least two hours' notice.
5. **Fill in the form** — the appointment type, the reason for your visit and
   how you will pay.
6. **Confirm.** You get a **token number**. Keep it — you will need it at
   reception.

The booking screen also tells you the rules up front: *appointments can be
booked up to 14 days ahead, and at least 120 minutes before the slot starts.*

### Manage your booking

Open **My appointments**.

| Tab | What is in it |
|---|---|
| **Upcoming** | Everything from today onwards that has not been completed, cancelled or marked a no-show. |
| **Previous** | Everything else, newest first. |

From an upcoming booking you can:

- **Reschedule** — pick a new date and slot. Your token number stays the
  same, because you are the same person in the same queue on the same day.
- **Cancel** — a reason is required. The slot is released and somebody else
  can book it.

Both stop working **two hours before the appointment starts**. After that,
speak to reception.

### One booking per doctor per day

If you already have a booking with a doctor on a date, booking another one
with the same doctor on the same date is refused. **Reschedule** the booking
you have instead.

---

## 2. At the reception desk

### Sign in

```
staff@mediqueue.bd  /  demo1234          (hospital staff)
hospitaladmin@mediqueue.bd  /  demo1234  (hospital administrator)
```

Open **Appointments** in the sidebar. This is the **appointment desk**. The
administrator's screen is the same component with wider filters.

### The counters

Four cards at the top of the desk:

| Card | What it counts |
|---|---|
| **Today** | Every appointment booked for today. |
| **Not yet arrived** | Today's bookings that are still `BOOKED` or `CONFIRMED`. |
| **Completed** | Today's consultations that are done. |
| **No-show** | Today's patients who did not arrive. |

### The list

The desk filters by:

- **Scope** — today, upcoming, or all dates.
- **Doctor** — one doctor, or all of them.
- **Status** — any status on the ladder.

The table itself is searchable and sortable, and shows the date and time, the
patient and their reason, the doctor, the token number, the payment state and
the status.

> The desk only ever shows your own hospital's bookings.

### Book for a patient

1. Click **Book for a patient**.
2. **Type the patient's name.** The list of your hospital's patients appears
   as you type; pick one.
3. **Pick the doctor, the date and the slot** — the same grid the patient
   sees, with the same rules.
4. **Fill in the type, the reason and the payment method.**
5. **Book.** The token number is issued and the patient gets a notification.

### Move, cancel or strike off a booking

From the **actions** column of any booking:

| Action | What it does |
|---|---|
| **Reschedule** | Opens the slot grid with the current slot marked. Pick a new date and time; the token number stays the same. |
| **Cancel** | Asks for a reason, cancels the booking and releases the slot. |
| **Mark no-show** | Asks for a reason, strikes the patient off for that date and releases the slot. |
| **Reinstate** | Shown on a cancelled booking — puts it back to `CONFIRMED`, for the booking that was cancelled by mistake. |

A booking that is already completed, cancelled or a no-show cannot be changed
any more.

### See it happen live

Open two windows side by side — one signed in as the patient, one as the
staff. Book at the desk and the patient's list updates on its own. No
refresh.

---

## 3. As a doctor

```
doctor@mediqueue.bd  /  demo1234
```

Open **Appointments**. Your own bookings, in two tabs:

- **Upcoming** — sorted by date and time, soonest first.
- **Previous** — newest first.

From here you can reschedule, cancel, mark a no-show or reinstate — the same
actions the reception desk has. The live queue actions (check in, call, start
the consultation, complete it) live on the **Queue board**.

---

## 4. From the code

### The API

The frontend talks to a route table — `src/api/routes.ts` — which is the
contract a real backend implements. In mock mode the same routes are served
by `src/api/mock-handlers.ts`, backed by the demo database.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/appointments` | The list. Filters: `patientId`, `doctorId`, `hospitalId`, `status`, `type`, `date`, `from`, `to`, `search`, `sort`. |
| `GET` | `/appointments/:id` | One appointment. |
| `POST` | `/appointments` | Book. Body: `patientId`, `doctorId`, `date`, `startMinute`, `type`, `reason`, `paymentMethod`, `isPaid`. |
| `POST` | `/appointments/:id/cancel` | Cancel. Body: `reason` — required. |
| `PATCH` | `/appointments/:id/reschedule` | Move. Body: `date`, `startMinute`. |
| `PATCH` | `/appointments/:id/status` | The administrative moves. Body: `status`, `reason`. |
| `GET` | `/slots` | The slot grid. Query: `doctorId`, `date`. |
| `GET` | `/patients` | The patients of your hospital — the people the desk books for. |

### Calling it from a service

Every feature service goes through `request()`, which resolves the transport,
sends the signed-in user and unwraps the envelope:

```ts
import { request } from "@/services/request";

const { data } = await request<Appointment[]>({
  method: "GET",
  path: "/appointments",
  query: { patientId: "U001", status: "CONFIRMED" },
});
```

A failed envelope becomes a thrown `ApiRequestError`, so the hooks can rely
on TanStack Query's error handling.

### The hooks

```ts
import {
  useAppointments,
  useBookAppointment,
  useCancelAppointment,
  useRescheduleAppointment,
  useSetAppointmentStatus,
  useSlots,
} from "@/features/appointments/hooks/use-appointments";
```

Every mutation invalidates the appointments, the slots, the queue and the
notifications — so the screens never show a stale list.

### The policy

The rules are pure functions, so they can be used anywhere:

```ts
import {
  checkBookingAllowed,
  checkChangeAllowed,
} from "@/domain/appointments/policy";

const decision = checkBookingAllowed({
  patientId,
  doctorId,
  date,
  startMinute,
  appointments,
  isClinicDay: true,
  slotIsTaken: false,
  today,
  nowMinute,
  settings: {
    appointmentLeadDays: 14,
    minimumNoticeMinutes: 120,
    changeCutoffMinutes: 120,
  },
});

if (!decision.allowed) {
  // decision.refusal.code — "SLOT_TAKEN", "CLINIC_CLOSED", …
  // decision.refusal.field — the field the message belongs to
  // decision.refusal.message — ready to show a person
}
```

### Changing the rules

The three numbers live in the demo database's settings and can be changed from
**System settings** in the admin area, or in the seed:

```
src/demo/seed/clinical.ts
```

```ts
export const DEFAULT_SETTINGS: SystemSettings = {
  appointmentLeadDays: 14,
  minimumNoticeMinutes: 120,
  changeCutoffMinutes: 120,
  // …
};
```

Changing them changes the screens and the server-side check together — they
read the same numbers.

---

## 5. The tests

```bash
npm run test -- src/domain/appointments
```

| File | What it covers |
|---|---|
| `policy.test.ts` | The rules on their own — the window, the notice period, the duplicate guard, the change check, the status ladder. |
| `slots.test.ts` | The slot grid — which slots exist and why each one is closed. |
| `booking.test.ts` | The whole lifecycle, through the mock transport. |

The lifecycle tests drive the mock transport — the same path the service layer
takes — so they exercise the real slot rules rather than a mock of them.

To add a case, write it the same way: set up the demo database with
`resetDb()`, pick a real clinic day and a real free slot, then make the call
and assert on the refusal code.

```ts
const response = await callRaw<Appointment>("POST", "/appointments", {
  body: bookingBody(doctorId, date, free.startMinute),
});

expect(response.success).toBe(false);
if (!response.success) {
  expect(response.error.code).toBe("SLOT_TAKEN");
}
```

---

## 6. Resetting the demo

Every change is stored in the browser's `localStorage`, so the demo never
picks up yesterday's bookings by accident — but if you want to start clean:

- **System admin → Reset demo data** — restores the original seed.
- Or clear the site's storage in the browser's developer tools.

---

## Where to read more

| Document | What it covers |
|---|---|
| [explanation.md](explanation.md) | How it works — the policy, the status ladder, the slot grid, the sync model. |
| [../../RUN.md](../../RUN.md) | Running the app with Docker. |
| [../../DOCKER.md](../../DOCKER.md) | The Docker image in detail. |

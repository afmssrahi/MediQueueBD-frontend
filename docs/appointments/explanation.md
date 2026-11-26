# How the appointment feature works

The rules, the screens, the status ladder and the sync model — and why each
one is the way it is.

---

## 1. The idea: one rule module, two callers

The appointment feature is rule-first. Every rule a real clinic follows lives
in one pure module:

```
src/domain/appointments/policy.ts
```

It has no React, no DOM and no I/O — so the same module can run in the browser
today and inside the Express backend tomorrow, and the rules **cannot drift**
between the two.

Two things ask it:

| Caller | What it asks |
|---|---|
| `POST /appointments` (booking) | `checkBookingAllowed` — may this patient book this slot? |
| `POST /appointments/:id/cancel`, `PATCH …/reschedule` | `checkChangeAllowed` — may this person change this booking? |

And a third module decides what a slot grid looks like:

```
src/domain/appointments/slots.ts
```

`generateSlots` produces the slot list and, for each slot, the reason it is
closed. The booking handler passes the **same** policy settings into it, so
the grid and the refusal always agree.

> **Why this matters:** the commonest failure in a booking prototype is a grid
> that offers a slot and a server that then refuses it. That cannot happen
> here, because both read the same numbers.

---

## 2. The rules

The rules come from the system settings in the demo database, so an
administrator can change them and the screens follow.

| Setting | Default | What it means |
|---|---|---|
| `appointmentLeadDays` | 14 | How far ahead a booking may be made. The window is inclusive on both ends. |
| `minimumNoticeMinutes` | 120 | How much notice the clinic needs before a slot starts. A slot inside this window is closed. `0` disables the rule. |
| `changeCutoffMinutes` | 120 | How long before the appointment it may still be changed. |

### The booking check

`checkBookingAllowed` applies the rules **in the order a receptionist would
apply them**:

1. **The booking window** — is the date within the lead days?
   → `OUTSIDE_BOOKING_WINDOW`
2. **The clinic day** — does the doctor actually work that weekday?
   → `CLINIC_CLOSED`
3. **The notice period** — is there enough time before the slot?
   → `LEAD_TIME_NOT_MET`
4. **The slot** — is it still free?
   → `SLOT_TAKEN`
5. **The duplicate** — does this patient already hold a live booking with
   this doctor on this date?
   → `DUPLICATE_BOOKING`

> **Why the slot check comes before the duplicate check:** it is the more
> specific answer. A patient who taps a slot that has just been taken needs to
> be told *that*, not that they already have an appointment.

### The change check

`checkChangeAllowed` answers three questions:

1. **Is it locked?** A completed, cancelled or no-show appointment cannot be
   changed at all. → `INVALID_TRANSITION`
2. **Is this person allowed to act on it?**
   - the patient who owns it, or
   - staff of the hospital the appointment belongs to (a doctor acts on their
     own list; the system administrator acts everywhere).
   → `NOT_ALLOWED`
3. **Is it still changeable?** A patient cannot touch a booking that has
   already started, and neither can staff, once the cutoff has passed.
   → `ALREADY_PAST`

---

## 3. The status ladder

An appointment walks forward through these states.

```
  BOOKED ──► CONFIRMED ──► CHECKED_IN ──► WAITING ──► CALLED ──► IN_CONSULTATION ──► COMPLETED
     │            │             │            │          │            │
     │            │             │            │          │            └──► CANCELLED
     │            │             │            │          └──► CANCELLED / NO_SHOW / SKIPPED / LATE
     │            │             │            └──► CANCELLED / NO_SHOW / SKIPPED / LATE
     │            │             └──► CANCELLED / NO_SHOW / LATE
     │            └──► CANCELLED / NO_SHOW
     └──► CANCELLED / NO_SHOW
```

Three things worth knowing:

- **`COMPLETED`, `CANCELLED` and `NO_SHOW` are locked.** Nothing moves them
  again. `SKIPPED` is the exception — it can go back to `WAITING`, `BOOKED` or
  `CONFIRMED`, because skipping a patient in the queue is not the end of their
  visit.
- **The live transitions belong to the queue reducer**, not to the
  appointment API. Checking in, calling and starting a consultation all move
  the waiting-time estimates, so they belong to the engine that owns them.
- **The administrative moves belong to the appointment API**:
  `PATCH /appointments/:id/status` handles striking a no-show off and
  reinstating a booking, and it refuses any move that is not on the ladder.

---

## 4. The slot grid

`GET /slots?doctorId=…&date=…` returns the slots a doctor offers on a date,
each with the reason it is closed.

| Reason | When |
|---|---|
| `BOOKED` | Another live appointment holds the slot. |
| `PAST` | The time has already gone by today. |
| `BREAK` | The slot falls inside the doctor's midday break. |
| `NOTICE` | The slot is too close — the clinic needs more notice. |

The grid is not just a list of times. A real clinic has:

- **a session window** — the doctor's hours (`sessionStart` … `sessionEnd`),
- **a break** — no appointment is offered while the doctor is at tea or at
  prayer, so the break is derived from the session window in the seed
  (`lunchBreakFor`),
- **clinic days** — `availableWeekdays` decides which dates exist at all, so
  the date picker only ever offers the days the doctor actually works.

The break notice is shown under the grid, so a gap in it is explained rather
than left to guesswork.

### The token number

The token number is **per doctor, per day**, and it is assigned at booking and
**never changes**. A reschedule keeps the number the patient already has —
because the patient is the same person, in the same queue, on the same day.

---

## 5. The screens

### The patient's booking screen

`/patient/book`

1. Pick a doctor.
2. Pick a date — only the doctor's real clinic days are offered, and each one
   says how many slots are still free.
3. Pick a slot — closed slots are greyed out with the reason in their tooltip.
4. Fill in the type, the reason for the visit and the payment method.
5. Confirm — the token number is shown and the appointment appears under
   **My appointments**.

The rules are stated on the screen: *how far ahead you may book* and *how much
notice the clinic needs*.

### The patient's appointment list

`/patient/appointments` — **Upcoming** and **Previous** tabs. From here the
patient can **reschedule** or **cancel**. A reason is required to cancel; the
server refuses a cancellation without one.

### The reception desk

`/hospital/appointments` (and `/hospital/admin/appointments`, which is the
same component with wider filters)

- **Book for a patient** — type the patient's name, pick the doctor, the date
  and the slot. The same rules apply as for a patient booking online, because
  it is the same handler.
- **Reschedule** — the same slot grid, with the current slot marked so the
  patient can keep the time they already have.
- **Cancel** — with a reason.
- **Mark a no-show** — the slot is released.
- **Reinstate** — a booking cancelled by mistake goes back to `CONFIRMED`.

The desk shows four counters (today, not yet arrived, completed, no-show) and
filters by today / upcoming / all, by doctor and by status. It is always
scoped to the signed-in user's own hospital.

### The doctor's list

`/doctor/appointments` — the doctor's own bookings, upcoming and previous.

---

## 6. The sync model

The prototype keeps its state in `localStorage`, so two tabs would otherwise
show stale bookings. Two mechanisms keep them in step:

| Mechanism | What it covers |
|---|---|
| `src/demo/sync.ts` — the change bus | A write made **in this tab** publishes on the bus. `src/app/providers.tsx` subscribes and invalidates the affected TanStack Query caches. |
| The browser's `storage` event | A write made in **another tab** fires `storage` in every other tab, which invalidates everything. |

A booking invalidates four things, because it changes four things:

```ts
["appointments"]   // the list
["slots"]          // the slot is now taken
["queue"]          // the patient is now in the queue
["notifications"]  // the patient has been told
```

So a booking made at the reception desk appears on the patient's list — with
no refresh, in another tab, on another screen.

> **When the real backend arrives**, the bus is replaced by a websocket or a
> short poll. The contract the UI sees is the same either way: a write
> invalidates a set of query keys.

---

## 7. Where the data lives

```
src/demo/seed/clinical.ts   the seeded appointments, relative to today
src/demo/db.ts              readDb / writeDb — the write publishes on the bus
src/demo/storage.ts         the localStorage persistence
src/demo/sync.ts            the change bus
```

`src/domain/**` and `src/demo/**` never import React and never touch the DOM,
so they lift unchanged into a real backend.

---

## 8. The failure modes

| What goes wrong | What happens |
|---|---|
| Two patients pick the same slot | The second booking is refused with `SLOT_TAKEN` (HTTP 409). The slot grid also stops offering it. |
| A patient books twice with the same doctor on the same day | Refused with `DUPLICATE_BOOKING`. The patient reschedules the booking they have. |
| A patient books outside the window | Refused with `OUTSIDE_BOOKING_WINDOW`. |
| A patient books on a day the doctor does not work | Refused with `CLINIC_CLOSED`. |
| A patient books inside the notice period | Refused with `LEAD_TIME_NOT_MET`, and the slot is closed in the grid. |
| A patient cancels without a reason | Refused with `VALIDATION_ERROR`. |
| A patient cancels somebody else's booking | Refused with `NOT_ALLOWED`. |
| Staff cancel a booking that has started | Allowed — the clinic can still strike a patient off, but only with a reason, and it is recorded. |
| An appointment moves to a status that is not on the ladder | Refused with `INVALID_TRANSITION` (HTTP 409). |

The refusals are typed: `src/domain/appointments/policy.ts` exports a
`RefusalCode` for each one, so the UI can branch on the code rather than
matching on the message.

---

## 9. Where the tests are

Three files, all under `src/domain/appointments/`:

| File | What it covers |
|---|---|
| `policy.test.ts` | The rules on their own — the booking window, the notice period, the duplicate guard, the change check, the status ladder. No database, no transport. |
| `slots.test.ts` | The slot grid — which slots exist, and why each one is closed. |
| `booking.test.ts` | The whole lifecycle, driven through the mock transport — the same path the service layer takes, so it exercises the real slot rules rather than a mock of them. |

```bash
npm run test -- src/domain/appointments
```

The lifecycle test covers:

- books an appointment and returns a token number
- lists the booked appointment under the patient
- rejects a second booking on a slot that is already taken
- releases the slot when the appointment is cancelled
- moves an appointment to a new slot when it is rescheduled
- refuses to reschedule onto a slot that is already taken
- refuses a booking beyond the lead time
- refuses a booking on a day the doctor does not work
- refuses a second booking with the same doctor on the same day
- refuses a cancellation without a reason
- does not let a patient cancel somebody else's booking
- does not let a patient book for somebody else
- sends a notification when a booking is made

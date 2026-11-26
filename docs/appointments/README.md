# The appointment feature

How booking, rescheduling and cancelling work in MediQueue BD — the rules, the
screens, and the code that enforces them.

| Document | What it covers |
|---|---|
| [explanation.md](explanation.md) | How it works — the policy, the status ladder, the slot grid, the sync model, and the design decisions behind them. |
| [how-to-use.md](how-to-use.md) | Using it — as a patient, at the reception desk, and from the code. |

---

## The short version

The appointment feature is **rule-first**. The rules live in one pure module —
`src/domain/appointments/policy.ts` — and both the screens and the booking
handler ask it. A slot that the grid shows as closed is closed for the same
reason the server will refuse it, and a booking that the patient is allowed to
make is allowed for the same reason the staff desk will allow it.

The three things it does:

1. **Books** — a patient picks a doctor, a clinic day and a slot.
2. **Keeps the slots honest** — a taken slot cannot be taken twice, a patient
   cannot hold two live bookings with the same doctor on the same day, and the
   clinic's notice period is respected.
3. **Manages** — the reception desk can book for a patient, reschedule, cancel
   with a reason, strike a no-show off and reinstate a booking.

---

## Where the code is

| Path | What it holds |
|---|---|
| `src/domain/appointments/policy.ts` | The rules. Pure TypeScript — no React, no DOM, no I/O. |
| `src/domain/appointments/slots.ts` | The slot grid: which slots exist, and why each one is closed. |
| `src/api/handlers/appointments.ts` | The API — booking, cancelling, rescheduling, the status moves and the slot list. |
| `src/features/appointments/` | The screens, the hooks and the service. |
| `src/app/(patient)/patient/book/` | The patient's booking screen. |
| `src/app/(hospital)/hospital/appointments/` | The reception desk. |
| `src/app/(hospital)/hospital/admin/appointments/` | The administrator's view of the same desk. |
| `src/app/(doctor)/doctor/appointments/` | The doctor's own list. |

The layering rule is the same as the rest of the app: `src/domain/**` never
imports React and never touches the DOM, so it lifts unchanged into a real
backend later.

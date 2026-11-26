# Running MediQueue BD — the frontend

Everything the app needs is baked into a Docker image, so a fresh clone only
requires **Docker**. No Node.js, no database, no API key.

```
docker compose up --build
```

Then open **<http://localhost:3000>**.

---

## Contents

| Section | What it covers |
|---|---|
| [1. What you get](#1-what-you-get) | The services and what each one does |
| [2. Before you start](#2-before-you-start) | The only prerequisite |
| [3. Run it](#3-run-it) | The commands, start to finish |
| [4. The demo accounts](#4-the-demo-accounts) | Who to sign in as |
| [5. Try the appointment feature](#5-try-the-appointment-feature) | A walkthrough of the booking rules |
| [6. Configuration](#6-configuration) | Every setting, with the defaults |
| [7. Running without Docker](#7-running-without-docker) | For development |
| [8. The checks](#8-the-checks) | How to verify the install |
| [9. Troubleshooting](#9-troubleshooting) | The problems people actually hit |

---

## 1. What you get

```
   your browser
        │
        ▼
┌───────────────────────────────────┐
│  frontend  :3000                  │
│  The Next.js app — six role       │
│  dashboards, the queue board, the  │
│  appointment desk, the AI summary  │
│  screen.                          │
│                                   │
│  /ai-service/**  ──proxied──►     │
└───────────────────────────────────┘
```

| Service | Port | What it is |
|---|---|---|
| `frontend` | 3000 | The Next.js 16 app. It runs on bundled demo data by default, so it works with no backend at all. |
| `ai-summary` | 4100 | A small Node.js service with **zero npm dependencies**. It uploads prescriptions, extracts the clinical fields, writes a clinician-facing summary and cites real literature from Europe PMC and PubMed. It is **optional** — see below. |

The browser only ever sees **one origin** (the frontend). The frontend proxies
`/ai-service/**` to the service, so there is no CORS to configure and no CORS
preflight on the file upload.

### The AI service is optional

The AI summary service lives in the sibling folder `../ai-summary-prototype`.
So that someone who has cloned **only** this folder is not stuck, it sits
behind a Compose **profile**:

```bash
docker compose up --build                # the frontend only
docker compose --profile ai up --build   # the frontend + the AI service
```

Without the AI service the app still runs — the `/patient/summary` screen falls
back to the bundled demo data.

---

## 2. Before you start

**Docker Desktop** — the only thing you need.

| Platform | Install |
|---|---|
| Windows | <https://docs.docker.com/desktop/setup/install/windows-install/> |
| macOS | <https://docs.docker.com/desktop/setup/install/mac-install/> |
| Linux | <https://docs.docker.com/engine/install/> |

Check that it works:

```bash
docker --version
docker compose version
```

> **Want the whole stack?** Use the compose file in the parent folder instead —
> it brings up the frontend, the AI summary service and an optional MySQL:
> `docker compose up --build` from the repository root.

---

## 3. Run it

From the `frontend/` folder:

```bash
docker compose up --build
```

Then open <http://localhost:3000>.

The first build takes a few minutes — it installs the full dependency tree and
runs `next build`. Later builds reuse the Docker layer cache and finish in
seconds.

To run it in the background:

```bash
docker compose up -d --build
```

Stop it with `Ctrl+C`, or in the background:

```bash
docker compose down            # stop and remove the containers
docker compose down --volumes  # also remove the cached volumes
```

### Without Compose

Plain Docker works too — the `Dockerfile` is the same one Compose uses:

```bash
# Build the image
docker build -t mediqueue-frontend:latest .

# Run it on http://localhost:3000
docker run --rm -p 3000:3000 mediqueue-frontend:latest
```

To run it in the background with a named container:

```bash
docker run -d --name mediqueue-frontend -p 3000:3000 mediqueue-frontend:latest

docker logs -f mediqueue-frontend   # follow the logs
docker stop mediqueue-frontend
```

### Useful commands

| Goal | Command |
| --- | --- |
| Start (rebuild if needed) | `docker compose up --build` |
| Start in the background | `docker compose up -d --build` |
| Start with the AI service | `docker compose --profile ai up -d --build` |
| View logs | `docker compose logs -f` |
| Check health | `docker compose ps` |
| Stop | `docker compose down` |
| Rebuild from scratch | `docker compose down && docker compose up --build` |
| Shell inside the container | `docker compose exec frontend sh` |
| Remove the built image | `docker rmi mediqueue-frontend:latest` |

---

## 4. The demo accounts

The app runs on demo data, so there is no sign-up. Go to
**<http://localhost:3000/login>** and pick a demo account — one per role.

| Role | Email | Password | What it shows |
|---|---|---|---|
| Patient | `patient@mediqueue.bd` | `demo1234` | Bookings, queue position, medical record, AI summary |
| Doctor | `doctor@mediqueue.bd` | `demo1234` | The live queue board, appointments |
| Hospital staff | `staff@mediqueue.bd` | `demo1234` | The appointment desk (reception) |
| Hospital admin | `hospitaladmin@mediqueue.bd` | `demo1234` | Statistics, doctor management, the appointment desk |
| Diagnostic centre | `diagnostic@mediqueue.bd` | `demo1234` | Report queue, patient lookup |
| System admin | `admin@mediqueue.bd` | `demo1234` | System overview, user management |

> **Tip:** open two browser windows side by side — a patient and a member of
> staff. A booking made in one appears in the other without a refresh.

---

## 5. Try the appointment feature

The appointment feature follows the rules a real clinic follows, and the rules
live in one place — `src/domain/appointments/policy.ts` — so the screen and the
booking handler cannot disagree.

### As a patient

1. Sign in as **patient@mediqueue.bd**.
2. Open **Book appointment** in the sidebar.
3. Pick a doctor. Only the days the doctor actually holds a clinic are
   offered, and each one says how many slots are still free.
4. Pick a slot. A slot is closed — with the reason in its tooltip — when it is
   **already booked**, **in the past**, **inside the doctor's break**, or **too
   close to book** (the clinic needs two hours' notice).
5. Confirm. You get a **token number**, and it appears in **My appointments**.

From **My appointments** you can **reschedule** or **cancel** (a reason is
required). Both stop working two hours before the appointment starts.

### As the reception desk

1. Sign in as **staff@mediqueue.bd**.
2. Open **Appointments** in the sidebar — this is the appointment desk.
3. **Book for a patient**: type the patient's name, pick the doctor, the date
   and the slot. The same rules apply as for a patient booking online.
4. **Reschedule** any booking, **cancel** it with a reason, **mark a no-show**
   (the slot is released), or **reinstate** a booking that was cancelled by
   mistake.

The desk is scoped to your own hospital, and the lists filter by today /
upcoming / all, by doctor and by status.

### What the rules are

| Rule | Value | Where it comes from |
|---|---|---|
| Book up to | 14 days ahead | `appointmentLeadDays` in the system settings |
| Minimum notice | 120 minutes | `minimumNoticeMinutes` |
| Change cutoff | 120 minutes before the start | `changeCutoffMinutes` |
| One live booking per doctor per day | — | `findDuplicateBooking` |
| A reason is required to cancel | — | the cancel handler |
| A patient may only touch their own bookings | — | `checkChangeAllowed` |

---

## 6. Configuration

Copy the example file and edit it:

```bash
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `NEXT_PUBLIC_API_MODE` | `mock` | `mock` = bundled demo data (no backend needed). `live` = call a real backend. |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:4000/api` | Backend base URL. Only used in `live` mode. |
| `AI_SERVICE_URL` | `http://ai-summary:4100/api` | The AI summary service. Server-side only — never exposed to the browser. |
| `PORT` | `3000` | Host port the app is published on. |
| `AI_PORT` | `4100` | Host port the AI summary service is published on. |

> **`NEXT_PUBLIC_*` variables are inlined into the browser bundle at build
> time.** Changing one requires a rebuild: `docker compose up --build`.

### Running against a real backend

Inside a container, `localhost` refers to the container itself — not your PC.
If the backend runs on your machine, use the host gateway instead:

```bash
# Linux
docker compose up --build
# then set NEXT_PUBLIC_API_BASE_URL=http://host.docker.internal:4000/api

# Windows / macOS (Docker Desktop)
# host.docker.internal resolves to the host machine — use it directly
NEXT_PUBLIC_API_BASE_URL=http://host.docker.internal:4000/api
```

If the backend is another Compose service, use its service name, e.g.
`http://backend:4000/api`.

---

## 7. Running without Docker

For development on your own machine:

```bash
npm install
npm run dev      # development server on http://localhost:3000
```

The app runs on the bundled demo database by default, so it works with no
backend. To point it at the AI summary service, set these in `frontend/.env`:

```bash
NEXT_PUBLIC_API_MODE=live
AI_SERVICE_URL=http://localhost:4100/api
```

`AI_SERVICE_URL` is read on the server side, so it is never exposed to the
browser — the browser calls `/ai-service/**` on this app's own origin and
Next.js proxies it to the service.

---

## 8. The checks

```bash
npm run typecheck   # types
npm run lint        # lint
npm run test        # unit tests
npm run build       # production build
npm run verify      # all four
```

---

## 9. Troubleshooting

**Port 3000 already in use**

Change the host port in `.env` (`PORT=3001`) or pass a different mapping:
`docker run -p 3001:3000 mediqueue-frontend:latest`.

**The page loads but shows no data**

The app runs on demo data by default. Confirm `NEXT_PUBLIC_API_MODE=mock` and
rebuild.

**The AI summary screen says the service is unreachable**

The AI summary service is a separate container, behind the `ai` profile. Start
it with:

```bash
docker compose --profile ai up -d ai-summary
curl http://localhost:4100/api/health
```

**Changes to the code are not showing**

Rebuild the image — the container uses the built output, not your local files:

```bash
docker compose up --build
```

**`npm ci` fails with a lockfile error**

The lockfile is out of sync with `package.json`. Regenerate it locally with
`npm install`, commit the updated `package-lock.json`, then rebuild the image.

**Check the container's health**

```bash
docker inspect --format '{{.State.Health.Status}}' mediqueue-frontend
```

---

## Where to read more

| Document | What is in it |
| --- | --- |
| [`DOCKER.md`](./DOCKER.md) | The Docker image in detail — the three build stages, the configuration, the troubleshooting |
| [`../README.md`](../README.md) | The whole stack, from the repository root |
| [`../ai-summary-prototype/docs/`](../ai-summary-prototype/docs) | The AI summary service — the API, the providers, the free solutions, the deployment |

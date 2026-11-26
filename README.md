# MediQueue BD — frontend

The Next.js 16 app for MediQueue BD: six role dashboards, the live queue
board, the medical record, and the AI summary screen.

## Run it with Docker

```bash
docker compose up --build
```

Then open <http://localhost:3000>. The full walkthrough — prerequisites, the
demo accounts, the configuration and the troubleshooting — is in
**[RUN.md](./RUN.md)**; the Docker image itself is documented in
**[DOCKER.md](./DOCKER.md)**.

This starts the frontend on its own. The AI summary service is behind the
`ai` profile, so add it with:

```bash
docker compose --profile ai up --build
```

For the whole stack — including the optional MySQL service — use the compose
file in the parent folder.

## Getting started (development)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with one of the
demo accounts on the login screen.

The app runs on a bundled demo database by default, so it works with no
backend. To point it at the AI summary service, set these in `frontend/.env`:

```bash
NEXT_PUBLIC_API_MODE=live
AI_SERVICE_URL=http://localhost:4100/api
```

`AI_SERVICE_URL` is read on the server side, so it is never exposed to the
browser — the browser calls `/ai-service/**` on this app's own origin and
Next.js proxies it to the service.

## The checks

```bash
npm run typecheck   # types
npm run lint        # lint
npm run test        # unit tests
npm run build       # production build
npm run verify      # all four
```

## How it is put together

| Folder | What it holds |
|---|---|
| `src/app/` | The routes — one folder per route group, one per role. |
| `src/api/` | The route table (the backend contract), the transport and the envelope. |
| `src/domain/` | Pure TypeScript: the queue, waiting-time, appointment and EMR engines. No React, no DOM. |
| `src/features/` | One slice per feature — components, hooks, services, schemas. |
| `src/demo/` | The seeded demo database and its fixtures. |
| `src/i18n/` | Every user-facing string, in English and Bangla. |
| `src/proxy.ts` | Proxies `/ai-service/**` to the AI summary service. |

The layering rule is simple: `src/domain/**` and `src/demo/**` never import
React and never touch the DOM, so they lift unchanged into a real backend
later.

## The documentation

| Document | What it covers |
|---|---|
| [RUN.md](./RUN.md) | Running the app with Docker — prerequisites, the demo accounts, the configuration, the troubleshooting. |
| [DOCKER.md](./DOCKER.md) | The Docker image in detail — the build stages, the configuration, the troubleshooting. |
| [docs/appointments/](./docs/appointments) | The appointment feature — the rules, the screens, the API and the tests. |

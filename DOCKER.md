# Running MediQueue BD — frontend with Docker

Everything the app needs is baked into the image, so a fresh clone only requires
**Docker** — no Node.js install on the host.

- `Dockerfile` — multi-stage build (deps → build → runtime)
- `docker-compose.yml` — one-command run (the frontend, with the AI summary service behind the optional `ai` profile)
- `src/proxy.ts` — proxies `/ai-service/**` to the AI summary service
- `.dockerignore` — keeps the build context small
- `.env.example` — optional configuration

> **Running the whole stack?** Use the compose file in the parent folder
> instead — it also brings up MySQL as an option:
> `docker compose up --build` from the repository root.

---

## 1. Prerequisites

Install **Docker Desktop** (Windows/macOS) or **Docker Engine + Compose v2** (Linux):

<https://docs.docker.com/get-docker/>

Check that it works:

```bash
docker --version
docker compose version
```

---

## 2. Quick start

From the `frontend/` folder:

```bash
docker compose up --build
```

Then open <http://localhost:3000>.

This starts the **frontend** on port 3000. The frontend proxies
`/ai-service/**` to the AI summary service, so add the service with the `ai`
profile to make the AI summary screen work:

```bash
docker compose --profile ai up --build
```

That starts **two** containers: the frontend on port 3000 and the AI summary
service on port 4100. The AI service is optional — without it the app still
runs, and the `/patient/summary` screen falls back to the bundled demo data.

The first build takes a few minutes (it installs the full dependency tree and
runs `next build`). Later builds reuse the Docker layer cache and finish in
seconds.

To run it in the background:

```bash
docker compose up -d --build
```

Stop it with `Ctrl+C`, or in the background:

```bash
docker compose down          # stop and remove the containers
docker compose down --volumes  # also remove cached volumes
```

---

## 3. Without Docker Compose

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

---

## 4. Useful commands

| Goal | Command |
| --- | --- |
| Start (rebuild if needed) | `docker compose up --build` |
| Start in the background | `docker compose up -d --build` |
| Start with the AI summary service | `docker compose --profile ai up -d --build` |
| View logs | `docker compose logs -f` |
| Check health | `docker compose ps` |
| Stop | `docker compose down` |
| Rebuild from scratch | `docker compose down && docker compose up --build` |
| Shell inside the container | `docker compose exec frontend sh` |
| Remove the built image | `docker rmi mediqueue-frontend:latest` |

---

## 5. Configuration

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

## 6. How it works

1. **deps** — `npm ci` installs the exact tree from `package-lock.json`.
2. **build** — `npm run build` runs `next build`. `next.config.ts` sets
   `output: "standalone"`, so the build emits a self-contained
   `.next/standalone` folder with only the traced runtime files.
3. **runner** — the final image copies `public/`, `.next/static` and
   `.next/standalone`, then starts the minimal server with `node server.js`.

The runtime image contains no build toolchain and no dev dependencies, and the
app runs as the unprivileged `nextjs` user.

---

## 7. Troubleshooting

**Port 3000 already in use**
Change the host port in `.env` (`PORT=3001`) or pass a different mapping:
`docker run -p 3001:3000 mediqueue-frontend:latest`.

**The page loads but shows no data**
The app runs on demo data by default. Confirm `NEXT_PUBLIC_API_MODE=mock` and
rebuild.

**The AI summary screen says the service is unreachable**
The AI summary service is a separate container, behind the `ai` profile.
Start it with:

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

## 8. Running without Docker (for development)

```bash
npm install
npm run dev      # development server on http://localhost:3000
npm run verify   # typecheck + lint + tests + production build
```

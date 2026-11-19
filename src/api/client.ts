import { HttpTransport } from "./http-transport";
import { mockTransport } from "./mock-handlers";
import type { Transport } from "./transport";
import { useSession } from "@/stores/session";

/**
 * The transport resolver — the single switch point between demo data and the
 * real backend.
 *
 * `NEXT_PUBLIC_API_MODE=mock` (the default) uses the demo database.
 * `NEXT_PUBLIC_API_MODE=live` calls the Express backend at
 * `NEXT_PUBLIC_API_BASE_URL`. No UI code changes either way.
 */

export type ApiMode = "mock" | "live";

export function resolveApiMode(): ApiMode {
  const mode = process.env.NEXT_PUBLIC_API_MODE;
  return mode === "live" ? "live" : "mock";
}

export function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";
}

/** The transport for the live mode. */
export function createHttpTransport(): Transport {
  return new HttpTransport(apiBaseUrl());
}

let cachedTransport: Transport | null = null;

/**
 * The active transport.
 *
 * The live transport needs the signed-in user, so it reads the session lazily
 * on every request rather than capturing it at construction time.
 */
export function getTransport(): Transport {
  if (resolveApiMode() === "live") {
    if (!cachedTransport) {
      cachedTransport = new HttpTransport(apiBaseUrl(), () => {
        const user = useSession.getState().user;
        return user ? `demo-session-${user.id}` : null;
      });
    }
    return cachedTransport;
  }

  return mockTransport;
}

/** Reset the cached transport — used by the tests. */
export function resetTransport(): void {
  cachedTransport = null;
}

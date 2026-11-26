import { AiServiceTransport } from "./ai-service-transport";
import { mockTransport } from "./mock-handlers";
import { resolveApiMode } from "./client";
import type { Transport } from "./transport";

/**
 * The AI summary service client.
 *
 * The AI summary service is a **separate backend** from the main MediQueue
 * API. It lives at `NEXT_PUBLIC_AI_API_BASE_URL` and defaults to
 * `/ai-service` — a same-origin path that the Next.js rewrite proxies to the
 * service. Going through the rewrite means the browser only ever talks to one
 * origin, so there is no CORS setup to do.
 *
 * The service speaks the same `{ success, data, error, meta }` envelope as the
 * main API, so the same unwrapping code works for both.
 */

/** The base URL the browser calls. */
export function aiServiceBaseUrl(): string {
  return process.env.NEXT_PUBLIC_AI_API_BASE_URL ?? "/ai-service";
}

let cachedTransport: Transport | null = null;

/**
 * The transport for the AI summary service.
 *
 * In demo mode the mock transport answers the `/ai-service/**` routes, so the
 * page works with no backend running. In live mode the request goes to the
 * real service through the rewrite.
 */
export function getAiServiceTransport(): Transport {
  if (resolveApiMode() === "mock") {
    return mockTransport;
  }

  if (!cachedTransport) {
    cachedTransport = new AiServiceTransport(aiServiceBaseUrl());
  }
  return cachedTransport;
}

/** Reset the cached transport — used by the tests. */
export function resetAiServiceTransport(): void {
  cachedTransport = null;
}

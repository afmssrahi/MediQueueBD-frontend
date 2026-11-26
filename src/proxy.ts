import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * The proxy to the AI summary service.
 *
 * The browser calls the AI summary service through this same-origin path
 * (`/ai-service/**`), so there is no CORS setup to do and no CORS preflight on
 * the multipart upload.
 *
 * **Why this is a proxy and not a `rewrites()` entry in `next.config.ts`:**
 * `next.config.ts` is evaluated at **build** time, so the rewrite destination
 * is frozen into the built routes manifest. The image is built once and then
 * configured at run time through `AI_SERVICE_URL` — a rewrite cannot honour
 * that. A proxy reads the variable when the request arrives, so the same
 * image can point at a different service without being rebuilt.
 *
 * The target is read from `AI_SERVICE_URL` (server-side only, so it is never
 * exposed to the browser) and defaults to the service's local port.
 */

/** The path prefix the browser calls. */
const PREFIX = "/ai-service";

/**
 * The AI summary service's base URL.
 *
 * Read per request so the value can change between requests in development.
 */
function aiServiceUrl(): string {
  return (process.env.AI_SERVICE_URL ?? "http://localhost:4100/api").replace(
    /\/$/,
    "",
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The prefix is stripped on the way out — the service serves its routes from
  // the root of its own base URL.
  const rest = pathname.slice(PREFIX.length) || "/";
  const destination = new URL(`${aiServiceUrl()}${rest}`);

  // The query string is part of the request, so it is carried over.
  request.nextUrl.searchParams.forEach((value, key) => {
    destination.searchParams.append(key, value);
  });

  return NextResponse.rewrite(destination);
}

export const config = {
  matcher: "/ai-service/:path*",
};

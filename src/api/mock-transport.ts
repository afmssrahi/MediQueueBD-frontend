import { fail, ok, type ApiResponse } from "@/api/envelope";
import type { Transport, TransportRequest } from "@/api/transport";
import { DEMO } from "@/lib/constants";

/**
 * The mock transport.
 *
 * It implements the same route table the future Express backend will
 * implement, against the demo database. Latency is simulated so loading
 * states are real rather than decorative.
 */

export type Handler = (
  request: TransportRequest,
) => Promise<ApiResponse<unknown>> | ApiResponse<unknown>;

export type HandlerMap = Record<string, Handler>;

/** Build the handler key for a method + path. */
export function handlerKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

/** Simulated network latency, so loading states are exercised. */
export async function simulateLatency(): Promise<void> {
  const span = DEMO.LATENCY_MAX_MS - DEMO.LATENCY_MIN_MS;
  const delay = DEMO.LATENCY_MIN_MS + Math.random() * span;
  await new Promise((resolve) => setTimeout(resolve, delay));
}

/** Strip the query string from a path. */
export function pathOnly(path: string): string {
  const index = path.indexOf("?");
  return index === -1 ? path : path.slice(0, index);
}

/**
 * Match a request against a path pattern containing `:params`.
 *
 * Returns the extracted parameters, or null when the pattern does not match.
 */
export function matchPath(
  pattern: string,
  path: string,
): Record<string, string> | null {
  const patternSegments = pattern.split("/");
  const pathSegments = path.split("/");

  if (patternSegments.length !== pathSegments.length) return null;

  const params: Record<string, string> = {};

  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index];
    const pathSegment = pathSegments[index];

    if (patternSegment.startsWith(":")) {
      params[patternSegment.slice(1)] = decodeURIComponent(pathSegment);
      continue;
    }

    if (patternSegment !== pathSegment) return null;
  }

  return params;
}

export class MockTransport implements Transport {
  readonly name = "mock" as const;

  constructor(private readonly handlers: HandlerMap) {}

  async request<T>(request: TransportRequest): Promise<ApiResponse<T>> {
    await simulateLatency();

    const path = pathOnly(request.path);
    const query = request.query ?? {};

    // Exact match first — "/users/me" must beat "/users/:id".
    const exact = this.handlers[handlerKey(request.method, path)];
    if (exact) {
      return (await exact(request)) as ApiResponse<T>;
    }

    // Then the parameterised patterns.
    for (const [key, handler] of Object.entries(this.handlers)) {
      const [method, pattern] = key.split(" ");
      if (method !== request.method.toUpperCase()) continue;

      const params = matchPath(pattern, path);
      if (!params) continue;

      const enriched: TransportRequest = { ...request, query: { ...query, ...params } };
      return (await handler(enriched)) as ApiResponse<T>;
    }

    return fail(
      "ROUTE_NOT_FOUND",
      `No mock handler is registered for ${request.method} ${path}.`,
      404,
    );
  }
}

/** Read the query parameters of a request as strings. */
export function queryOf(request: TransportRequest): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(request.query ?? {})) {
    if (value === undefined || value === null) continue;
    result[key] = String(value);
  }

  return result;
}

/** Read the request body as a record. */
export function bodyOf(request: TransportRequest): Record<string, unknown> {
  return (request.body ?? {}) as Record<string, unknown>;
}

export { ok, fail };

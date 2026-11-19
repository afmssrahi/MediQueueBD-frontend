/**
 * The transport contract.
 *
 * A transport turns a method + path + body into an `ApiResponse`. The mock
 * transport implements it against the demo database; the HTTP transport
 * implements it against the future backend. The UI never sees either one.
 */

import type { ApiResponse } from "./envelope";

export interface TransportRequest {
  method: string;
  path: string;
  /** Query parameters, already stringified. */
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  /** The signed-in user id, when there is one. */
  userId?: string | null;
}

export interface Transport {
  readonly name: "mock" | "live";
  request<T>(request: TransportRequest): Promise<ApiResponse<T>>;
}

/** Build a query string, dropping empty values. */
export function buildQueryString(
  query: TransportRequest["query"] = {},
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }

  const serialised = params.toString();
  return serialised ? `?${serialised}` : "";
}

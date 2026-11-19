import { fail, type ApiResponse } from "./envelope";
import type { Transport, TransportRequest } from "./transport";

/**
 * The live transport — talks to the future Express backend.
 *
 * It normalises whatever the server returns into the same envelope the mock
 * transport produces, so a service function cannot tell the two apart.
 */
export class HttpTransport implements Transport {
  readonly name = "live" as const;

  constructor(
    private readonly baseUrl: string,
    private readonly getAuthToken: () => string | null = () => null,
  ) {}

  async request<T>({
    method,
    path,
    query,
    body,
  }: TransportRequest): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl.replace(/\/$/, "")}${path}${
      query ? buildQuery(query) : ""
    }`;

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const token = this.getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        return (
          (payload as ApiResponse<T>) ??
          fail(
            "HTTP_ERROR",
            `The request failed with status ${response.status}.`,
            response.status,
          )
        );
      }

      if (payload && typeof payload === "object" && "success" in payload) {
        return payload as ApiResponse<T>;
      }

      return {
        success: true,
        data: payload as T,
        error: null,
        meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      };
    } catch (error) {
      return fail(
        "NETWORK_ERROR",
        error instanceof Error
          ? error.message
          : "The server could not be reached.",
        0,
      );
    }
  }
}

function buildQuery(query: Record<string, string | number | boolean | undefined | null>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const serialised = params.toString();
  return serialised ? `?${serialised}` : "";
}

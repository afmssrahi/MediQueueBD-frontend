import { fail, type ApiResponse } from "@/api/envelope";
import type { Transport, TransportRequest } from "@/api/transport";

/**
 * The AI summary service transport.
 *
 * The AI summary service is a **separate backend** from the main MediQueue
 * API — it has its own base URL and its own upload endpoint. This transport
 * talks to it.
 *
 * Two things make it different from `HttpTransport`:
 *
 *  - **Multipart uploads.** The document upload takes `FormData`, not JSON, so
 *    the body is passed through untouched and the browser sets the
 *    `Content-Type` boundary itself.
 *  - **The path prefix.** The frontend's route table namespaces these routes
 *    as `/ai-service/**` so they cannot collide with the main API's routes.
 *    The real service serves them from the root of its own base URL, so the
 *    prefix is stripped on the way out.
 */
export class AiServiceTransport implements Transport {
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
    const url = `${this.baseUrl.replace(/\/$/, "")}${stripPrefix(path)}${
      query ? buildQuery(query) : ""
    }`;

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    const isFormData =
      typeof FormData !== "undefined" && body instanceof FormData;

    if (body !== undefined && !isFormData) {
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
        body:
          body === undefined
            ? undefined
            : isFormData
              ? (body as FormData)
              : JSON.stringify(body),
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
          : "The AI summary service could not be reached.",
        0,
      );
    }
  }
}

/**
 * Remove the `/ai-service` namespace from a path.
 *
 * @param path
 */
function stripPrefix(path: string): string {
  const stripped = path.replace(/^\/ai-service(?=\/|$)/, "");
  return stripped || "/";
}

function buildQuery(
  query: Record<string, string | number | boolean | undefined | null>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const serialised = params.toString();
  return serialised ? `?${serialised}` : "";
}

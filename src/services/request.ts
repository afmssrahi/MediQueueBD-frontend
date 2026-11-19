import {
  ApiRequestError,
  type ApiResponse,
  type PageMeta,
} from "@/api/envelope";
import { getTransport } from "@/api/client";
import { useSession } from "@/stores/session";

/**
 * The shared service helper.
 *
 * Every feature service calls `request()` — it resolves the transport, sends
 * the current user id, and unwraps the envelope. A failed envelope becomes a
 * thrown `ApiRequestError`, so the hooks can rely on TanStack Query's error
 * handling without every service repeating the unwrap.
 */

export interface ServiceRequest {
  method: string;
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  /** Override the signed-in user — used by admin screens acting on others. */
  userId?: string | null;
}

export async function request<T>(
  options: ServiceRequest,
): Promise<{ data: T; meta: PageMeta }> {
  const transport = getTransport();
  const sessionUserId = useSession.getState().user?.id ?? null;

  const response = await transport.request<T>({
    method: options.method,
    path: options.path,
    query: options.query,
    body: options.body,
    userId: options.userId ?? sessionUserId,
  });

  if (!response.success) {
    throw new ApiRequestError(response.error);
  }

  return { data: response.data, meta: response.meta };
}

/** Like `request`, but returns the full envelope instead of throwing. */
export async function requestRaw<T>(
  options: ServiceRequest,
): Promise<ApiResponse<T>> {
  const transport = getTransport();
  const sessionUserId = useSession.getState().user?.id ?? null;

  return transport.request<T>({
    method: options.method,
    path: options.path,
    query: options.query,
    body: options.body,
    userId: options.userId ?? sessionUserId,
  });
}

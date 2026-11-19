/**
 * The one response shape every endpoint uses.
 *
 * Services unwrap this envelope, so a component never sees a raw array or a
 * raw error — it sees `data` or a typed `error`.
 */

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiError {
  code: string;
  message: string;
  /** Field-level validation errors, keyed by field name. */
  fields?: Record<string, string>;
  status: number;
}

export type ApiResponse<T> =
  | { success: true; data: T; error: null; meta: PageMeta }
  | { success: false; data: null; error: ApiError; meta: PageMeta };

export const EMPTY_META: PageMeta = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0,
};

/** Build a successful envelope. */
export function ok<T>(data: T, meta: Partial<PageMeta> = {}): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
    meta: { ...EMPTY_META, ...meta },
  };
}

/** Build a failed envelope. */
export function fail(
  code: string,
  message: string,
  status = 400,
  fields?: Record<string, string>,
): ApiResponse<never> {
  return {
    success: false,
    data: null,
    error: { code, message, status, fields },
    meta: EMPTY_META,
  };
}

/** A paginated list response. */
export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

/** Slice a list into a paginated payload. */
export function paginate<T>(
  items: T[],
  page = 1,
  pageSize = 20,
): Paginated<T> {
  const safePageSize = Math.max(1, pageSize);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * safePageSize;

  return {
    items: items.slice(start, start + safePageSize),
    meta: { page: safePage, pageSize: safePageSize, total, totalPages },
  };
}

/** Thrown by services when an envelope carries a failure. */
export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields: Record<string, string> | undefined;

  constructor(error: ApiError) {
    super(error.message);
    this.name = "ApiRequestError";
    this.code = error.code;
    this.status = error.status;
    this.fields = error.fields;
  }
}

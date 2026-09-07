import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema';

/**
 * Typed client generated from the API's OpenAPI document (npm run api:types).
 * Base URL is the same-origin proxy, so the browser never sees the API host or
 * the token. A backend field rename becomes a compile error here, not a runtime bug.
 */

export class ApiError extends Error {
  readonly name = 'ApiError';

  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly requestId?: string,
  ) {
    super(message);
  }

  /** `{ 'body.checkIn': 'msg' }` from the API becomes `{ checkIn: 'msg' }` for forms. */
  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    const out: Record<string, string> = {};
    for (const d of this.details as Array<{ path?: string; message?: string }>) {
      if (!d.path || !d.message) continue;
      const field = d.path.replace(/^(body|query|params)\./, '');
      out[field] ??= d.message;
    }
    return out;
  }
}

export function toApiError(status: number, body: unknown): ApiError {
  const err = (body as { error?: { code?: string; message?: string; details?: unknown; requestId?: string } } | null)
    ?.error;
  if (err?.code && err.message) return new ApiError(status, err.code, err.message, err.details, err.requestId);
  if (status === 0) return new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server');
  return new ApiError(status, 'HTTP_ERROR', `Request failed with status ${status}`);
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

/** Unwraps openapi-fetch's result tuple into data-or-throw for TanStack Query. */
export function ok<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || !result.response.ok) {
    throw toApiError(result.response.status, result.error);
  }
  return result.data as T;
}

const redirectOnExpiredSession: Middleware = {
  onResponse({ response }) {
    if (response.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      const login = new URL('/login', window.location.origin);
      login.searchParams.set('reason', 'expired');
      login.searchParams.set('next', window.location.pathname + window.location.search);
      // Full navigation (not router.push) so React Query state is dropped with the session.
      window.location.assign(login.toString());
    }
    return response;
  },
};

export const api = createClient<paths>({ baseUrl: '/api' });
api.use(redirectOnExpiredSession);

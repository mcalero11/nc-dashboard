import type { ApiErrorResponse } from '@nc-dashboard/shared';
import { API_PATHS } from './constants';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public error?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  try {
    const res = await fetch(API_PATHS.AUTH_REFRESH, { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    if (path === API_PATHS.AUTH_REFRESH) {
      window.location.href = '/?expired=true';
      return new Promise<never>(() => {});
    }

    refreshPromise ??= attemptRefresh().finally(() => {
      refreshPromise = null;
    });

    const refreshed = await refreshPromise;
    if (refreshed) {
      const retryRes = await fetch(path, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (retryRes.status === 401) {
        window.location.href = '/?expired=true';
        return new Promise<never>(() => {});
      }

      if (!retryRes.ok) {
        let errorData: ApiErrorResponse | undefined;
        try {
          errorData = await retryRes.json();
        } catch {
          // Response body is not JSON
        }
        const message = Array.isArray(errorData?.message)
          ? errorData.message.join(', ')
          : errorData?.message || retryRes.statusText;
        throw new ApiError(retryRes.status, message, errorData?.error);
      }

      if (retryRes.status === 204) return undefined as T;
      return retryRes.json();
    }

    window.location.href = '/?expired=true';
    return new Promise<never>(() => {});
  }

  if (!res.ok) {
    let errorData: ApiErrorResponse | undefined;
    try {
      errorData = await res.json();
    } catch {
      // Response body is not JSON
    }
    const message = Array.isArray(errorData?.message)
      ? errorData.message.join(', ')
      : errorData?.message || res.statusText;
    throw new ApiError(res.status, message, errorData?.error);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

import type { JwtPayload } from '@nc-dashboard/shared';
import { API_PATHS } from './constants';

const API_BASE_URL = process.env.API_INTERNAL_URL || 'http://localhost:3001';

export class UserLookupError extends Error {
  constructor(message = 'Unable to verify your session right now.') {
    super(message);
    this.name = 'UserLookupError';
  }
}

export function getApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export function getSessionRefreshUrl(returnTo: string): string {
  return `${API_PATHS.AUTH_SESSION}?returnTo=${encodeURIComponent(returnTo)}`;
}

export async function getUser(cookie?: string): Promise<JwtPayload | null> {
  try {
    const res = await fetch(getApiUrl(API_PATHS.AUTH_ME), {
      headers: cookie ? { Cookie: cookie } : {},
      cache: 'no-store',
    });
    if (res.status === 401) {
      return null;
    }
    if (!res.ok) {
      throw new UserLookupError();
    }
    return res.json();
  } catch (error) {
    if (error instanceof UserLookupError) {
      throw error;
    }
    throw new UserLookupError();
  }
}

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getApiUrl } from '@/lib/auth';
import { API_PATHS } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSafeReturnTo(returnTo: string | null): string {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return '/dashboard';
  }

  return returnTo;
}

function buildExpiredRedirect(request: NextRequest): URL {
  const url = new URL('/', request.url);
  url.searchParams.set('expired', 'true');
  return url;
}

function clearJwtCookie(response: NextResponse) {
  response.cookies.set('jwt', '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

function mergeCookieHeader(
  cookieHeader: string,
  setCookieHeader: string,
): string {
  const updatedCookie = setCookieHeader.split(';', 1)[0];
  if (!updatedCookie) {
    return cookieHeader;
  }

  const [cookieName] = updatedCookie.split('=', 1);
  const otherCookies = cookieHeader
    .split(/;\s*/)
    .filter(Boolean)
    .filter((cookie) => !cookie.startsWith(`${cookieName}=`));

  return [...otherCookies, updatedCookie].join('; ');
}

function appendSetCookie(
  response: NextResponse,
  setCookieHeader: string | null,
) {
  if (setCookieHeader) {
    response.headers.append('set-cookie', setCookieHeader);
  }
}

async function fetchUser(cookieHeader: string): Promise<Response> {
  return fetch(getApiUrl(API_PATHS.AUTH_ME), {
    cache: 'no-store',
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  });
}

async function fetchRefresh(cookieHeader: string): Promise<Response> {
  return fetch(getApiUrl(API_PATHS.AUTH_REFRESH), {
    cache: 'no-store',
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
    method: 'POST',
  });
}

export async function GET(request: NextRequest) {
  const returnTo = getSafeReturnTo(
    request.nextUrl.searchParams.get('returnTo'),
  );
  const cookieHeader = request.headers.get('cookie') ?? '';
  const jwt = request.cookies.get('jwt')?.value;

  if (!jwt) {
    return NextResponse.redirect(buildExpiredRedirect(request));
  }

  const meResponse = await fetchUser(cookieHeader);
  if (meResponse.ok) {
    return NextResponse.redirect(new URL(returnTo, request.url));
  }

  if (meResponse.status !== 401) {
    const response = NextResponse.redirect(buildExpiredRedirect(request));
    clearJwtCookie(response);
    return response;
  }

  const refreshResponse = await fetchRefresh(cookieHeader);
  const refreshSetCookie = refreshResponse.headers.get('set-cookie');

  if (!refreshResponse.ok) {
    const response = NextResponse.redirect(buildExpiredRedirect(request));
    appendSetCookie(response, refreshSetCookie);

    if (!refreshSetCookie) {
      clearJwtCookie(response);
    }

    return response;
  }

  if (!refreshSetCookie) {
    const response = NextResponse.redirect(buildExpiredRedirect(request));
    clearJwtCookie(response);
    return response;
  }

  const retryCookieHeader = mergeCookieHeader(cookieHeader, refreshSetCookie);
  const retryMeResponse = await fetchUser(retryCookieHeader);
  if (!retryMeResponse.ok) {
    const response = NextResponse.redirect(buildExpiredRedirect(request));
    clearJwtCookie(response);
    return response;
  }

  const response = NextResponse.redirect(new URL(returnTo, request.url));
  appendSetCookie(response, refreshSetCookie);
  return response;
}

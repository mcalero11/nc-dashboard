import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { API_PATHS } from './lib/constants';

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === API_PATHS.AUTH_SESSION) {
    return NextResponse.next();
  }

  // Proxy API requests to the backend service (runtime env var for Docker support)
  if (pathname.startsWith('/api/')) {
    const apiUrl = process.env.API_INTERNAL_URL || 'http://localhost:3001';
    const url = new URL(`${pathname}${request.nextUrl.search}`, apiUrl);
    return NextResponse.rewrite(url);
  }

  const jwt = request.cookies.get('jwt');

  // Protect dashboard and authorized routes — redirect to login if no JWT cookie
  if (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/setup') ||
    pathname.startsWith('/authorized')
  ) {
    if (!jwt?.value) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  // Redirect authenticated users away from login page
  if (pathname === '/' && jwt?.value) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  if (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/setup') ||
    pathname.startsWith('/authorized')
  ) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-current-path', `${pathname}${search}`);
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/', '/dashboard/:path*', '/setup/:path*', '/authorized'],
};

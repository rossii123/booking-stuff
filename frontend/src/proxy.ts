import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/server/config';
import { decodeJwt } from '@/lib/server/session';

/**
 * Optimistic auth gate for page navigations. It only checks that a plausible,
 * unexpired session cookie exists — cheap, no network. Real authorization
 * happens in the API on every call.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const claims = token ? decodeJwt(token) : null;
  const signedIn = !!claims && claims.exp * 1000 > Date.now();

  if (pathname === '/login') {
    return signedIn ? NextResponse.redirect(new URL('/reservations', request.url)) : NextResponse.next();
  }

  if (!signedIn) {
    const login = new URL('/login', request.url);
    if (pathname !== '/') login.searchParams.set('next', pathname + search);
    const response = NextResponse.redirect(login);
    if (token) response.cookies.delete(SESSION_COOKIE); // drop expired/garbage cookies
    return response;
  }
  return NextResponse.next();
}

export const config = {
  // Everything except the API proxy, Next internals and static assets.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|ico)$).*)'],
};

import { NextResponse } from 'next/server';
import { API_URL } from '@/lib/server/config';
import { setSessionCookie } from '@/lib/server/session';

/**
 * Login is the one call the browser cannot proxy transparently: the token in
 * the API response must become an httpOnly cookie instead of reaching JS.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Request body is not valid JSON' } },
      { status: 400 },
    );
  }

  const upstream = await fetch(`${API_URL}/v1/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': request.headers.get('x-forwarded-for') ?? '',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok || !payload?.data?.token) {
    return NextResponse.json(payload ?? { error: { code: 'UPSTREAM_ERROR', message: 'Login failed' } }, {
      status: upstream.status,
    });
  }

  await setSessionCookie(payload.data.token);
  // Deliberately omit the token from what the browser receives.
  return NextResponse.json({ data: { user: payload.data.user, expiresIn: payload.data.expiresIn } });
}

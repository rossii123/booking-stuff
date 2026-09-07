import { cookies } from 'next/headers';
import { SESSION_COOKIE, SESSION_COOKIE_SECURE } from './config';

import type { Role, SessionUser } from '@/lib/auth-types';

export type { Role, SessionUser };

/**
 * The JWT lives in an httpOnly cookie, so browser JavaScript can never read it
 * (no XSS token theft) and the browser attaches it automatically to same-origin
 * requests. SameSite=Lax blocks cross-site POSTs (CSRF) while still allowing
 * normal navigation.
 */
export async function setSessionCookie(token: string): Promise<void> {
  const claims = decodeJwt(token);
  const maxAge = claims ? Math.max(0, claims.exp - Math.floor(Date.now() / 1000)) : 3600;
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: SESSION_COOKIE_SECURE,
    path: '/',
    maxAge,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/**
 * Reads the user *for display purposes only* (nav bar, hiding admin buttons).
 * The signature is NOT verified here: the API verifies it on every request and
 * enforces roles server-side, so a forged cookie buys an attacker nothing but a
 * differently rendered menu.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = await getSessionToken();
  if (!token) return null;
  const claims = decodeJwt(token);
  if (!claims || claims.exp * 1000 < Date.now()) return null;
  return claims;
}

export function decodeJwt(token: string): SessionUser | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const payload = JSON.parse(json) as Partial<{ sub: string; email: string; role: Role; exp: number }>;
    if (!payload.sub || !payload.email || !payload.role || typeof payload.exp !== 'number') return null;
    return { id: payload.sub, email: payload.email, role: payload.role, exp: payload.exp };
  } catch {
    return null;
  }
}

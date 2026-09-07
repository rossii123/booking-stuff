/**
 * Server-only configuration. Nothing here is prefixed NEXT_PUBLIC_, so none of
 * it is bundled for the browser: the browser only ever talks to this Next.js
 * server (same origin), which talks to the API on its behalf.
 */
export const API_URL = (process.env.API_URL ?? 'http://localhost:5006').replace(/\/$/, '');
export const SESSION_COOKIE = 'minut_session';
export const SESSION_COOKIE_SECURE = process.env.SESSION_COOKIE_SECURE === 'true';

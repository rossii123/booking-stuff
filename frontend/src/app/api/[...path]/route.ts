import { API_URL } from '@/lib/server/config';
import { getSessionToken } from '@/lib/server/session';

/**
 * Transparent reverse proxy: /api/v1/* → ${API_URL}/v1/* with the session JWT
 * attached as a Bearer header. The browser therefore never handles tokens and
 * there is no CORS to configure. Status codes and JSON bodies pass straight
 * through so the UI can react to the API's error codes (409 overlap etc.).
 */
async function forward(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const incoming = new URL(request.url);
  const target = `${API_URL}/${path.map(encodeURIComponent).join('/')}${incoming.search}`;

  const headers = new Headers();
  const token = await getSessionToken();
  if (token) headers.set('authorization', `Bearer ${token}`);
  for (const name of ['content-type', 'accept', 'x-request-id']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('x-forwarded-for', request.headers.get('x-forwarded-for') ?? '');

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    cache: 'no-store',
    redirect: 'manual',
  });

  const responseHeaders = new Headers();
  for (const name of ['content-type', 'x-request-id', 'ratelimit-limit', 'ratelimit-remaining', 'ratelimit-reset']) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  responseHeaders.set('cache-control', 'no-store');

  return new Response(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export { forward as GET, forward as POST, forward as PATCH, forward as PUT, forward as DELETE };

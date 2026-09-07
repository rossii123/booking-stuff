import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cookieStore = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (cookieStore.has(name) ? { name, value: cookieStore.get(name) } : undefined),
  }),
}));

const fetchMock = vi.fn();

describe('API proxy route', () => {
  beforeEach(() => {
    cookieStore.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    process.env.API_URL = 'http://api.internal:5006';
  });
  afterEach(() => vi.unstubAllGlobals());

  async function call(request: Request, path: string[]) {
    vi.resetModules();
    const mod = await import('./route');
    return mod.GET(request, { params: Promise.resolve({ path }) });
  }

  it('forwards to the API with the session cookie as a Bearer token and passes the status through', async () => {
    cookieStore.set('minut_session', 'jwt-123');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'x-request-id': 'req-1' },
      }),
    );

    const res = await call(new Request('http://localhost:3000/api/v1/reservations?from=2024-07-01'), [
      'v1',
      'reservations',
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.internal:5006/v1/reservations?from=2024-07-01');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer jwt-123');
    expect(res.status).toBe(200);
    expect(res.headers.get('x-request-id')).toBe('req-1');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ data: [] });
  });

  it('sends no Authorization header without a session and relays the 401', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'nope' } }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const res = await call(new Request('http://localhost:3000/api/v1/reservations'), ['v1', 'reservations']);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).has('authorization')).toBe(false);
    expect(res.status).toBe(401);
  });
});

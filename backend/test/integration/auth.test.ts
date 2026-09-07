import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auth, createTestContext, type TestContext } from '../helpers';

describe('auth', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestContext();
  });
  afterAll(() => ctx.close());

  it('issues a token for valid credentials', async () => {
    const res = await request(ctx.app)
      .post('/v1/auth/login')
      .send({ email: ctx.env.ADMIN_EMAIL, password: ctx.env.ADMIN_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({ email: ctx.env.ADMIN_EMAIL, role: 'admin' });
  });

  it('rejects a wrong password and an unknown user identically', async () => {
    const wrong = await request(ctx.app)
      .post('/v1/auth/login')
      .send({ email: ctx.env.ADMIN_EMAIL, password: 'nope-nope' });
    const unknown = await request(ctx.app)
      .post('/v1/auth/login')
      .send({ email: 'ghost@test.local', password: 'nope-nope' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.code).toBe(unknown.body.error.code);
  });

  it('validates the login body', async () => {
    const res = await request(ctx.app).post('/v1/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual([
      'body.email',
      'body.password',
    ]);
  });

  it('returns the current user for a valid token', async () => {
    const res = await request(ctx.app).get('/v1/auth/me').set(auth(ctx.viewerToken));
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('viewer');
  });

  it('rejects missing, malformed and tampered tokens', async () => {
    expect((await request(ctx.app).get('/v1/auth/me')).status).toBe(401);
    expect((await request(ctx.app).get('/v1/auth/me').set(auth('garbage'))).status).toBe(401);
    const tampered = ctx.adminToken.slice(0, -2) + 'xx';
    expect((await request(ctx.app).get('/v1/auth/me').set(auth(tampered))).status).toBe(401);
  });

  it('echoes X-Request-Id on every response', async () => {
    const res = await request(ctx.app).get('/health').set('x-request-id', 'trace-123');
    expect(res.headers['x-request-id']).toBe('trace-123');
  });
});

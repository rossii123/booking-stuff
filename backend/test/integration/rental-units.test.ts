import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  auth,
  createTestContext,
  sampleReservation,
  sampleUnit,
  type TestContext,
} from '../helpers';

describe('rental units', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestContext();
  });
  beforeEach(() => ctx.reset());
  afterAll(() => ctx.close());

  const create = (body: object = sampleUnit) =>
    request(ctx.app).post('/v1/rental-units').set(auth(ctx.adminToken)).send(body);

  it('requires authentication for reads', async () => {
    expect((await request(ctx.app).get('/v1/rental-units')).status).toBe(401);
  });

  it('forbids writes for viewers but allows reads', async () => {
    const denied = await request(ctx.app)
      .post('/v1/rental-units')
      .set(auth(ctx.viewerToken))
      .send(sampleUnit);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');

    const allowed = await request(ctx.app).get('/v1/rental-units').set(auth(ctx.viewerToken));
    expect(allowed.status).toBe(200);
  });

  it('creates, reads, updates and deletes a unit', async () => {
    const created = await create();
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ ...sampleUnit, version: 1 });
    const id = created.body.data.id;

    const read = await request(ctx.app).get(`/v1/rental-units/${id}`).set(auth(ctx.viewerToken));
    expect(read.body.data.id).toBe(id);

    const updated = await request(ctx.app)
      .patch(`/v1/rental-units/${id}`)
      .set(auth(ctx.adminToken))
      .send({ version: 1, name: 'Renamed', city: null });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ name: 'Renamed', city: null, version: 2 });

    const deleted = await request(ctx.app)
      .delete(`/v1/rental-units/${id}`)
      .set(auth(ctx.adminToken));
    expect(deleted.status).toBe(204);

    const gone = await request(ctx.app).get(`/v1/rental-units/${id}`).set(auth(ctx.adminToken));
    expect(gone.status).toBe(404);
  });

  it('rejects invalid input with field-level details', async () => {
    const res = await create({ name: '', country: 'x'.repeat(101) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['body.name', 'body.country']));
  });

  it('rejects a stale version with 409 and reports the current one', async () => {
    const { id } = (await create()).body.data;
    await request(ctx.app)
      .patch(`/v1/rental-units/${id}`)
      .set(auth(ctx.adminToken))
      .send({ version: 1, name: 'First' });
    const stale = await request(ctx.app)
      .patch(`/v1/rental-units/${id}`)
      .set(auth(ctx.adminToken))
      .send({ version: 1, name: 'Second' });
    expect(stale.status).toBe(409);
    expect(stale.body.error).toMatchObject({
      code: 'VERSION_CONFLICT',
      details: { expectedVersion: 1, currentVersion: 2 },
    });
  });

  it('keeps a revision history of previous states', async () => {
    const { id } = (await create()).body.data;
    await request(ctx.app)
      .patch(`/v1/rental-units/${id}`)
      .set(auth(ctx.adminToken))
      .send({ version: 1, name: 'v2' });
    await request(ctx.app)
      .patch(`/v1/rental-units/${id}`)
      .set(auth(ctx.adminToken))
      .send({ version: 2, name: 'v3' });

    const history = await request(ctx.app)
      .get(`/v1/rental-units/${id}/history`)
      .set(auth(ctx.viewerToken));
    expect(history.status).toBe(200);
    expect(history.body.data.map((r: { version: number }) => r.version)).toEqual([2, 1]);
    expect(history.body.data[1].snapshot.name).toBe(sampleUnit.name);
    expect(history.body.data[0].snapshot.name).toBe('v2');
    expect(history.body.data[0].changedBy).toEqual(expect.any(String));
  });

  it('refuses to delete a unit that still has reservations', async () => {
    const { id } = (await create()).body.data;
    await request(ctx.app)
      .post('/v1/reservations')
      .set(auth(ctx.adminToken))
      .send(sampleReservation(id));
    const res = await request(ctx.app).delete(`/v1/rental-units/${id}`).set(auth(ctx.adminToken));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('UNIT_HAS_RESERVATIONS');
  });

  it('paginates and searches', async () => {
    for (const name of ['Alpha', 'Beta', 'Gamma']) await create({ ...sampleUnit, name });
    const page = await request(ctx.app)
      .get('/v1/rental-units?page=2&pageSize=2')
      .set(auth(ctx.viewerToken));
    expect(page.body.meta).toEqual({ page: 2, pageSize: 2, total: 3, totalPages: 2 });
    expect(page.body.data.map((u: { name: string }) => u.name)).toEqual(['Gamma']);

    const search = await request(ctx.app).get('/v1/rental-units?q=bet').set(auth(ctx.viewerToken));
    expect(search.body.data.map((u: { name: string }) => u.name)).toEqual(['Beta']);

    const tooBig = await request(ctx.app)
      .get('/v1/rental-units?pageSize=1000')
      .set(auth(ctx.viewerToken));
    expect(tooBig.status).toBe(400);
  });

  it('returns 404 for unknown ids and 400 for malformed ids', async () => {
    const unknown = await request(ctx.app)
      .get('/v1/rental-units/00000000-0000-4000-8000-000000000000')
      .set(auth(ctx.viewerToken));
    expect(unknown.status).toBe(404);
    const malformed = await request(ctx.app).get('/v1/rental-units/abc').set(auth(ctx.viewerToken));
    expect(malformed.status).toBe(400);
  });
});

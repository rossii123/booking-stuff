import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  auth,
  createTestContext,
  sampleReservation,
  sampleUnit,
  type TestContext,
} from '../helpers';

describe('reservations', () => {
  let ctx: TestContext;
  let unitId: string;

  beforeAll(async () => {
    ctx = await createTestContext();
  });
  beforeEach(async () => {
    await ctx.reset();
    const res = await request(ctx.app)
      .post('/v1/rental-units')
      .set(auth(ctx.adminToken))
      .send(sampleUnit);
    unitId = res.body.data.id;
  });
  afterAll(() => ctx.close());

  const book = (overrides: Record<string, unknown> = {}, unit = unitId) =>
    request(ctx.app)
      .post('/v1/reservations')
      .set(auth(ctx.adminToken))
      .send(sampleReservation(unit, overrides));

  const names = (res: request.Response) =>
    res.body.data.map((r: { guestName: string }) => r.guestName);

  it('creates a reservation and derives nights and unit name', async () => {
    const res = await book();
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      guestName: 'Ada Lovelace',
      checkIn: '2024-07-01',
      checkOut: '2024-07-05',
      nights: 4,
      version: 1,
      rentalUnit: { id: unitId, name: sampleUnit.name },
    });
  });

  it('validates dates and required fields', async () => {
    const backwards = await book({ checkIn: '2024-07-05', checkOut: '2024-07-01' });
    expect(backwards.status).toBe(400);
    expect(backwards.body.error.details[0].path).toBe('body.checkOut');

    const zeroNights = await book({ checkIn: '2024-07-05', checkOut: '2024-07-05' });
    expect(zeroNights.status).toBe(400);

    const badDate = await book({ checkIn: '2024-02-30' });
    expect(badDate.status).toBe(400);

    const noGuest = await book({ guestName: '   ' });
    expect(noGuest.status).toBe(400);
  });

  it('returns 404 when the rental unit does not exist', async () => {
    const res = await book({}, '00000000-0000-4000-8000-000000000000');
    expect(res.status).toBe(404);
  });

  describe('double-booking protection', () => {
    it('rejects an overlapping stay for the same unit with 409', async () => {
      await book();
      const res = await book({ guestName: 'Bob', checkIn: '2024-07-03', checkOut: '2024-07-08' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('RESERVATION_OVERLAP');
    });

    it('rejects a stay fully inside an existing one', async () => {
      await book();
      const res = await book({ guestName: 'Bob', checkIn: '2024-07-02', checkOut: '2024-07-03' });
      expect(res.status).toBe(409);
    });

    it('allows back-to-back stays (checkout day == checkin day)', async () => {
      await book();
      const res = await book({ guestName: 'Bob', checkIn: '2024-07-05', checkOut: '2024-07-09' });
      expect(res.status).toBe(201);
    });

    it('allows the same dates on a different unit', async () => {
      const other = await request(ctx.app)
        .post('/v1/rental-units')
        .set(auth(ctx.adminToken))
        .send({ name: 'Other flat' });
      await book();
      const res = await book({ guestName: 'Bob' }, other.body.data.id);
      expect(res.status).toBe(201);
    });

    it('frees the nights again after a cancellation', async () => {
      const { id } = (await book()).body.data;
      await request(ctx.app).delete(`/v1/reservations/${id}`).set(auth(ctx.adminToken));
      const res = await book({ guestName: 'Bob' });
      expect(res.status).toBe(201);
    });

    it('rejects an update that moves a stay onto another one', async () => {
      const { id } = (await book()).body.data;
      await book({ guestName: 'Bob', checkIn: '2024-07-05', checkOut: '2024-07-09' });
      const res = await request(ctx.app)
        .patch(`/v1/reservations/${id}`)
        .set(auth(ctx.adminToken))
        .send({ version: 1, checkOut: '2024-07-06' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('RESERVATION_OVERLAP');
    });

    it('only lets one of two concurrent bookings win', async () => {
      const results = await Promise.all([
        book({ guestName: 'One' }),
        book({ guestName: 'Two' }),
        book({ guestName: 'Three' }),
      ]);
      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 409, 409]);
    });
  });

  describe('querying', () => {
    beforeEach(async () => {
      await book({ guestName: 'Ada', checkIn: '2024-07-01', checkOut: '2024-07-05' });
      await book({ guestName: 'Cy', checkIn: '2024-07-05', checkOut: '2024-07-09' });
      await book({ guestName: 'Eve', checkIn: '2024-08-01', checkOut: '2024-08-03' });
    });

    it('lists all reservations sorted by check-in', async () => {
      const res = await request(ctx.app).get('/v1/reservations').set(auth(ctx.viewerToken));
      expect(res.status).toBe(200);
      expect(names(res)).toEqual(['Ada', 'Cy', 'Eve']);
      expect(res.body.meta.total).toBe(3);
    });

    it('filters by a time period using half-open semantics', async () => {
      const spanning = await request(ctx.app)
        .get('/v1/reservations?from=2024-07-04&to=2024-07-06')
        .set(auth(ctx.viewerToken));
      expect(names(spanning)).toEqual(['Ada', 'Cy']);

      // Ada checks out on the 5th, so a period starting on the 5th excludes her.
      const fromCheckout = await request(ctx.app)
        .get('/v1/reservations?from=2024-07-05&to=2024-07-06')
        .set(auth(ctx.viewerToken));
      expect(names(fromCheckout)).toEqual(['Cy']);

      const openEnded = await request(ctx.app)
        .get('/v1/reservations?from=2024-07-09')
        .set(auth(ctx.viewerToken));
      expect(names(openEnded)).toEqual(['Eve']);

      const before = await request(ctx.app)
        .get('/v1/reservations?to=2024-07-05')
        .set(auth(ctx.viewerToken));
      expect(names(before)).toEqual(['Ada']);
    });

    it('rejects an inverted period', async () => {
      const res = await request(ctx.app)
        .get('/v1/reservations?from=2024-07-10&to=2024-07-01')
        .set(auth(ctx.viewerToken));
      expect(res.status).toBe(400);
    });

    it('filters by rental unit, both via query and via the nested route', async () => {
      const other = await request(ctx.app)
        .post('/v1/rental-units')
        .set(auth(ctx.adminToken))
        .send({ name: 'Other flat' });
      await book({ guestName: 'Zed' }, other.body.data.id);

      const byQuery = await request(ctx.app)
        .get(`/v1/reservations?rentalUnitId=${other.body.data.id}`)
        .set(auth(ctx.viewerToken));
      expect(names(byQuery)).toEqual(['Zed']);

      const nested = await request(ctx.app)
        .get(`/v1/rental-units/${unitId}/reservations?from=2024-07-01&to=2024-07-31`)
        .set(auth(ctx.viewerToken));
      expect(names(nested)).toEqual(['Ada', 'Cy']);

      const missingUnit = await request(ctx.app)
        .get('/v1/rental-units/00000000-0000-4000-8000-000000000000/reservations')
        .set(auth(ctx.viewerToken));
      expect(missingUnit.status).toBe(404);
    });

    it('supports sorting and pagination', async () => {
      const desc = await request(ctx.app)
        .get('/v1/reservations?sort=-checkIn&pageSize=2')
        .set(auth(ctx.viewerToken));
      expect(names(desc)).toEqual(['Eve', 'Cy']);
      expect(desc.body.meta).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
    });
  });

  describe('updating', () => {
    it('applies partial updates, bumps the version and records history', async () => {
      const { id } = (await book()).body.data;
      const res = await request(ctx.app)
        .patch(`/v1/reservations/${id}`)
        .set(auth(ctx.adminToken))
        .send({ version: 1, guestName: 'Ada L.', guestCount: 3 });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        guestName: 'Ada L.',
        guestCount: 3,
        checkIn: '2024-07-01',
        version: 2,
      });

      const history = await request(ctx.app)
        .get(`/v1/reservations/${id}/history`)
        .set(auth(ctx.viewerToken));
      expect(history.body.data).toHaveLength(1);
      expect(history.body.data[0]).toMatchObject({
        version: 1,
        changeType: 'update',
        snapshot: { guestName: 'Ada Lovelace', guestCount: 2 },
      });
    });

    it('rejects a stale version', async () => {
      const { id } = (await book()).body.data;
      const res = await request(ctx.app)
        .patch(`/v1/reservations/${id}`)
        .set(auth(ctx.adminToken))
        .send({ version: 7, guestName: 'x' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('VERSION_CONFLICT');
    });

    it('validates a single changed date against the stored one', async () => {
      const { id } = (await book()).body.data;
      const res = await request(ctx.app)
        .patch(`/v1/reservations/${id}`)
        .set(auth(ctx.adminToken))
        .send({ version: 1, checkIn: '2024-07-06' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_DATE_RANGE');
    });

    it('can move a reservation to another unit', async () => {
      const other = await request(ctx.app)
        .post('/v1/rental-units')
        .set(auth(ctx.adminToken))
        .send({ name: 'Other flat' });
      const { id } = (await book()).body.data;
      const res = await request(ctx.app)
        .patch(`/v1/reservations/${id}`)
        .set(auth(ctx.adminToken))
        .send({ version: 1, rentalUnitId: other.body.data.id });
      expect(res.status).toBe(200);
      expect(res.body.data.rentalUnit.name).toBe('Other flat');
    });

    it('is admin-only', async () => {
      const { id } = (await book()).body.data;
      const res = await request(ctx.app)
        .patch(`/v1/reservations/${id}`)
        .set(auth(ctx.viewerToken))
        .send({ version: 1, guestName: 'x' });
      expect(res.status).toBe(403);
    });
  });

  it('soft-deletes and keeps the deletion in history', async () => {
    const { id } = (await book()).body.data;
    expect(
      (await request(ctx.app).delete(`/v1/reservations/${id}`).set(auth(ctx.adminToken))).status,
    ).toBe(204);
    expect(
      (await request(ctx.app).get(`/v1/reservations/${id}`).set(auth(ctx.adminToken))).status,
    ).toBe(404);
    // History is intentionally unavailable for deleted rows via the public API;
    // the row itself is still in the database.
    const { rows } = await ctx.database.pool.query(
      'SELECT change_type FROM reservation_revisions WHERE reservation_id = $1',
      [id],
    );
    expect(rows).toEqual([{ change_type: 'delete' }]);
  });
});

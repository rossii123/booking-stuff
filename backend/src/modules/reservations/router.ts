import { Router } from 'express';
import { bearerAuth, errorResponses, jsonBody, registerRoute } from '../../lib/openapi';
import { uuidParam, validated } from '../../middleware/validate';
import { revisionListSchema } from '../rental-units/schemas';
import type { Guards } from '../rental-units/router';
import {
  createReservationSchema,
  listReservationsQuerySchema,
  reservationEnvelopeSchema,
  reservationListSchema,
  updateReservationSchema,
} from './schemas';
import type { ReservationService } from './service';

const TAG = 'Reservations';
const security = [{ [bearerAuth.name]: [] }];

/* ---- OpenAPI ---- */
registerRoute({
  method: 'get',
  path: '/v1/reservations',
  tags: [TAG],
  security,
  summary: 'List reservations',
  description:
    'Filter by rental unit and/or by time. A reservation matches a period when its half-open ' +
    'stay [checkIn, checkOut) intersects the half-open period [from, to).',
  request: { query: listReservationsQuerySchema },
  responses: { 200: jsonBody(reservationListSchema), ...errorResponses(400, 401) },
});
registerRoute({
  method: 'post',
  path: '/v1/reservations',
  tags: [TAG],
  security,
  summary: 'Create a reservation',
  description:
    'Requires admin. Returns 409 RESERVATION_OVERLAP if the unit is already booked for any of those nights.',
  request: { body: jsonBody(createReservationSchema) },
  responses: {
    201: jsonBody(reservationEnvelopeSchema),
    ...errorResponses(400, 401, 403, 404, 409),
  },
});
registerRoute({
  method: 'get',
  path: '/v1/reservations/{id}',
  tags: [TAG],
  security,
  summary: 'Get a reservation',
  request: { params: uuidParam },
  responses: { 200: jsonBody(reservationEnvelopeSchema), ...errorResponses(400, 401, 404) },
});
registerRoute({
  method: 'patch',
  path: '/v1/reservations/{id}',
  tags: [TAG],
  security,
  summary: 'Update a reservation',
  description:
    'Partial update with optimistic locking via `version`. Date changes are re-checked for overlap.',
  request: { params: uuidParam, body: jsonBody(updateReservationSchema) },
  responses: {
    200: jsonBody(reservationEnvelopeSchema),
    ...errorResponses(400, 401, 403, 404, 409),
  },
});
registerRoute({
  method: 'delete',
  path: '/v1/reservations/{id}',
  tags: [TAG],
  security,
  summary: 'Cancel a reservation',
  description: 'Soft delete; the nights become available again.',
  request: { params: uuidParam },
  responses: { 204: { description: 'Deleted' }, ...errorResponses(400, 401, 403, 404) },
});
registerRoute({
  method: 'get',
  path: '/v1/reservations/{id}/history',
  tags: [TAG],
  security,
  summary: 'Change history of a reservation',
  request: { params: uuidParam },
  responses: { 200: jsonBody(revisionListSchema), ...errorResponses(400, 401, 404) },
});

/* ---- Router ---- */
export function createReservationsRouter(service: ReservationService, guards: Guards): Router {
  const router = Router();
  const admin = [guards.requireAuth, guards.requireRole('admin')];

  router.use(guards.requireAuth);

  router.get(
    '/',
    validated({ query: listReservationsQuerySchema }, async ({ query }, _req, res) => {
      res.json(await service.list(query));
    }),
  );

  router.post(
    '/',
    ...admin,
    validated({ body: createReservationSchema }, async ({ body }, _req, res) => {
      res.status(201).json({ data: await service.create(body) });
    }),
  );

  router.get(
    '/:id',
    validated({ params: uuidParam }, async ({ params }, _req, res) => {
      res.json({ data: await service.get(params.id) });
    }),
  );

  router.patch(
    '/:id',
    ...admin,
    validated(
      { params: uuidParam, body: updateReservationSchema },
      async ({ params, body }, req, res) => {
        res.json({ data: await service.update(params.id, body, req.user) });
      },
    ),
  );

  router.delete(
    '/:id',
    ...admin,
    validated({ params: uuidParam }, async ({ params }, req, res) => {
      await service.remove(params.id, req.user);
      res.status(204).end();
    }),
  );

  router.get(
    '/:id/history',
    validated({ params: uuidParam }, async ({ params }, _req, res) => {
      res.json({ data: await service.history(params.id) });
    }),
  );

  return router;
}

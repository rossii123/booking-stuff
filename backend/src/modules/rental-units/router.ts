import { Router, type RequestHandler } from 'express';
import { bearerAuth, errorResponses, jsonBody, registerRoute } from '../../lib/openapi';
import { uuidParam, validated } from '../../middleware/validate';
import { reservationListSchema, unitReservationsQuerySchema } from '../reservations/schemas';
import type { ReservationService } from '../reservations/service';
import {
  createRentalUnitSchema,
  listRentalUnitsQuerySchema,
  rentalUnitEnvelopeSchema,
  rentalUnitListSchema,
  revisionListSchema,
  updateRentalUnitSchema,
} from './schemas';
import type { RentalUnitService } from './service';

export interface Guards {
  requireAuth: RequestHandler;
  requireRole: (...roles: Array<'admin' | 'viewer'>) => RequestHandler;
}

const TAG = 'Rental units';
const security = [{ [bearerAuth.name]: [] }];

/* ---- OpenAPI (registered once at module load) ---- */
registerRoute({
  method: 'get',
  path: '/v1/rental-units',
  tags: [TAG],
  security,
  summary: 'List rental units',
  request: { query: listRentalUnitsQuerySchema },
  responses: { 200: jsonBody(rentalUnitListSchema, 'Paginated list'), ...errorResponses(400, 401) },
});
registerRoute({
  method: 'post',
  path: '/v1/rental-units',
  tags: [TAG],
  security,
  summary: 'Create a rental unit',
  description: 'Requires the admin role.',
  request: { body: jsonBody(createRentalUnitSchema) },
  responses: { 201: jsonBody(rentalUnitEnvelopeSchema), ...errorResponses(400, 401, 403) },
});
registerRoute({
  method: 'get',
  path: '/v1/rental-units/{id}',
  tags: [TAG],
  security,
  summary: 'Get a rental unit',
  request: { params: uuidParam },
  responses: { 200: jsonBody(rentalUnitEnvelopeSchema), ...errorResponses(400, 401, 404) },
});
registerRoute({
  method: 'patch',
  path: '/v1/rental-units/{id}',
  tags: [TAG],
  security,
  summary: 'Update a rental unit',
  description: 'Partial update. `version` must match the current version (optimistic locking).',
  request: { params: uuidParam, body: jsonBody(updateRentalUnitSchema) },
  responses: {
    200: jsonBody(rentalUnitEnvelopeSchema),
    ...errorResponses(400, 401, 403, 404, 409),
  },
});
registerRoute({
  method: 'delete',
  path: '/v1/rental-units/{id}',
  tags: [TAG],
  security,
  summary: 'Delete a rental unit',
  description: 'Soft delete. Fails with 409 while the unit still has reservations.',
  request: { params: uuidParam },
  responses: { 204: { description: 'Deleted' }, ...errorResponses(400, 401, 403, 404, 409) },
});
registerRoute({
  method: 'get',
  path: '/v1/rental-units/{id}/reservations',
  tags: [TAG],
  security,
  summary: 'List reservations of a rental unit',
  description: 'Optionally limited to those intersecting the half-open period [from, to).',
  request: { params: uuidParam, query: unitReservationsQuerySchema },
  responses: { 200: jsonBody(reservationListSchema), ...errorResponses(400, 401, 404) },
});
registerRoute({
  method: 'get',
  path: '/v1/rental-units/{id}/history',
  tags: [TAG],
  security,
  summary: 'Change history of a rental unit',
  request: { params: uuidParam },
  responses: { 200: jsonBody(revisionListSchema), ...errorResponses(400, 401, 404) },
});

/* ---- Router ---- */
export function createRentalUnitsRouter(
  units: RentalUnitService,
  reservations: ReservationService,
  guards: Guards,
): Router {
  const router = Router();
  const admin = [guards.requireAuth, guards.requireRole('admin')];

  router.use(guards.requireAuth);

  router.get(
    '/',
    validated({ query: listRentalUnitsQuerySchema }, async ({ query }, _req, res) => {
      res.json(await units.list(query));
    }),
  );

  router.post(
    '/',
    ...admin,
    validated({ body: createRentalUnitSchema }, async ({ body }, _req, res) => {
      res.status(201).json({ data: await units.create(body) });
    }),
  );

  router.get(
    '/:id',
    validated({ params: uuidParam }, async ({ params }, _req, res) => {
      res.json({ data: await units.get(params.id) });
    }),
  );

  router.patch(
    '/:id',
    ...admin,
    validated(
      { params: uuidParam, body: updateRentalUnitSchema },
      async ({ params, body }, req, res) => {
        res.json({ data: await units.update(params.id, body, req.user) });
      },
    ),
  );

  router.delete(
    '/:id',
    ...admin,
    validated({ params: uuidParam }, async ({ params }, req, res) => {
      await units.remove(params.id, req.user);
      res.status(204).end();
    }),
  );

  router.get(
    '/:id/reservations',
    validated(
      { params: uuidParam, query: unitReservationsQuerySchema },
      async ({ params, query }, _req, res) => {
        await units.get(params.id); // 404 if the unit does not exist
        res.json(await reservations.list({ ...query, rentalUnitId: params.id }));
      },
    ),
  );

  router.get(
    '/:id/history',
    validated({ params: uuidParam }, async ({ params }, _req, res) => {
      res.json({ data: await units.history(params.id) });
    }),
  );

  return router;
}

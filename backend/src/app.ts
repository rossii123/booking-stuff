import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import type { Env } from './config/env';
import type { Database } from './db/client';
import { buildOpenApiDocument } from './lib/openapi';
import { createAuthMiddleware } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { requestId } from './middleware/request-id';
import { createAuthRouter } from './modules/auth/router';
import { AuthService } from './modules/auth/service';
import { createRentalUnitsRouter } from './modules/rental-units/router';
import { RentalUnitService } from './modules/rental-units/service';
import { createReservationsRouter } from './modules/reservations/router';
import { ReservationService } from './modules/reservations/service';

export interface AppDependencies {
  env: Env;
  database: Database;
  logger: Logger;
}

/**
 * Builds the Express app without listening, so tests can drive it with
 * supertest and the server entrypoint stays a thin shell.
 *
 * Versioning: every business route is mounted under /v1. A breaking change
 * would ship as /v2 alongside, letting clients migrate at their own pace;
 * additive changes (new optional fields) stay in /v1.
 */
export function createApp({ env, database, logger }: AppDependencies): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY ? 1 : false);

  // --- cross-cutting middleware ---
  app.use(requestId());
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/ready' },
      customLogLevel: (_req, res, err) =>
        err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS, exposedHeaders: ['X-Request-Id'] }));
  app.use(express.json({ limit: '100kb' }));

  // --- liveness / readiness (interview topic: stability, hosting) ---
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/ready', async (_req, res) => {
    try {
      await database.ping();
      res.json({ status: 'ok', database: 'ok' });
    } catch {
      res.status(503).json({ status: 'degraded', database: 'unreachable' });
    }
  });

  // --- services & guards ---
  const authService = new AuthService(database.db, {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  });
  const guards = createAuthMiddleware((token) => authService.verifyToken(token));
  const rentalUnitService = new RentalUnitService(database.db);
  const reservationService = new ReservationService(database.db);

  // --- /v1 ---
  const v1 = express.Router();
  v1.use('/auth', createAuthRouter(authService, guards, env.JWT_EXPIRES_IN));
  v1.use('/rental-units', createRentalUnitsRouter(rentalUnitService, reservationService, guards));
  v1.use('/reservations', createReservationsRouter(reservationService, guards));

  const openApiDocument = buildOpenApiDocument('/');
  v1.get('/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });
  v1.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, { customSiteTitle: 'Minut Booking API' }),
  );

  app.use('/v1', v1);

  // --- fallthrough ---
  app.use(notFoundHandler());
  app.use(errorHandler(logger));

  return app;
}

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AppError } from '../../lib/errors';
import { bearerAuth, errorResponses, jsonBody, registerRoute } from '../../lib/openapi';
import { validated } from '../../middleware/validate';
import type { Guards } from '../rental-units/router';
import { loginResponseSchema, loginSchema, userEnvelopeSchema } from './schemas';
import type { AuthService } from './service';

const TAG = 'Auth';

registerRoute({
  method: 'post',
  path: '/v1/auth/login',
  tags: [TAG],
  summary: 'Exchange email + password for a JWT',
  description: 'Rate limited per client IP to slow down credential stuffing.',
  request: { body: jsonBody(loginSchema) },
  responses: { 200: jsonBody(loginResponseSchema), ...errorResponses(400, 401, 429) },
});
registerRoute({
  method: 'get',
  path: '/v1/auth/me',
  tags: [TAG],
  security: [{ [bearerAuth.name]: [] }],
  summary: 'Who am I',
  responses: { 200: jsonBody(userEnvelopeSchema), ...errorResponses(401) },
});

export function createAuthRouter(service: AuthService, guards: Guards, expiresIn: string): Router {
  const router = Router();

  const loginLimiter = rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new AppError(429, 'RATE_LIMITED', 'Too many login attempts, try again in a minute')),
  });

  router.post(
    '/login',
    loginLimiter,
    validated({ body: loginSchema }, async ({ body }, _req, res) => {
      const { token, user } = await service.login(body.email, body.password);
      res.json({ data: { token, expiresIn, user } });
    }),
  );

  router.get('/me', guards.requireAuth, (req, res) => {
    res.json({ data: req.user });
  });

  return router;
}

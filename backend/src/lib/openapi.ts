import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  type RouteConfig,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

/**
 * Routes register their zod schemas here; the same schema object validates the
 * request AND documents it, so the OpenAPI document cannot drift from reality.
 * (Interview topic: API documentation.)
 */
export const registry = new OpenAPIRegistry();

export const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

export const errorResponseSchema = z
  .object({
    error: z.object({
      code: z.string().meta({ example: 'VALIDATION_ERROR' }),
      message: z.string(),
      details: z.unknown().optional(),
    }),
  })
  .meta({ id: 'ErrorResponse' });

export function errorResponses(...statuses: number[]) {
  const descriptions: Record<number, string> = {
    400: 'Validation failed',
    401: 'Missing or invalid credentials',
    403: 'Insufficient permissions',
    404: 'Resource not found',
    409: 'Conflict (overlap, stale version, or dependent records)',
    429: 'Too many requests',
  };
  return Object.fromEntries(
    statuses.map((s) => [
      s,
      {
        description: descriptions[s] ?? 'Error',
        content: { 'application/json': { schema: errorResponseSchema } },
      },
    ]),
  ) as RouteConfig['responses'];
}

export function jsonBody<T extends z.ZodTypeAny>(schema: T, description?: string) {
  return { description, content: { 'application/json': { schema } } };
}

export function registerRoute(config: RouteConfig) {
  registry.registerPath(config);
}

export function buildOpenApiDocument(baseUrl: string) {
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Minut Booking API',
      version: '1.0.0',
      description:
        'REST API for managing rental units and guest reservations. ' +
        'All endpoints are versioned under /v1. Reservations use half-open date ranges ' +
        '[checkIn, checkOut) and overlapping reservations for the same unit are rejected with 409.',
    },
    servers: [{ url: baseUrl }],
  });
}

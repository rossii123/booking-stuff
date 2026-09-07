import type { Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/errors';

export interface RouteSchemas {
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
}

type Infer<S extends RouteSchemas, K extends keyof RouteSchemas> = S[K] extends z.ZodTypeAny
  ? z.output<S[K]>
  : undefined;

export interface ValidatedInput<S extends RouteSchemas> {
  body: Infer<S, 'body'>;
  query: Infer<S, 'query'>;
  params: Infer<S, 'params'>;
}

export type ValidatedHandler<S extends RouteSchemas> = (
  input: ValidatedInput<S>,
  req: Request,
  res: Response,
) => Promise<void> | void;

/**
 * Wraps a handler so it only ever sees parsed, typed input. Validation failures
 * become a 400 with per-field details; the handler's own promise rejections are
 * caught by Express 5 and forwarded to the error middleware.
 * (Interview topic: input validation.)
 */
export function validated<S extends RouteSchemas>(
  schemas: S,
  handler: ValidatedHandler<S>,
): RequestHandler {
  return async (req, res, next) => {
    const issues: Array<{ path: string; message: string }> = [];
    const input: Record<string, unknown> = {};

    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part]);
      if (result.success) {
        input[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          issues.push({ path: [part, ...issue.path].join('.'), message: issue.message });
        }
      }
    }

    if (issues.length > 0) {
      next(new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', issues));
      return;
    }

    try {
      await handler(input as unknown as ValidatedInput<S>, req, res);
    } catch (err) {
      next(err);
    }
  };
}

export const uuidParam = z.object({
  id: z.uuid().meta({ description: 'Resource id (UUID v4)' }),
});

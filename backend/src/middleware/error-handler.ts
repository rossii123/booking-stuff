import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Logger } from 'pino';
import { ZodError } from 'zod';
import { AppError, errors } from '../lib/errors';

interface PgError extends Error {
  code?: string;
  constraint?: string;
  detail?: string;
}

interface BodyParserError extends Error {
  type?: string;
  status?: number;
}

/**
 * Normalises anything thrown anywhere into an AppError. Database constraint
 * violations are translated into domain errors here — the constraint *is* the
 * business rule, this is just its HTTP voice.
 * (Interview topic: error handling.)
 */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  // Drizzle wraps driver errors in DrizzleQueryError with the pg error as `cause`.
  const pgError = findPgError(err);
  if (pgError) {
    const mapped = mapPgError(pgError);
    if (mapped) return mapped;
  }

  if (err instanceof ZodError) {
    return new AppError(
      400,
      'VALIDATION_ERROR',
      'Request validation failed',
      err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }

  if (isBodyParserError(err)) {
    if (err.type === 'entity.too.large') {
      return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
    }
    if (err.type === 'entity.parse.failed') {
      return new AppError(400, 'VALIDATION_ERROR', 'Request body is not valid JSON');
    }
  }

  return new AppError(500, 'INTERNAL_ERROR', 'Something went wrong on our side');
}

export function notFoundHandler(): RequestHandler {
  return (req, _res, next) => {
    next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.path} does not exist`));
  };
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const appError = toAppError(err);
    if (appError.status >= 500) {
      // The original error (with stack) goes to the log, never to the client.
      logger.error({ err, requestId: req.id }, 'Unhandled error');
    } else {
      logger.debug({ code: appError.code, requestId: req.id }, appError.message);
    }
    const body = appError.toJSON();
    res.status(appError.status).json({
      error: { ...body.error, requestId: req.id },
    });
  };
}

function mapPgError(err: PgError): AppError | undefined {
  switch (err.code) {
    case '23P01': // exclusion_violation
      if (err.constraint === 'reservations_no_overlap_excl') return errors.reservationOverlap();
      return undefined;
    case '23503': // foreign_key_violation
      if (err.constraint === 'reservations_rental_unit_id_rental_units_id_fk') {
        return err.detail?.includes('is still referenced')
          ? errors.unitHasReservations()
          : new AppError(400, 'VALIDATION_ERROR', 'Referenced rental unit does not exist', [
              { path: 'body.rentalUnitId', message: 'Rental unit does not exist' },
            ]);
      }
      return undefined;
    case '23514': // check_violation
      if (err.constraint === 'reservations_dates_check') return errors.invalidDateRange();
      return undefined;
    case '22P02': // invalid_text_representation (e.g. malformed uuid)
      return new AppError(400, 'VALIDATION_ERROR', 'Malformed identifier in request');
    default:
      return undefined;
  }
}

function findPgError(err: unknown, depth = 0): PgError | undefined {
  if (depth > 5 || !(err instanceof Error)) return undefined;
  if (isPgError(err)) return err;
  return findPgError(err.cause, depth + 1);
}

function isPgError(err: unknown): err is PgError {
  return (
    err instanceof Error &&
    typeof (err as PgError).code === 'string' &&
    /^[0-9A-Z]{5}$/.test((err as PgError).code as string)
  );
}

function isBodyParserError(err: unknown): err is BodyParserError {
  return err instanceof Error && typeof (err as BodyParserError).type === 'string';
}

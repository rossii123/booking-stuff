import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError, errors } from '../../src/lib/errors';
import { toAppError } from '../../src/middleware/error-handler';

function pgError(code: string, constraint?: string, detail?: string) {
  const err = new Error('db says no') as Error & {
    code: string;
    constraint?: string;
    detail?: string;
  };
  err.code = code;
  err.constraint = constraint;
  err.detail = detail;
  return err;
}

describe('toAppError', () => {
  it('passes AppError through untouched', () => {
    const original = errors.notFound('Thing', '1');
    expect(toAppError(original)).toBe(original);
  });

  it('maps zod errors to 400 with field paths', () => {
    const result = z.object({ name: z.string() }).safeParse({ name: 1 });
    const mapped = toAppError(result.error);
    expect(mapped.status).toBe(400);
    expect(mapped.code).toBe('VALIDATION_ERROR');
    expect(mapped.details).toEqual([{ path: 'name', message: expect.any(String) }]);
  });

  it('maps the exclusion constraint to RESERVATION_OVERLAP', () => {
    const mapped = toAppError(pgError('23P01', 'reservations_no_overlap_excl'));
    expect(mapped.status).toBe(409);
    expect(mapped.code).toBe('RESERVATION_OVERLAP');
  });

  it('unwraps errors wrapped by the ORM via `cause`', () => {
    const wrapped = new Error('Failed query', {
      cause: pgError('23P01', 'reservations_no_overlap_excl'),
    });
    expect(toAppError(wrapped).code).toBe('RESERVATION_OVERLAP');
  });

  it('maps the date check constraint to INVALID_DATE_RANGE', () => {
    expect(toAppError(pgError('23514', 'reservations_dates_check')).code).toBe(
      'INVALID_DATE_RANGE',
    );
  });

  it('maps a malformed uuid to 400', () => {
    expect(toAppError(pgError('22P02')).status).toBe(400);
  });

  it('hides unknown errors behind a generic 500', () => {
    const mapped = toAppError(new Error('secret stack trace'));
    expect(mapped).toBeInstanceOf(AppError);
    expect(mapped.status).toBe(500);
    expect(mapped.message).not.toContain('secret');
  });
});

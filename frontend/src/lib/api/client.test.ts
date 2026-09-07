import { describe, expect, it } from 'vitest';
import { ApiError, ok, toApiError } from './client';

describe('toApiError', () => {
  it('reads the API error envelope', () => {
    const err = toApiError(409, {
      error: { code: 'RESERVATION_OVERLAP', message: 'Booked', requestId: 'abc' },
    });
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, code: 'RESERVATION_OVERLAP', message: 'Booked', requestId: 'abc' });
  });

  it('falls back for non-JSON or foreign error bodies', () => {
    expect(toApiError(502, '<html>').code).toBe('HTTP_ERROR');
    expect(toApiError(0, null).code).toBe('NETWORK_ERROR');
  });

  it('maps validation details onto form field names', () => {
    const err = toApiError(400, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: [
          { path: 'body.checkIn', message: 'Expected a date' },
          { path: 'body.checkIn', message: 'second message is ignored' },
          { path: 'query.page', message: 'Too small' },
        ],
      },
    });
    expect(err.fieldErrors).toEqual({ checkIn: 'Expected a date', page: 'Too small' });
  });
});

describe('ok', () => {
  it('returns data for successful responses', () => {
    expect(ok({ data: { a: 1 }, response: new Response(null, { status: 200 }) })).toEqual({ a: 1 });
  });

  it('throws an ApiError for error responses', () => {
    expect(() =>
      ok({
        error: { error: { code: 'NOT_FOUND', message: 'Nope' } },
        response: new Response(null, { status: 404 }),
      }),
    ).toThrowError(ApiError);
  });
});

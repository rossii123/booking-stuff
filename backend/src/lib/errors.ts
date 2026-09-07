/**
 * A single error type crosses the service → HTTP boundary. Services throw
 * AppError with a machine-readable `code`; the error middleware turns it into
 * a consistent JSON body. Anything that is not an AppError is a bug and is
 * reported as an opaque 500 so internals never leak to clients.
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_CREDENTIALS'
  | 'RESERVATION_OVERLAP'
  | 'INVALID_DATE_RANGE'
  | 'VERSION_CONFLICT'
  | 'UNIT_HAS_RESERVATIONS'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== undefined ? { details: this.details } : {}),
      },
    };
  }
}

export const errors = {
  notFound: (entity: string, id: string) =>
    new AppError(404, 'NOT_FOUND', `${entity} ${id} was not found`),
  unauthorized: (message = 'Authentication required') => new AppError(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'You do not have permission to perform this action') =>
    new AppError(403, 'FORBIDDEN', message),
  invalidCredentials: () => new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password'),
  versionConflict: (entity: string, expected: number, actual: number) =>
    new AppError(
      409,
      'VERSION_CONFLICT',
      `${entity} was modified by someone else. Reload and try again.`,
      { expectedVersion: expected, currentVersion: actual },
    ),
  reservationOverlap: () =>
    new AppError(
      409,
      'RESERVATION_OVERLAP',
      'The rental unit already has a reservation that overlaps these dates',
    ),
  unitHasReservations: () =>
    new AppError(
      409,
      'UNIT_HAS_RESERVATIONS',
      'The rental unit still has reservations. Delete them first.',
    ),
  invalidDateRange: () => new AppError(400, 'INVALID_DATE_RANGE', 'checkOut must be after checkIn'),
};

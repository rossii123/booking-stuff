import type { ReactNode } from 'react';
import { ApiError } from '@/lib/api/client';
import { Alert } from './ui';

const TITLES: Record<string, string> = {
  RESERVATION_OVERLAP: 'Those nights are already booked',
  VERSION_CONFLICT: 'Someone else changed this record',
  UNIT_HAS_RESERVATIONS: 'This unit still has reservations',
  VALIDATION_ERROR: 'Please check the form',
  NOT_FOUND: 'Not found',
  FORBIDDEN: 'Not allowed',
  RATE_LIMITED: 'Slow down',
  NETWORK_ERROR: 'Connection problem',
};

export function ApiErrorAlert({ error, action }: { error: unknown; action?: ReactNode }) {
  if (!error) return null;
  if (!(error instanceof ApiError)) {
    return <Alert title="Something went wrong">{error instanceof Error ? error.message : String(error)}</Alert>;
  }
  const tone = error.code === 'VERSION_CONFLICT' ? 'warning' : 'error';
  return (
    <Alert tone={tone} title={TITLES[error.code] ?? 'Request failed'} action={action}>
      <p>{error.message}</p>
      {error.requestId && <p className="mt-1 font-mono text-xs opacity-70">request id: {error.requestId}</p>}
    </Alert>
  );
}

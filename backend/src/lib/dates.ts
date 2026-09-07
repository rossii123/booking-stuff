import { z } from 'zod';

/**
 * Reservations are booked by night, so we model check-in/check-out as calendar
 * dates (YYYY-MM-DD), not timestamps, and treat a stay as the half-open range
 * [checkIn, checkOut). A guest leaving on the 10th and another arriving on the
 * 10th do NOT overlap. Dates are kept as ISO strings end-to-end to avoid any
 * timezone drift between Postgres `date`, Node and the browser.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const isoDate = z
  .string()
  .regex(ISO_DATE, 'Expected a date in YYYY-MM-DD format')
  .refine(
    (s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && toIso(new Date(`${s}T00:00:00Z`)) === s,
    {
      message: 'Not a valid calendar date',
    },
  )
  .meta({ format: 'date', example: '2024-07-01' });

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** ISO date strings compare correctly as plain strings. */
export function isBefore(a: string, b: string): boolean {
  return a < b;
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Half-open interval intersection: [aStart,aEnd) ∩ [bStart,bEnd) ≠ ∅ */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

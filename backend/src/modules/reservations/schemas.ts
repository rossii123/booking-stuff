import { z } from 'zod';
import { isoDate, nightsBetween } from '../../lib/dates';
import { pageMetaSchema, paginationQuerySchema } from '../../lib/pagination';
import type { ReservationRow } from '../../db/schema';

export const reservationSchema = z
  .object({
    id: z.uuid(),
    rentalUnitId: z.uuid(),
    rentalUnit: z
      .object({ id: z.uuid(), name: z.string() })
      .meta({ description: 'Denormalised for list views' }),
    guestName: z.string(),
    guestEmail: z.string().nullable(),
    guestCount: z.number().int(),
    notes: z.string().nullable(),
    checkIn: isoDate,
    checkOut: isoDate.meta({ description: 'Exclusive — the guest leaves this day' }),
    nights: z.number().int(),
    version: z.number().int().meta({ description: 'Send back unchanged when updating' }),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'Reservation' });

export type ReservationDto = z.infer<typeof reservationSchema>;

const baseFields = {
  rentalUnitId: z.uuid(),
  guestName: z.string().trim().min(1).max(200).meta({ example: 'Ada Lovelace' }),
  guestEmail: z.email().max(320).nullish().meta({ example: 'ada@example.com' }),
  guestCount: z.number().int().min(1).max(50).default(1),
  notes: z.string().trim().max(2000).nullish(),
  checkIn: isoDate,
  checkOut: isoDate,
};

export const createReservationSchema = z
  .object(baseFields)
  .refine((r) => r.checkOut > r.checkIn, {
    message: 'checkOut must be after checkIn',
    path: ['checkOut'],
  })
  .meta({ id: 'CreateReservation' });

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

export const updateReservationSchema = z
  .object({
    ...baseFields,
    guestCount: z.number().int().min(1).max(50),
  })
  .partial()
  .extend({
    version: z
      .number()
      .int()
      .min(1)
      .meta({ description: 'The version you last read. Mismatch → 409 VERSION_CONFLICT' }),
  })
  // Both dates present → validate here; one present → validated against the
  // stored value in the service (it needs the current row).
  .refine((r) => !(r.checkIn && r.checkOut) || r.checkOut > r.checkIn, {
    message: 'checkOut must be after checkIn',
    path: ['checkOut'],
  })
  .meta({ id: 'UpdateReservation' });

export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;

export const reservationSortValues = ['checkIn', '-checkIn', 'createdAt', '-createdAt'] as const;

const periodRefinement = {
  check: (q: { from?: string; to?: string }) => !(q.from && q.to) || q.from < q.to,
  opts: { message: 'to must be after from', path: ['to'] },
};

const listReservationsFields = paginationQuerySchema.extend({
  rentalUnitId: z.uuid().optional(),
  from: isoDate.optional().meta({ description: 'Include stays ending after this date' }),
  to: isoDate.optional().meta({ description: 'Include stays starting before this date' }),
  sort: z.enum(reservationSortValues).default('checkIn'),
});

export const listReservationsQuerySchema = listReservationsFields.refine(
  periodRefinement.check,
  periodRefinement.opts,
);

/** Same filters minus the unit id, which comes from the URL. */
export const unitReservationsQuerySchema = listReservationsFields
  .omit({ rentalUnitId: true })
  .refine(periodRefinement.check, periodRefinement.opts);

export type ListReservationsQuery = z.infer<typeof listReservationsQuerySchema>;

export const reservationListSchema = z
  .object({ data: z.array(reservationSchema), meta: pageMetaSchema })
  .meta({ id: 'ReservationList' });

export const reservationEnvelopeSchema = z
  .object({ data: reservationSchema })
  .meta({ id: 'ReservationEnvelope' });

export type ReservationWithUnit = ReservationRow & { rentalUnitName: string };

export function toReservationDto(row: ReservationWithUnit): ReservationDto {
  return {
    id: row.id,
    rentalUnitId: row.rentalUnitId,
    rentalUnit: { id: row.rentalUnitId, name: row.rentalUnitName },
    guestName: row.guestName,
    guestEmail: row.guestEmail,
    guestCount: row.guestCount,
    notes: row.notes,
    checkIn: row.checkIn,
    checkOut: row.checkOut,
    nights: nightsBetween(row.checkIn, row.checkOut),
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

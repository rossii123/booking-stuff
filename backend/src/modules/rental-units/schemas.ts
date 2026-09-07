import { z } from 'zod';
import { pageMetaSchema, paginationQuerySchema } from '../../lib/pagination';
import type { RentalUnitRow } from '../../db/schema';

const optionalText = (max: number) => z.string().trim().max(max).nullish();

export const rentalUnitSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    description: z.string().nullable(),
    addressLine1: z.string().nullable(),
    addressLine2: z.string().nullable(),
    city: z.string().nullable(),
    postalCode: z.string().nullable(),
    country: z.string().nullable(),
    version: z.number().int().meta({ description: 'Send back unchanged when updating' }),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'RentalUnit' });

export type RentalUnitDto = z.infer<typeof rentalUnitSchema>;

export const createRentalUnitSchema = z
  .object({
    name: z.string().trim().min(1).max(200).meta({ example: 'Sunny loft in Södermalm' }),
    description: optionalText(2000),
    addressLine1: optionalText(200).meta({ example: 'Götgatan 12' }),
    addressLine2: optionalText(200),
    city: optionalText(100).meta({ example: 'Stockholm' }),
    postalCode: optionalText(20).meta({ example: '116 46' }),
    country: optionalText(100).meta({ example: 'SE' }),
  })
  .meta({ id: 'CreateRentalUnit' });

export type CreateRentalUnitInput = z.infer<typeof createRentalUnitSchema>;

export const updateRentalUnitSchema = createRentalUnitSchema
  .partial()
  .extend({
    version: z
      .number()
      .int()
      .min(1)
      .meta({ description: 'The version you last read. Mismatch → 409 VERSION_CONFLICT' }),
  })
  .meta({ id: 'UpdateRentalUnit' });

export type UpdateRentalUnitInput = z.infer<typeof updateRentalUnitSchema>;

export const listRentalUnitsQuerySchema = paginationQuerySchema.extend({
  q: z
    .string()
    .trim()
    .max(200)
    .optional()
    .meta({ description: 'Case-insensitive name/city search' }),
});

export type ListRentalUnitsQuery = z.infer<typeof listRentalUnitsQuerySchema>;

export const rentalUnitListSchema = z
  .object({ data: z.array(rentalUnitSchema), meta: pageMetaSchema })
  .meta({ id: 'RentalUnitList' });

export const rentalUnitEnvelopeSchema = z
  .object({ data: rentalUnitSchema })
  .meta({ id: 'RentalUnitEnvelope' });

export const revisionSchema = z
  .object({
    version: z.number().int(),
    changeType: z.enum(['update', 'delete']),
    snapshot: z
      .record(z.string(), z.unknown())
      .meta({ description: 'The row as it was before the change' }),
    changedBy: z.uuid().nullable(),
    changedAt: z.iso.datetime(),
  })
  .meta({ id: 'Revision' });

export const revisionListSchema = z
  .object({ data: z.array(revisionSchema) })
  .meta({ id: 'RevisionList' });

export function toRentalUnitDto(row: RentalUnitRow): RentalUnitDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    postalCode: row.postalCode,
    country: row.country,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

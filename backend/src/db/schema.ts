import { sql } from 'drizzle-orm';
import {
  bigserial,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Data model (interview topic: data modeling, relationships, versioning)
 *
 *  users ──< reservation_revisions.changed_by
 *  rental_units 1 ──< N reservations 1 ──< N reservation_revisions
 *  rental_units 1 ──< N rental_unit_revisions
 *
 * Conventions shared by the business tables:
 *  - `version`     optimistic-concurrency counter, bumped on every update. Clients
 *                  must send the version they last saw; a mismatch is a 409.
 *  - `deleted_at`  soft delete. Rows are never physically removed, so history and
 *                  foreign keys stay intact. All reads filter `deleted_at IS NULL`.
 *  - `*_revisions` append-only snapshot of the row *before* each change, giving a
 *                  full audit trail / undo source without touching the hot table.
 *
 * The overlap rule for reservations is enforced by an EXCLUDE constraint that
 * drizzle-kit cannot express, so it lives in the hand-written part of the first
 * migration (see drizzle/0000_*.sql). Keep it in mind when changing these columns.
 */

export const userRole = pgEnum('user_role', ['admin', 'viewer']);
export const revisionChangeType = pgEnum('revision_change_type', ['update', 'delete']);

const auditColumns = {
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRole('role').notNull().default('viewer'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rentalUnits = pgTable(
  'rental_units',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    city: text('city'),
    postalCode: text('postal_code'),
    country: text('country'),
    ...auditColumns,
  },
  (t) => [index('rental_units_active_name_idx').on(t.deletedAt, t.name)],
);

export const reservations = pgTable(
  'reservations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rentalUnitId: uuid('rental_unit_id')
      .notNull()
      .references(() => rentalUnits.id, { onDelete: 'restrict' }),
    guestName: text('guest_name').notNull(),
    guestEmail: text('guest_email'),
    guestCount: integer('guest_count').notNull().default(1),
    notes: text('notes'),
    // Stored as calendar dates and read back as 'YYYY-MM-DD' strings.
    checkIn: date('check_in', { mode: 'string' }).notNull(),
    checkOut: date('check_out', { mode: 'string' }).notNull(),
    ...auditColumns,
  },
  (t) => [
    // Query pattern: "all reservations for unit X in period Y"
    index('reservations_unit_check_in_idx').on(t.rentalUnitId, t.checkIn),
    // Query pattern: "all reservations in period Y" across units
    index('reservations_period_idx').on(t.checkIn, t.checkOut),
    check('reservations_dates_check', sql`${t.checkOut} > ${t.checkIn}`),
  ],
);

export const reservationRevisions = pgTable(
  'reservation_revisions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    reservationId: uuid('reservation_id')
      .notNull()
      .references(() => reservations.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    changeType: revisionChangeType('change_type').notNull(),
    snapshot: jsonb('snapshot').notNull(),
    changedBy: uuid('changed_by').references(() => users.id, { onDelete: 'set null' }),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('reservation_revisions_reservation_idx').on(t.reservationId, t.version)],
);

export const rentalUnitRevisions = pgTable(
  'rental_unit_revisions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    rentalUnitId: uuid('rental_unit_id')
      .notNull()
      .references(() => rentalUnits.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    changeType: revisionChangeType('change_type').notNull(),
    snapshot: jsonb('snapshot').notNull(),
    changedBy: uuid('changed_by').references(() => users.id, { onDelete: 'set null' }),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('rental_unit_revisions_unit_idx').on(t.rentalUnitId, t.version)],
);

export type UserRow = typeof users.$inferSelect;
export type RentalUnitRow = typeof rentalUnits.$inferSelect;
export type ReservationRow = typeof reservations.$inferSelect;
export type ReservationRevisionRow = typeof reservationRevisions.$inferSelect;
export type RentalUnitRevisionRow = typeof rentalUnitRevisions.$inferSelect;

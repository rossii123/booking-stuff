import { and, asc, count, desc, eq, getTableColumns, gt, isNull, lt, sql } from 'drizzle-orm';
import type { DbExecutor } from '../../db/types';
import {
  rentalUnits,
  reservationRevisions,
  reservations,
  type ReservationRevisionRow,
  type ReservationRow,
} from '../../db/schema';
import type { ReservationWithUnit } from './schemas';

export interface ReservationFilter {
  rentalUnitId?: string;
  from?: string;
  to?: string;
}

export class ReservationRepository {
  constructor(private readonly db: DbExecutor) {}

  private baseSelect() {
    return this.db
      .select({ ...getTableColumns(reservations), rentalUnitName: rentalUnits.name })
      .from(reservations)
      .innerJoin(rentalUnits, eq(rentalUnits.id, reservations.rentalUnitId));
  }

  /**
   * "Intersects [from, to)" for a half-open stay [checkIn, checkOut):
   *   checkIn < to  AND  checkOut > from
   * Each side is optional so callers can ask "everything after X" cheaply.
   */
  private whereFilter(f: ReservationFilter) {
    return and(
      isNull(reservations.deletedAt),
      f.rentalUnitId ? eq(reservations.rentalUnitId, f.rentalUnitId) : undefined,
      f.to ? lt(reservations.checkIn, f.to) : undefined,
      f.from ? gt(reservations.checkOut, f.from) : undefined,
    );
  }

  async findMany(
    filter: ReservationFilter,
    opts: { limit: number; offset: number; sort: string },
  ): Promise<{ rows: ReservationWithUnit[]; total: number }> {
    const where = this.whereFilter(filter);
    const orderBy = sortToOrderBy(opts.sort);
    const [rows, totals] = await Promise.all([
      this.baseSelect()
        .where(where)
        .orderBy(...orderBy)
        .limit(opts.limit)
        .offset(opts.offset),
      this.db.select({ total: count() }).from(reservations).where(where),
    ]);
    return { rows, total: totals[0]?.total ?? 0 };
  }

  async findById(id: string): Promise<ReservationWithUnit | undefined> {
    const rows = await this.baseSelect().where(
      and(eq(reservations.id, id), isNull(reservations.deletedAt)),
    );
    return rows[0];
  }

  async findByIdForUpdate(id: string): Promise<ReservationRow | undefined> {
    const rows = await this.db
      .select()
      .from(reservations)
      .where(and(eq(reservations.id, id), isNull(reservations.deletedAt)))
      .for('update');
    return rows[0];
  }

  async insert(values: typeof reservations.$inferInsert): Promise<ReservationRow> {
    const [row] = await this.db.insert(reservations).values(values).returning();
    return row!;
  }

  async update(
    id: string,
    values: Partial<typeof reservations.$inferInsert>,
  ): Promise<ReservationRow> {
    const [row] = await this.db
      .update(reservations)
      .set({ ...values, updatedAt: sql`now()` })
      .where(eq(reservations.id, id))
      .returning();
    return row!;
  }

  async softDelete(id: string): Promise<void> {
    await this.db
      .update(reservations)
      .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(reservations.id, id));
  }

  async insertRevision(values: typeof reservationRevisions.$inferInsert): Promise<void> {
    await this.db.insert(reservationRevisions).values(values);
  }

  findRevisions(reservationId: string): Promise<ReservationRevisionRow[]> {
    return this.db
      .select()
      .from(reservationRevisions)
      .where(eq(reservationRevisions.reservationId, reservationId))
      .orderBy(desc(reservationRevisions.version));
  }
}

function sortToOrderBy(sort: string) {
  switch (sort) {
    case '-checkIn':
      return [desc(reservations.checkIn), desc(reservations.id)];
    case 'createdAt':
      return [asc(reservations.createdAt), asc(reservations.id)];
    case '-createdAt':
      return [desc(reservations.createdAt), desc(reservations.id)];
    default:
      return [asc(reservations.checkIn), asc(reservations.id)];
  }
}

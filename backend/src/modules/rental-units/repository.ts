import { and, asc, count, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { DbExecutor } from '../../db/types';
import {
  rentalUnitRevisions,
  rentalUnits,
  reservations,
  type RentalUnitRevisionRow,
  type RentalUnitRow,
} from '../../db/schema';

/**
 * Repositories own SQL and nothing else: no HTTP, no business rules. That keeps
 * the service layer testable and lets the storage engine change later.
 */
export class RentalUnitRepository {
  constructor(private readonly db: DbExecutor) {}

  async findMany(opts: { q?: string; limit: number; offset: number }) {
    const where = and(
      isNull(rentalUnits.deletedAt),
      opts.q
        ? or(
            ilike(rentalUnits.name, `%${escapeLike(opts.q)}%`),
            ilike(rentalUnits.city, `%${escapeLike(opts.q)}%`),
          )
        : undefined,
    );
    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(rentalUnits)
        .where(where)
        .orderBy(asc(rentalUnits.name), asc(rentalUnits.id))
        .limit(opts.limit)
        .offset(opts.offset),
      this.db.select({ total: count() }).from(rentalUnits).where(where),
    ]);
    return { rows, total: totals[0]?.total ?? 0 };
  }

  findById(id: string): Promise<RentalUnitRow | undefined> {
    return this.db.query.rentalUnits.findFirst({
      where: and(eq(rentalUnits.id, id), isNull(rentalUnits.deletedAt)),
    });
  }

  /** Row-level lock for the duration of the enclosing transaction. */
  async findByIdForUpdate(id: string): Promise<RentalUnitRow | undefined> {
    const rows = await this.db
      .select()
      .from(rentalUnits)
      .where(and(eq(rentalUnits.id, id), isNull(rentalUnits.deletedAt)))
      .for('update');
    return rows[0];
  }

  async insert(values: typeof rentalUnits.$inferInsert): Promise<RentalUnitRow> {
    const [row] = await this.db.insert(rentalUnits).values(values).returning();
    return row!;
  }

  async update(
    id: string,
    values: Partial<typeof rentalUnits.$inferInsert>,
  ): Promise<RentalUnitRow> {
    const [row] = await this.db
      .update(rentalUnits)
      .set({ ...values, updatedAt: sql`now()` })
      .where(eq(rentalUnits.id, id))
      .returning();
    return row!;
  }

  async softDelete(id: string): Promise<void> {
    await this.db
      .update(rentalUnits)
      .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(rentalUnits.id, id));
  }

  async countActiveReservations(unitId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(reservations)
      .where(and(eq(reservations.rentalUnitId, unitId), isNull(reservations.deletedAt)));
    return row?.total ?? 0;
  }

  async insertRevision(values: typeof rentalUnitRevisions.$inferInsert): Promise<void> {
    await this.db.insert(rentalUnitRevisions).values(values);
  }

  findRevisions(unitId: string): Promise<RentalUnitRevisionRow[]> {
    return this.db
      .select()
      .from(rentalUnitRevisions)
      .where(eq(rentalUnitRevisions.rentalUnitId, unitId))
      .orderBy(desc(rentalUnitRevisions.version));
  }
}

export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

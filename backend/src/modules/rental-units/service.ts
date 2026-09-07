import type { Db } from '../../db/client';
import { errors } from '../../lib/errors';
import { offsetOf, toPageMeta, type Page } from '../../lib/pagination';
import { RentalUnitRepository } from './repository';
import {
  toRentalUnitDto,
  type CreateRentalUnitInput,
  type ListRentalUnitsQuery,
  type RentalUnitDto,
  type UpdateRentalUnitInput,
} from './schemas';

export interface Actor {
  id: string;
}

export class RentalUnitService {
  constructor(private readonly db: Db) {}

  async list(query: ListRentalUnitsQuery): Promise<Page<RentalUnitDto>> {
    const repo = new RentalUnitRepository(this.db);
    const { rows, total } = await repo.findMany({
      q: query.q,
      limit: query.pageSize,
      offset: offsetOf(query),
    });
    return { data: rows.map(toRentalUnitDto), meta: toPageMeta(query, total) };
  }

  async get(id: string): Promise<RentalUnitDto> {
    const row = await new RentalUnitRepository(this.db).findById(id);
    if (!row) throw errors.notFound('Rental unit', id);
    return toRentalUnitDto(row);
  }

  async create(input: CreateRentalUnitInput): Promise<RentalUnitDto> {
    const row = await new RentalUnitRepository(this.db).insert(input);
    return toRentalUnitDto(row);
  }

  /**
   * Optimistic concurrency: the client sends the version it read; if the row
   * moved on since then we refuse rather than silently overwrite a colleague's
   * change. The row lock makes the compare-and-bump atomic.
   */
  async update(id: string, input: UpdateRentalUnitInput, actor?: Actor): Promise<RentalUnitDto> {
    return this.db.transaction(async (tx) => {
      const repo = new RentalUnitRepository(tx);
      const current = await repo.findByIdForUpdate(id);
      if (!current) throw errors.notFound('Rental unit', id);
      if (current.version !== input.version) {
        throw errors.versionConflict('Rental unit', input.version, current.version);
      }
      const { version: _version, ...changes } = input;
      await repo.insertRevision({
        rentalUnitId: id,
        version: current.version,
        changeType: 'update',
        snapshot: toRentalUnitDto(current),
        changedBy: actor?.id,
      });
      const updated = await repo.update(id, { ...changes, version: current.version + 1 });
      return toRentalUnitDto(updated);
    });
  }

  async remove(id: string, actor?: Actor): Promise<void> {
    await this.db.transaction(async (tx) => {
      const repo = new RentalUnitRepository(tx);
      const current = await repo.findByIdForUpdate(id);
      if (!current) throw errors.notFound('Rental unit', id);
      // Soft delete does not trigger the FK, so the dependency check is explicit.
      if ((await repo.countActiveReservations(id)) > 0) throw errors.unitHasReservations();
      await repo.insertRevision({
        rentalUnitId: id,
        version: current.version,
        changeType: 'delete',
        snapshot: toRentalUnitDto(current),
        changedBy: actor?.id,
      });
      await repo.softDelete(id);
    });
  }

  async history(id: string) {
    const repo = new RentalUnitRepository(this.db);
    if (!(await repo.findById(id))) throw errors.notFound('Rental unit', id);
    const rows = await repo.findRevisions(id);
    return rows.map((r) => ({
      version: r.version,
      changeType: r.changeType,
      snapshot: r.snapshot as Record<string, unknown>,
      changedBy: r.changedBy,
      changedAt: r.changedAt.toISOString(),
    }));
  }
}

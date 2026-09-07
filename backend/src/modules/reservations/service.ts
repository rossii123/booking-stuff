import type { Db } from '../../db/client';
import { errors } from '../../lib/errors';
import { offsetOf, toPageMeta, type Page } from '../../lib/pagination';
import { RentalUnitRepository } from '../rental-units/repository';
import type { Actor } from '../rental-units/service';
import { ReservationRepository } from './repository';
import {
  toReservationDto,
  type CreateReservationInput,
  type ListReservationsQuery,
  type ReservationDto,
  type UpdateReservationInput,
} from './schemas';

export class ReservationService {
  constructor(private readonly db: Db) {}

  async list(query: ListReservationsQuery): Promise<Page<ReservationDto>> {
    const repo = new ReservationRepository(this.db);
    const { rows, total } = await repo.findMany(
      { rentalUnitId: query.rentalUnitId, from: query.from, to: query.to },
      { limit: query.pageSize, offset: offsetOf(query), sort: query.sort },
    );
    return { data: rows.map(toReservationDto), meta: toPageMeta(query, total) };
  }

  async get(id: string): Promise<ReservationDto> {
    const row = await new ReservationRepository(this.db).findById(id);
    if (!row) throw errors.notFound('Reservation', id);
    return toReservationDto(row);
  }

  /**
   * Overlap is NOT checked in application code on purpose: the EXCLUDE
   * constraint in Postgres is the single source of truth and it also covers the
   * race where two requests book the same nights at the same instant. The pg
   * error is translated to 409 RESERVATION_OVERLAP by the error middleware.
   */
  async create(input: CreateReservationInput): Promise<ReservationDto> {
    return this.db.transaction(async (tx) => {
      const unit = await new RentalUnitRepository(tx).findById(input.rentalUnitId);
      if (!unit) throw errors.notFound('Rental unit', input.rentalUnitId);
      const row = await new ReservationRepository(tx).insert(input);
      return toReservationDto({ ...row, rentalUnitName: unit.name });
    });
  }

  async update(id: string, input: UpdateReservationInput, actor?: Actor): Promise<ReservationDto> {
    return this.db.transaction(async (tx) => {
      const repo = new ReservationRepository(tx);
      const current = await repo.findByIdForUpdate(id);
      if (!current) throw errors.notFound('Reservation', id);
      if (current.version !== input.version) {
        throw errors.versionConflict('Reservation', input.version, current.version);
      }

      const { version: _version, ...changes } = input;
      const next = { ...current, ...stripUndefined(changes) };
      if (next.checkOut <= next.checkIn) throw errors.invalidDateRange();

      const unitRepo = new RentalUnitRepository(tx);
      const unit = await unitRepo.findById(next.rentalUnitId);
      if (!unit) throw errors.notFound('Rental unit', next.rentalUnitId);

      await repo.insertRevision({
        reservationId: id,
        version: current.version,
        changeType: 'update',
        snapshot: toReservationDto({ ...current, rentalUnitName: unit.name }),
        changedBy: actor?.id,
      });
      const updated = await repo.update(id, {
        ...stripUndefined(changes),
        version: current.version + 1,
      });
      return toReservationDto({ ...updated, rentalUnitName: unit.name });
    });
  }

  async remove(id: string, actor?: Actor): Promise<void> {
    await this.db.transaction(async (tx) => {
      const repo = new ReservationRepository(tx);
      const current = await repo.findByIdForUpdate(id);
      if (!current) throw errors.notFound('Reservation', id);
      const unit = await new RentalUnitRepository(tx).findById(current.rentalUnitId);
      await repo.insertRevision({
        reservationId: id,
        version: current.version,
        changeType: 'delete',
        snapshot: toReservationDto({ ...current, rentalUnitName: unit?.name ?? '' }),
        changedBy: actor?.id,
      });
      await repo.softDelete(id);
    });
  }

  async history(id: string) {
    const repo = new ReservationRepository(this.db);
    if (!(await repo.findById(id))) throw errors.notFound('Reservation', id);
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

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

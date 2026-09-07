'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { ApiErrorAlert } from '@/components/api-error-alert';
import { DataTable, type Column } from '@/components/data-table';
import { Pagination } from '@/components/pagination';
import { Button, Field, Input, LinkButton, PageHeader, Select, formatDate } from '@/components/ui';
import { useAllRentalUnits, useReservations } from '@/lib/api/hooks';
import type { Reservation, ReservationSort, ReservationsQuery } from '@/lib/api/types';
import { useAuth } from '@/lib/auth-context';

const SORTS: Array<{ value: ReservationSort; label: string }> = [
  { value: 'checkIn', label: 'Check-in ↑' },
  { value: '-checkIn', label: 'Check-in ↓' },
  { value: '-createdAt', label: 'Newest first' },
  { value: 'createdAt', label: 'Oldest first' },
];

/** Filters live in the URL so a filtered view can be bookmarked/shared. */
function useUrlQuery() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const query: ReservationsQuery = {
    rentalUnitId: params.get('unit') || undefined,
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
    sort: (params.get('sort') as ReservationSort) || 'checkIn',
    page: Number(params.get('page')) || 1,
    pageSize: 20,
  };

  const update = useCallback(
    (patch: Record<string, string | number | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === '' || v === 1) next.delete(k);
        else next.set(k, String(v));
      }
      if (!('page' in patch)) next.delete('page');
      router.replace(`${pathname}${next.size ? `?${next}` : ''}`);
    },
    [params, pathname, router],
  );

  return { query, update, raw: params };
}

export function ReservationsView() {
  const { isAdmin } = useAuth();
  const { query, update, raw } = useUrlQuery();
  const units = useAllRentalUnits();
  const reservations = useReservations(query);
  const hasFilters = !!(query.rentalUnitId || query.from || query.to);

  const columns: Column<Reservation>[] = [
    {
      key: 'guest',
      header: 'Guest',
      render: (r) => (
        <div>
          <Link href={`/reservations/${r.id}`} className="font-medium text-indigo-700 hover:underline">
            {r.guestName}
          </Link>
          {r.guestEmail && <div className="text-xs text-slate-500">{r.guestEmail}</div>}
        </div>
      ),
    },
    {
      key: 'unit',
      header: 'Rental unit',
      render: (r) => (
        <Link href={`/rental-units/${r.rentalUnit.id}`} className="text-slate-700 hover:underline">
          {r.rentalUnit.name}
        </Link>
      ),
    },
    { key: 'checkIn', header: 'Check-in', render: (r) => formatDate(r.checkIn) },
    { key: 'checkOut', header: 'Check-out', render: (r) => formatDate(r.checkOut) },
    { key: 'nights', header: 'Nights', className: 'text-right', render: (r) => r.nights },
    { key: 'guests', header: 'Guests', className: 'text-right', render: (r) => r.guestCount },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (r) => (
        <Link href={`/reservations/${r.id}`} className="text-sm text-indigo-700 hover:underline">
          {isAdmin ? 'Edit' : 'View'}
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Reservations"
        description="Every stay across your units. Filter by unit or by period."
        actions={isAdmin ? <LinkButton href="/reservations/new">New reservation</LinkButton> : undefined}
      />

      <form
        className="mb-5 grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_10rem_10rem_10rem_auto] sm:items-end"
        onSubmit={(e) => e.preventDefault()}
      >
        <Field label="Rental unit" htmlFor="f-unit">
          <Select id="f-unit" value={query.rentalUnitId ?? ''} onChange={(e) => update({ unit: e.target.value })}>
            <option value="">All units</option>
            {units.data?.data.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="From" htmlFor="f-from">
          <Input id="f-from" type="date" value={query.from ?? ''} onChange={(e) => update({ from: e.target.value })} />
        </Field>
        <Field label="To" htmlFor="f-to">
          <Input id="f-to" type="date" value={query.to ?? ''} onChange={(e) => update({ to: e.target.value })} />
        </Field>
        <Field label="Sort" htmlFor="f-sort">
          <Select id="f-sort" value={query.sort} onChange={(e) => update({ sort: e.target.value })}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Button variant="secondary" disabled={!hasFilters && !raw.get('sort')} onClick={() => update({ unit: undefined, from: undefined, to: undefined, sort: undefined })}>
          Clear
        </Button>
      </form>

      {reservations.error ? <ApiErrorAlert error={reservations.error} /> : null}
      <DataTable
        columns={columns}
        rows={reservations.data?.data}
        rowKey={(r) => r.id}
        isLoading={reservations.isFetching}
        emptyTitle={hasFilters ? 'No reservations match these filters' : 'No reservations yet'}
        emptyHint={
          isAdmin && !hasFilters ? (
            <Link href="/reservations/new" className="text-indigo-700 hover:underline">
              Create the first one
            </Link>
          ) : undefined
        }
      />
      <Pagination meta={reservations.data?.meta} onPageChange={(page) => update({ page })} />
    </>
  );
}

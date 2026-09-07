'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiErrorAlert } from '@/components/api-error-alert';
import { ConfirmButton } from '@/components/confirm-button';
import { DataTable, type Column } from '@/components/data-table';
import { RentalUnitForm, toRentalUnitPayload, unitToFormValues } from '@/components/rental-unit-form';
import { RevisionList } from '@/components/revision-list';
import { Badge, Button, Card, LinkButton, PageHeader, Spinner, formatDate } from '@/components/ui';
import {
  useDeleteRentalUnit,
  useRentalUnit,
  useRentalUnitHistory,
  useUnitReservations,
  useUpdateRentalUnit,
} from '@/lib/api/hooks';
import type { Reservation } from '@/lib/api/types';
import { useAuth } from '@/lib/auth-context';

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function RentalUnitDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const unit = useRentalUnit(id);
  const history = useRentalUnitHistory(id);
  const update = useUpdateRentalUnit();
  const remove = useDeleteRentalUnit();
  const [showPast, setShowPast] = useState(false);
  const stays = useUnitReservations(id, { from: showPast ? undefined : today(), pageSize: 50 });

  if (unit.isPending) return <Spinner />;
  if (unit.error) return <ApiErrorAlert error={unit.error} />;
  const u = unit.data!;

  const columns: Column<Reservation>[] = [
    {
      key: 'guest',
      header: 'Guest',
      render: (r) => (
        <Link href={`/reservations/${r.id}`} className="font-medium text-indigo-700 hover:underline">
          {r.guestName}
        </Link>
      ),
    },
    { key: 'in', header: 'Check-in', render: (r) => formatDate(r.checkIn) },
    { key: 'out', header: 'Check-out', render: (r) => formatDate(r.checkOut) },
    { key: 'nights', header: 'Nights', className: 'text-right', render: (r) => r.nights },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={u.name}
        description={[u.addressLine1, u.city, u.country].filter(Boolean).join(', ') || 'No address on file'}
        actions={
          <>
            <Badge tone="neutral">v{u.version}</Badge>
            {isAdmin && (
              <>
                <LinkButton href={`/reservations/new?unit=${u.id}`} variant="secondary">
                  Book a guest
                </LinkButton>
                <ConfirmButton
                  label="Delete"
                  disabled={remove.isPending}
                  onConfirm={() => remove.mutate(id, { onSuccess: () => router.push('/rental-units') })}
                />
              </>
            )}
          </>
        }
      />
      {remove.error ? <div className="mb-4"><ApiErrorAlert error={remove.error} /></div> : null}

      <Card>
        <RentalUnitForm
          key={u.version}
          defaultValues={unitToFormValues(u)}
          submitLabel="Save changes"
          readOnly={!isAdmin}
          isPending={update.isPending}
          serverError={update.error}
          onReload={() => {
            update.reset();
            void unit.refetch();
          }}
          onSubmit={(values) => update.mutate({ id, body: { ...toRentalUnitPayload(values), version: u.version } })}
        />
      </Card>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{showPast ? 'All reservations' : 'Upcoming reservations'}</h2>
          <Button variant="ghost" onClick={() => setShowPast((v) => !v)}>
            {showPast ? 'Hide past' : 'Show past'}
          </Button>
        </div>
        {stays.error ? <ApiErrorAlert error={stays.error} /> : null}
        <DataTable
          columns={columns}
          rows={stays.data?.data}
          rowKey={(r) => r.id}
          isLoading={stays.isFetching}
          emptyTitle={showPast ? 'No reservations for this unit' : 'No upcoming reservations'}
        />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-slate-900">History</h2>
        <RevisionList revisions={history.data} isLoading={history.isPending} error={history.error} />
      </section>

      <p className="mt-8 text-sm">
        <Link href="/rental-units" className="text-indigo-700 hover:underline">
          ← All rental units
        </Link>
      </p>
    </div>
  );
}

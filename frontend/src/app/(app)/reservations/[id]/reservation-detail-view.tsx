'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiErrorAlert } from '@/components/api-error-alert';
import { ConfirmButton } from '@/components/confirm-button';
import { RevisionList } from '@/components/revision-list';
import { ReservationForm, type ReservationFormValues } from '@/components/reservation-form';
import { Badge, Card, PageHeader, Spinner, formatDate } from '@/components/ui';
import {
  useAllRentalUnits,
  useDeleteReservation,
  useReservation,
  useReservationHistory,
  useUpdateReservation,
} from '@/lib/api/hooks';
import type { Reservation, UpdateReservation } from '@/lib/api/types';
import { useAuth } from '@/lib/auth-context';

function toFormValues(r: Reservation): ReservationFormValues {
  return {
    rentalUnitId: r.rentalUnitId,
    guestName: r.guestName,
    guestEmail: r.guestEmail ?? '',
    guestCount: r.guestCount,
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    notes: r.notes ?? '',
  };
}

/** Only send what changed — smaller payload and clearer revision snapshots. */
function diff(before: ReservationFormValues, after: ReservationFormValues, version: number): UpdateReservation {
  const body: UpdateReservation = { version };
  if (after.rentalUnitId !== before.rentalUnitId) body.rentalUnitId = after.rentalUnitId;
  if (after.guestName !== before.guestName) body.guestName = after.guestName;
  if (after.guestEmail !== before.guestEmail) body.guestEmail = after.guestEmail || null;
  if (after.guestCount !== before.guestCount) body.guestCount = after.guestCount;
  if (after.checkIn !== before.checkIn) body.checkIn = after.checkIn;
  if (after.checkOut !== before.checkOut) body.checkOut = after.checkOut;
  if (after.notes !== before.notes) body.notes = after.notes || null;
  return body;
}

export function ReservationDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const reservation = useReservation(id);
  const units = useAllRentalUnits();
  const history = useReservationHistory(id);
  const update = useUpdateReservation();
  const remove = useDeleteReservation();

  if (reservation.isPending) return <Spinner />;
  if (reservation.error) return <ApiErrorAlert error={reservation.error} />;
  const r = reservation.data!;
  const current = toFormValues(r);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={r.guestName}
        description={`${formatDate(r.checkIn)} → ${formatDate(r.checkOut)} · ${r.nights} night${r.nights === 1 ? '' : 's'} at ${r.rentalUnit.name}`}
        actions={
          <>
            <Badge tone="neutral">v{r.version}</Badge>
            {isAdmin && (
              <ConfirmButton
                label="Delete"
                disabled={remove.isPending}
                onConfirm={() => remove.mutate(id, { onSuccess: () => router.push('/reservations') })}
              />
            )}
          </>
        }
      />
      {remove.error ? <div className="mb-4"><ApiErrorAlert error={remove.error} /></div> : null}
      {units.error ? <ApiErrorAlert error={units.error} /> : null}

      <Card>
        <ReservationForm
          key={r.version} // remount with fresh defaults after every successful save
          units={units.data?.data ?? []}
          defaultValues={current}
          submitLabel="Save changes"
          readOnly={!isAdmin}
          isPending={update.isPending}
          serverError={update.error}
          onReload={() => {
            update.reset();
            void reservation.refetch();
          }}
          onSubmit={(values) => update.mutate({ id, body: diff(current, values, r.version) })}
        />
      </Card>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-slate-900">History</h2>
        <RevisionList revisions={history.data} isLoading={history.isPending} error={history.error} />
      </section>

      <p className="mt-8 text-sm">
        <Link href="/reservations" className="text-indigo-700 hover:underline">
          ← All reservations
        </Link>
      </p>
    </div>
  );
}

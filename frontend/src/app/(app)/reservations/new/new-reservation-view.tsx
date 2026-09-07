'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ApiErrorAlert } from '@/components/api-error-alert';
import { ReservationForm, emptyReservation, toReservationPayload } from '@/components/reservation-form';
import { Alert, Card, PageHeader, Spinner } from '@/components/ui';
import { useAllRentalUnits, useCreateReservation } from '@/lib/api/hooks';
import { useAuth } from '@/lib/auth-context';

export function NewReservationView() {
  const router = useRouter();
  const params = useSearchParams();
  const { isAdmin } = useAuth();
  const units = useAllRentalUnits();
  const create = useCreateReservation();

  if (!isAdmin) {
    return <Alert tone="warning" title="Admins only">Your account can view reservations but not create them.</Alert>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New reservation" description="Book a guest into one of your units." />
      {units.error ? <ApiErrorAlert error={units.error} /> : null}
      {units.isPending ? (
        <Spinner />
      ) : units.data && units.data.data.length === 0 ? (
        <Alert tone="info" title="No rental units yet">Create a rental unit before booking a guest.</Alert>
      ) : (
        <Card>
          <ReservationForm
            units={units.data?.data ?? []}
            defaultValues={{ ...emptyReservation, rentalUnitId: params.get('unit') ?? '' }}
            submitLabel="Create reservation"
            isPending={create.isPending}
            serverError={create.error}
            onSubmit={(values) =>
              create.mutate(toReservationPayload(values), {
                onSuccess: (r) => router.push(`/reservations/${r.id}`),
              })
            }
          />
        </Card>
      )}
    </div>
  );
}

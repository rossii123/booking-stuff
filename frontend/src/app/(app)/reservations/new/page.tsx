import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Spinner } from '@/components/ui';
import { NewReservationView } from './new-reservation-view';

export const metadata: Metadata = { title: 'New reservation' };

export default function NewReservationPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <NewReservationView />
    </Suspense>
  );
}

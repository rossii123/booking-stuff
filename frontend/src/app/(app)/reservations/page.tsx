import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Spinner } from '@/components/ui';
import { ReservationsView } from './reservations-view';

export const metadata: Metadata = { title: 'Reservations' };

export default function ReservationsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ReservationsView />
    </Suspense>
  );
}

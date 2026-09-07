import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Spinner } from '@/components/ui';
import { RentalUnitsView } from './rental-units-view';

export const metadata: Metadata = { title: 'Rental units' };

export default function RentalUnitsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <RentalUnitsView />
    </Suspense>
  );
}

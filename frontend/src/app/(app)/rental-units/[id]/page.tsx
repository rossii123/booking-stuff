import type { Metadata } from 'next';
import { RentalUnitDetailView } from './rental-unit-detail-view';

export const metadata: Metadata = { title: 'Rental unit' };

export default async function RentalUnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RentalUnitDetailView id={id} />;
}

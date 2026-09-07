import type { Metadata } from 'next';
import { ReservationDetailView } from './reservation-detail-view';

export const metadata: Metadata = { title: 'Reservation' };

export default async function ReservationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReservationDetailView id={id} />;
}

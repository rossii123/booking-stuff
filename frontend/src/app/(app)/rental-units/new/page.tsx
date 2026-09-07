import type { Metadata } from 'next';
import { NewRentalUnitView } from './new-rental-unit-view';

export const metadata: Metadata = { title: 'New rental unit' };

export default function NewRentalUnitPage() {
  return <NewRentalUnitView />;
}

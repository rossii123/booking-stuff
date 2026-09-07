'use client';

import { useRouter } from 'next/navigation';
import { RentalUnitForm, toRentalUnitPayload } from '@/components/rental-unit-form';
import { Alert, Card, PageHeader } from '@/components/ui';
import { useCreateRentalUnit } from '@/lib/api/hooks';
import { useAuth } from '@/lib/auth-context';

export function NewRentalUnitView() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const create = useCreateRentalUnit();

  if (!isAdmin) {
    return <Alert tone="warning" title="Admins only">Your account can view rental units but not create them.</Alert>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New rental unit" description="A flat, house or room you rent out." />
      <Card>
        <RentalUnitForm
          submitLabel="Create rental unit"
          isPending={create.isPending}
          serverError={create.error}
          onSubmit={(values) =>
            create.mutate(toRentalUnitPayload(values), {
              onSuccess: (u) => router.push(`/rental-units/${u.id}`),
            })
          }
        />
      </Card>
    </div>
  );
}

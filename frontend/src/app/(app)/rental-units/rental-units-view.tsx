'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiErrorAlert } from '@/components/api-error-alert';
import { DataTable, type Column } from '@/components/data-table';
import { Pagination } from '@/components/pagination';
import { Input, LinkButton, PageHeader } from '@/components/ui';
import { useRentalUnits } from '@/lib/api/hooks';
import type { RentalUnit } from '@/lib/api/types';
import { useAuth } from '@/lib/auth-context';

function address(u: RentalUnit) {
  const parts = [u.addressLine1, [u.postalCode, u.city].filter(Boolean).join(' '), u.country].filter(Boolean);
  return parts.length ? parts.join(', ') : <span className="text-slate-400">No address</span>;
}

export function RentalUnitsView() {
  const { isAdmin } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const q = params.get('q') ?? '';
  const page = Number(params.get('page')) || 1;
  const [search, setSearch] = useState(q);

  // Debounce typing → URL so the list re-queries at most every 300ms.
  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams();
      if (search) next.set('q', search);
      router.replace(`${pathname}${next.size ? `?${next}` : ''}`);
    }, 300);
    return () => clearTimeout(t);
  }, [search, q, pathname, router]);

  const units = useRentalUnits({ q: q || undefined, page, pageSize: 20 });

  const columns: Column<RentalUnit>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (u) => (
        <Link href={`/rental-units/${u.id}`} className="font-medium text-indigo-700 hover:underline">
          {u.name}
        </Link>
      ),
    },
    { key: 'address', header: 'Address', render: address },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right whitespace-nowrap',
      render: (u) => (
        <span className="flex justify-end gap-3 text-sm">
          {isAdmin && (
            <Link href={`/reservations/new?unit=${u.id}`} className="text-slate-700 hover:underline">
              Book
            </Link>
          )}
          <Link href={`/rental-units/${u.id}`} className="text-indigo-700 hover:underline">
            {isAdmin ? 'Edit' : 'View'}
          </Link>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Rental units"
        description="The flats and properties you rent out."
        actions={isAdmin ? <LinkButton href="/rental-units/new">New rental unit</LinkButton> : undefined}
      />
      <div className="mb-5 max-w-sm">
        <Input
          type="search"
          placeholder="Search by name or city…"
          aria-label="Search rental units"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {units.error ? <ApiErrorAlert error={units.error} /> : null}
      <DataTable
        columns={columns}
        rows={units.data?.data}
        rowKey={(u) => u.id}
        isLoading={units.isFetching}
        emptyTitle={q ? `No units match “${q}”` : 'No rental units yet'}
        emptyHint={
          isAdmin && !q ? (
            <Link href="/rental-units/new" className="text-indigo-700 hover:underline">
              Add your first unit
            </Link>
          ) : undefined
        }
      />
      <Pagination
        meta={units.data?.meta}
        onPageChange={(p) => {
          const next = new URLSearchParams(params.toString());
          if (p > 1) next.set('page', String(p));
          else next.delete('page');
          router.replace(`${pathname}?${next}`);
        }}
      />
    </>
  );
}

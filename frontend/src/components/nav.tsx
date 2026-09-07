'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Badge, Button, cx } from './ui';

const links = [
  { href: '/reservations', label: 'Reservations' },
  { href: '/rental-units', label: 'Rental units' },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-6 px-4">
        <div className="flex items-center gap-6">
          <Link href="/reservations" className="text-base font-semibold tracking-tight text-slate-900">
            <span className="mr-1.5 inline-block size-2.5 rounded-full bg-indigo-600 align-middle" />
            Minut Booking
          </Link>
          <nav className="flex items-center gap-1" aria-label="Main">
            {links.map((l) => {
              const active = pathname === l.href || pathname.startsWith(l.href + '/');
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'rounded-md px-3 py-1.5 text-sm font-medium',
                    active ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
        {user && (
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-600 sm:inline">{user.email}</span>
            <Badge tone={user.role === 'admin' ? 'info' : 'neutral'}>{user.role}</Badge>
            <Button variant="ghost" onClick={signOut} disabled={signingOut}>
              Sign out
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}

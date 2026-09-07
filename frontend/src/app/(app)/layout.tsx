import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Nav } from '@/components/nav';
import { AuthProvider } from '@/lib/auth-context';
import { getSessionUser } from '@/lib/server/session';

/**
 * Everything under (app) requires a session. proxy.ts already redirects, but a
 * layout-level check is defence in depth and also feeds the user into React.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return (
    <AuthProvider user={user}>
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </AuthProvider>
  );
}

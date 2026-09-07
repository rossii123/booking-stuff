import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { QueryProvider } from '@/lib/query-provider';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Minut Booking', template: '%s · Minut Booking' },
  description: 'Manage rental units and guest reservations',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}

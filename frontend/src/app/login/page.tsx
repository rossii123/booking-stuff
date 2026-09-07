import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mb-3 inline-block size-3 rounded-full bg-indigo-600" />
          <h1 className="text-2xl font-semibold tracking-tight">Minut Booking</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to manage units and reservations</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}

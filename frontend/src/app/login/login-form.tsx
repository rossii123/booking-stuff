'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { toApiError } from '@/lib/api/client';
import { ApiErrorAlert } from '@/components/api-error-alert';
import { Alert, Button, Card, Field, Input } from '@/components/ui';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError(toApiError(res.status, await res.json().catch(() => null)));
        return;
      }
      const next = params.get('next');
      router.push(next && next.startsWith('/') && !next.startsWith('//') ? next : '/reservations');
      router.refresh();
    } catch {
      setError(toApiError(0, null));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4">
        {params.get('reason') === 'expired' && (
          <Alert tone="info">Your session expired. Please sign in again.</Alert>
        )}
        {error ? <ApiErrorAlert error={error} /> : null}
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <div className="mt-5 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
        <p className="font-medium text-slate-700">Demo accounts</p>
        <p className="mt-1">
          <span className="font-mono">admin@example.com</span> / <span className="font-mono">admin1234</span> — full access
        </p>
        <p>
          <span className="font-mono">viewer@example.com</span> / <span className="font-mono">viewer1234</span> — read only
        </p>
      </div>
    </Card>
  );
}

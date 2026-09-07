'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { SessionUser } from './auth-types';

interface AuthState {
  user: SessionUser | null;
  /** UI convenience only — the API enforces roles regardless of what we render. */
  isAdmin: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, isAdmin: false });

export function AuthProvider({ user, children }: { user: SessionUser | null; children: ReactNode }) {
  return <AuthContext.Provider value={{ user, isAdmin: user?.role === 'admin' }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

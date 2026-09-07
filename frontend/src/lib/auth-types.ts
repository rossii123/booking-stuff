export type Role = 'admin' | 'viewer';

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  /** Unix seconds */
  exp: number;
}

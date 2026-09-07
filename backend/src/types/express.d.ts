import type { AuthUser } from '../middleware/auth';

declare global {
  namespace Express {
    interface Request {
      /** Correlation id, echoed as X-Request-Id. Set by requestId middleware. */
      id: string;
      /** Populated by requireAuth. */
      user?: AuthUser;
    }
  }
}

export {};

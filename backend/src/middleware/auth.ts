import type { RequestHandler } from 'express';
import { errors } from '../lib/errors';

export type Role = 'admin' | 'viewer';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

export type TokenVerifier = (token: string) => AuthUser;

/**
 * Authentication = "who are you" (Bearer JWT), authorization = "may you do this"
 * (role check). Kept as two composable middlewares so read endpoints can accept
 * any signed-in user while writes require admin.
 * (Interview topic: authentication + authorization.)
 */
export function createAuthMiddleware(verifyToken: TokenVerifier) {
  const requireAuth: RequestHandler = (req, _res, next) => {
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      next(errors.unauthorized());
      return;
    }
    try {
      req.user = verifyToken(header.slice('Bearer '.length).trim());
      next();
    } catch {
      next(errors.unauthorized('Invalid or expired token'));
    }
  };

  const requireRole =
    (...roles: Role[]): RequestHandler =>
    (req, _res, next) => {
      if (!req.user) {
        next(errors.unauthorized());
        return;
      }
      if (!roles.includes(req.user.role)) {
        next(errors.forbidden(`This action requires role: ${roles.join(' or ')}`));
        return;
      }
      next();
    };

  return { requireAuth, requireRole };
}

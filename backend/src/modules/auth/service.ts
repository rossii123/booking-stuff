import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import type { Db } from '../../db/client';
import { users } from '../../db/schema';
import { errors } from '../../lib/errors';
import type { AuthUser, Role } from '../../middleware/auth';

export interface AuthConfig {
  secret: string;
  expiresIn: string;
}

interface TokenClaims {
  sub: string;
  email: string;
  role: Role;
}

/**
 * Stateless JWT sessions: the API keeps no session store, so any replica can
 * verify any token — a deliberate scalability choice. The trade-off (tokens
 * cannot be revoked before expiry) is mitigated with a short lifetime; a
 * refresh-token flow would be the next step. Passwords are bcrypt-hashed.
 */
export class AuthService {
  constructor(
    private readonly db: Db,
    private readonly config: AuthConfig,
  ) {}

  async login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });
    // Compare against a dummy hash when the user is missing so response time does
    // not reveal whether an email exists (user enumeration).
    const hash = user?.passwordHash ?? DUMMY_HASH;
    const ok = await bcrypt.compare(password, hash);
    if (!user || !ok) throw errors.invalidCredentials();

    const authUser: AuthUser = { id: user.id, email: user.email, role: user.role };
    const claims: TokenClaims = { sub: user.id, email: user.email, role: user.role };
    const token = jwt.sign(claims, this.config.secret, {
      algorithm: 'HS256',
      expiresIn: this.config.expiresIn as jwt.SignOptions['expiresIn'],
      issuer: 'minut-booking-api',
    });
    return { token, user: authUser };
  }

  verifyToken(token: string): AuthUser {
    const payload = jwt.verify(token, this.config.secret, {
      algorithms: ['HS256'],
      issuer: 'minut-booking-api',
    }) as jwt.JwtPayload & Partial<TokenClaims>;
    if (typeof payload.sub !== 'string' || !payload.email || !payload.role) {
      throw new Error('Malformed token payload');
    }
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { loadEnv, type Env } from '../config/env';
import { createDatabase, type Db } from './client';
import { users } from './schema';

const BCRYPT_ROUNDS = 10;

/**
 * Idempotent: creates the admin (and optional viewer) account only if that
 * email does not exist yet. Runs on every boot so a fresh environment is usable
 * without a manual step, but never overwrites a password that was changed later.
 */
export async function seedUsers(db: Db, env: Env): Promise<void> {
  const accounts: Array<{ email: string; password: string; role: 'admin' | 'viewer' }> = [
    { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD, role: 'admin' },
  ];
  if (env.VIEWER_EMAIL && env.VIEWER_PASSWORD) {
    accounts.push({ email: env.VIEWER_EMAIL, password: env.VIEWER_PASSWORD, role: 'viewer' });
  }

  for (const account of accounts) {
    const existing = await db.query.users.findFirst({ where: eq(users.email, account.email) });
    if (existing) continue;
    await db.insert(users).values({
      email: account.email,
      passwordHash: await bcrypt.hash(account.password, BCRYPT_ROUNDS),
      role: account.role,
    });
  }
}

if (require.main === module) {
  const env = loadEnv();
  const database = createDatabase(env.DATABASE_URL);
  seedUsers(database.db, env)
    .then(() => console.log('Seed complete'))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => database.close());
}

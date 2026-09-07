import type { Express } from 'express';
import pino from 'pino';
import request from 'supertest';
import { createApp } from '../src/app';
import { loadEnv, type Env } from '../src/config/env';
import { createDatabase, type Database } from '../src/db/client';
import { seedUsers } from '../src/db/seed';
import { TEST_ENV } from './env';

export interface TestContext {
  app: Express;
  env: Env;
  database: Database;
  adminToken: string;
  viewerToken: string;
  /** Wipes business data (keeps users) so each test starts clean. */
  reset(): Promise<void>;
  close(): Promise<void>;
}

export async function createTestContext(): Promise<TestContext> {
  const env = loadEnv(TEST_ENV);
  const database = createDatabase(env.DATABASE_URL);
  const app = createApp({ env, database, logger: pino({ level: 'silent' }) });

  await truncateAll(database, { keepUsers: false });
  await seedUsers(database.db, env);

  const adminToken = await login(app, env.ADMIN_EMAIL, env.ADMIN_PASSWORD);
  const viewerToken = await login(app, env.VIEWER_EMAIL!, env.VIEWER_PASSWORD!);

  return {
    app,
    env,
    database,
    adminToken,
    viewerToken,
    reset: () => truncateAll(database, { keepUsers: true }),
    close: () => database.close(),
  };
}

export async function login(app: Express, email: string, password: string): Promise<string> {
  const res = await request(app).post('/v1/auth/login').send({ email, password });
  if (res.status !== 200)
    throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.token as string;
}

async function truncateAll(database: Database, opts: { keepUsers: boolean }) {
  const tables = [
    'reservation_revisions',
    'rental_unit_revisions',
    'reservations',
    'rental_units',
    ...(opts.keepUsers ? [] : ['users']),
  ];
  await database.pool.query(
    `TRUNCATE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export const sampleUnit = {
  name: 'Sunny loft',
  addressLine1: 'Götgatan 12',
  city: 'Stockholm',
  postalCode: '116 46',
  country: 'SE',
};

export const sampleReservation = (
  rentalUnitId: string,
  overrides: Record<string, unknown> = {},
) => ({
  rentalUnitId,
  guestName: 'Ada Lovelace',
  guestEmail: 'ada@example.com',
  guestCount: 2,
  checkIn: '2024-07-01',
  checkOut: '2024-07-05',
  ...overrides,
});

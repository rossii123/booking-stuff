import { Client } from 'pg';
import { createDatabase } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { TEST_DATABASE_URL } from './env';

/**
 * Runs once per `vitest` invocation: makes sure the test database exists and is
 * migrated. Tests then only need to truncate between cases. Creating the DB here
 * (instead of a docker-entrypoint script) keeps `docker compose up` free of bind
 * mounts and works against any Postgres the developer points DATABASE_URL at.
 */
export default async function globalSetup() {
  const testUrl = new URL(TEST_DATABASE_URL);
  const dbName = testUrl.pathname.replace(/^\//, '');
  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = '/postgres';

  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (exists.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
    }
  } finally {
    await admin.end();
  }

  const database = createDatabase(TEST_DATABASE_URL);
  try {
    await runMigrations(database.db);
  } finally {
    await database.close();
  }
}

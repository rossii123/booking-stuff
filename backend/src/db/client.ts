import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;

export interface Database {
  db: Db;
  pool: Pool;
  /** Cheap readiness probe used by /ready. */
  ping(): Promise<void>;
  close(): Promise<void>;
}

export function createDatabase(connectionString: string): Database {
  // A small pool is plenty for one API replica; scale replicas, not pool size.
  // (Interview topic: performance/scalability — connection count is the usual
  // Postgres bottleneck, PgBouncer sits in front once replicas multiply.)
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  const db = drizzle(pool, { schema });
  return {
    db,
    pool,
    async ping() {
      await pool.query('SELECT 1');
    },
    async close() {
      await pool.end();
    },
  };
}

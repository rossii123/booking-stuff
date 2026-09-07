import pino from 'pino';
import { createApp } from './app';
import { loadEnv } from './config/env';
import { createDatabase } from './db/client';
import { runMigrations } from './db/migrate';
import { seedUsers } from './db/seed';

/**
 * Boot sequence: validate config → connect → migrate → seed → listen.
 * Any failure before `listen` exits non-zero so the orchestrator restarts us;
 * SIGTERM drains in-flight requests before closing the pool (graceful shutdown).
 */
async function main() {
  const env = loadEnv();
  const logger = pino({
    level: env.LOG_LEVEL,
    ...(env.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : {}),
    redact: ['req.headers.authorization', 'req.headers.cookie'],
  });

  const database = createDatabase(env.DATABASE_URL);
  await waitForDatabase(database.ping, logger);
  await runMigrations(database.db);
  logger.info('Database migrations applied');
  await seedUsers(database.db, env);

  const app = createApp({ env, database, logger });
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, `API listening — docs at http://localhost:${env.PORT}/v1/docs`);
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down');
    const forceExit = setTimeout(() => {
      logger.error('Forced exit after timeout');
      process.exit(1);
    }, 10_000).unref();
    server.close(async () => {
      await database.close();
      clearTimeout(forceExit);
      logger.info('Shutdown complete');
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Unhandled promise rejection');
    process.exit(1);
  });
}

async function waitForDatabase(ping: () => Promise<void>, logger: pino.Logger, attempts = 15) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await ping();
      return;
    } catch (err) {
      if (i === attempts) throw err;
      logger.warn({ attempt: i }, 'Database not ready, retrying in 1s');
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

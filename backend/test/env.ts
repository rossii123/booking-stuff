export const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? 'postgres://minut:minut@localhost:5432/minut_test';

export const TEST_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  PORT: '5999',
  LOG_LEVEL: 'silent',
  DATABASE_URL: TEST_DATABASE_URL,
  JWT_SECRET: 'test-secret-test-secret-test-secret-test-secret',
  JWT_EXPIRES_IN: '1h',
  CORS_ORIGINS: 'http://localhost:3000',
  ADMIN_EMAIL: 'admin@test.local',
  ADMIN_PASSWORD: 'admin-password',
  VIEWER_EMAIL: 'viewer@test.local',
  VIEWER_PASSWORD: 'viewer-password',
};

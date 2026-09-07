# Backend — Minut Booking API

Node 22 · TypeScript · Express 5 · PostgreSQL 16 · Drizzle ORM · zod · Vitest

## Run

```bash
# from the repository root — Postgres + API + web app
docker compose up --build -d
open http://localhost:5006/v1/docs      # Swagger UI

# or, locally against the compose Postgres only
docker compose up -d postgres
cp .env.example .env
npm install
npm run dev                             # tsx watch, pretty logs
```

The API migrates the database and seeds the admin/viewer accounts on every boot
(idempotent), so a fresh volume is usable immediately.

## Scripts

| Script                 | What it does                                                 |
| ---------------------- | ------------------------------------------------------------ |
| `npm run dev`          | Start with hot reload                                        |
| `npm run build/start`  | Compile to `dist/` and run it                                |
| `npm test`             | Unit + integration tests (needs Postgres; creates `minut_test`) |
| `npm run lint`         | ESLint (typescript-eslint, type-aware imports)               |
| `npm run typecheck`    | `tsc --noEmit`                                               |
| `npm run db:generate`  | Diff `src/db/schema.ts` → new SQL migration in `drizzle/`    |
| `npm run db:migrate`   | Apply migrations (also happens automatically at boot)        |
| `npm run openapi:emit` | Write `openapi.json` (consumed by the frontend's codegen)    |

## Layout

```
src/
  server.ts            boot: env → db → migrate → seed → listen → graceful shutdown
  app.ts               createApp(): middleware, routers, docs, error handler (no listen → testable)
  config/env.ts        zod-validated environment
  db/                  schema (Drizzle), pool, migrator, seeder
  lib/                 errors, dates, pagination, OpenAPI registry
  middleware/          request-id, validate(), auth guards, error mapper
  modules/<entity>/    schemas (zod + DTO mapping) · repository (SQL) · service (rules) · router (HTTP + docs)
drizzle/               committed SQL migrations (incl. hand-written EXCLUDE constraint)
test/                  vitest unit tests + supertest integration tests
```

See [`../docs/DESIGN.md`](../docs/DESIGN.md) for the reasoning behind the design.

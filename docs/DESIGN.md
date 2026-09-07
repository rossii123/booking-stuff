# Design notes

This document walks through the topics listed under "Interview expectations" in the
assignment and explains what was built, why, what was deliberately left out, and
what the next step would be at larger scale. Code comments at the decision points
reference these sections.

---

## 1. API design

**Resources and relationships.** Two aggregate roots, `rental-units` and
`reservations`, each with full CRUD under `/v1`. A reservation *belongs to* one
unit (`rentalUnitId` FK, `ON DELETE RESTRICT`). The relationship is exposed both
ways:

- `GET /v1/reservations?rentalUnitId=…` — filter on the child collection;
- `GET /v1/rental-units/{id}/reservations` — nested read that also 404s when the
  unit is missing, which the flat filter cannot express.

Writes always go through the flat collection (`POST /v1/reservations` with a
`rentalUnitId` in the body). One canonical write path keeps the overlap rule and
revision history in a single place.

**Time queries.** Stays are half-open date ranges `[checkIn, checkOut)`. A period
filter `from`/`to` returns every stay that *intersects* `[from, to)`:
`checkIn < to AND checkOut > from`. Either bound may be omitted. This is the same
definition the database's exclusion constraint uses, so "what is booked on these
nights" and "can I book these nights" can never disagree.

**Envelope.** Successful responses are `{ data }` or `{ data, meta }` (lists);
errors are `{ error: { code, message, details?, requestId } }`. `code` is a stable
machine-readable string the UI switches on; `message` is for humans and may change.

**Partial updates** use `PATCH` with a body that contains only changed fields plus
the `version` (see §7). `DELETE` is a soft delete and returns `204`.

**Pagination** is offset-based (`page`, `pageSize` ≤ 100) with a `meta.total`.
Cursor pagination would be the upgrade once lists reach tens of thousands of rows,
because `OFFSET n` costs O(n) — but for one host's portfolio, offsets are simpler
for the UI and let the user jump to a page.

## 2. Documentation

The OpenAPI 3.1 document is **generated from the same zod schemas that validate
requests** (`@asteasolutions/zod-to-openapi`). Every router registers its routes
at module load; `GET /v1/openapi.json` serves the result and `GET /v1/docs` renders
Swagger UI. The document is also written to `backend/openapi.json` and committed;
CI fails if it drifts from the code.

The frontend consumes that file: `openapi-typescript` generates
`frontend/src/lib/api/schema.d.ts`, and `openapi-fetch` gives a client where paths,
query params, bodies and responses are all typed. Renaming a field in the backend
becomes a compile error in the frontend rather than a runtime surprise. CI fails if
the generated file is stale.

## 3. Versioning

**URL versioning** (`/v1`). Additive changes — a new optional field, a new
endpoint, a new filter — ship inside `/v1`; clients that ignore unknown fields are
unaffected. A breaking change (renaming `checkIn`, changing the error envelope)
would be a `/v2` router mounted next to `/v1`, sharing services, so old clients keep
working while new ones migrate. The header/media-type alternatives were rejected as
harder to explore in a browser and in Swagger UI.

Record-level versioning is a separate concern; see §7.

## 4. Input validation

Every route is wrapped in `validated({ params, query, body }, handler)`
(`backend/src/middleware/validate.ts`). The handler only ever receives parsed,
typed data; nothing reads `req.body` directly. Failures return `400` with
per-field `details: [{ path: 'body.checkOut', message }]`, which the frontend maps
straight onto form fields.

Rules that need data — "checkOut is after the *stored* checkIn when only one date
changes", "the unit exists" — live in the service layer. Rules that must hold under
concurrency — no overlap — live in the database (§8). The frontend duplicates the
cheap syntactic rules in its own zod schema for instant feedback, but treats the API
as the authority.

Defensive limits: JSON bodies capped at 100 kB, string lengths capped in every
schema, `pageSize` capped at 100, UUIDs validated before they reach SQL.

## 5. Authentication and authorization

**Authentication** is email + bcrypt password exchanged for a short-lived
(1 h) HS256 JWT. The API is stateless — any replica can verify any token with
the shared secret — which is the simplest thing that scales horizontally. The
trade-off is that a token cannot be revoked before it expires; the mitigation is
the short lifetime, and the next step would be a refresh-token flow with a
revocation list.

Login is rate-limited (10/min per IP) and compares against a dummy hash when the
email is unknown so response timing does not reveal which accounts exist.

**Authorization** is role-based: `viewer` can read everything, `admin` can also
write. Two composable middlewares — `requireAuth` then `requireRole('admin')` —
are applied per route, so the permission model is visible in the router. The UI
hides write actions from viewers for usability, but that is cosmetic: the API
enforces roles on every request.

**Where the token lives.** The browser never sees it. The Next.js server stores
it in an `httpOnly`, `SameSite=Lax` cookie and a same-origin proxy route attaches
it as a Bearer header on the way to the API. This removes the two classic SPA
problems at once: XSS cannot steal a token that JavaScript cannot read, and there
is no CORS configuration because the browser only talks to its own origin.

Not built: user management, password reset, multi-tenancy (a `host_id` on units
so several hosts share one deployment). All would slot in without changing the
existing endpoints.

## 6. Error handling

One error type crosses the service → HTTP boundary: `AppError(status, code,
message, details)`. A central middleware (`backend/src/middleware/error-handler.ts`)
turns *anything* thrown into the error envelope:

| Thrown                                   | Response                     |
| ---------------------------------------- | ---------------------------- |
| `AppError`                               | as specified                 |
| `ZodError` (should not escape `validated`) | 400 `VALIDATION_ERROR`     |
| pg `23P01` on the overlap constraint     | 409 `RESERVATION_OVERLAP`    |
| pg `23503` (FK)                          | 409 `UNIT_HAS_RESERVATIONS` / 400 |
| pg `23514` (date check)                  | 400 `INVALID_DATE_RANGE`     |
| pg `22P02` (malformed uuid)              | 400 `VALIDATION_ERROR`       |
| body-parser errors                       | 400 / 413                    |
| anything else                            | 500 `INTERNAL_ERROR`, logged with stack, message hidden |

Drizzle wraps driver errors, so the mapper walks the `cause` chain. Every response
carries `X-Request-Id` (honouring an incoming one), and the error body repeats it,
so a screenshot from a user can be matched to a log line.

Express 5 forwards rejected promises to the error middleware natively, so there is
no `asyncHandler` wrapper to forget.

## 7. Data modelling

See `backend/src/db/schema.ts`. Postgres was chosen over the scaffolded MongoDB
because the domain is relational (units ↔ reservations) and because the central
business rule — no two reservations for the same unit on the same night — is
enforceable as a constraint only in a database with range types.

**Relationships.** `reservations.rental_unit_id → rental_units.id` with
`ON DELETE RESTRICT`; revision tables cascade from their parent; `changed_by`
references `users` with `SET NULL` so deleting a user keeps the audit trail.

**Versioning of records** has two parts:

- `version` integer on every business row, bumped on each update. A `PATCH` must
  carry the version the client last read; mismatch → `409 VERSION_CONFLICT` with
  both numbers. This is *optimistic locking*: two hosts editing the same booking
  cannot silently overwrite each other. The compare-and-bump runs under
  `SELECT … FOR UPDATE` inside a transaction, so it is race-free.
- `*_revisions` tables: before every update or delete the previous row is copied
  as a JSON snapshot, with who and when. `GET …/{id}/history` exposes it. This is
  an append-only audit log and an undo source, kept out of the hot table so
  listing reservations never pays for history.

**Soft delete** (`deleted_at`) everywhere: nothing is physically removed, so
history stays coherent and accidental deletions are recoverable. All reads filter
`deleted_at IS NULL`; the overlap constraint is partial on the same predicate so a
cancelled stay frees its nights.

**Dates.** `date` columns, not timestamps — stays are counted in nights, and
using timestamps would invite timezone bugs at every boundary. Values travel as
`YYYY-MM-DD` strings end-to-end.

**Indexes** follow the query patterns: `(rental_unit_id, check_in)` for
per-unit calendars, `(check_in, check_out)` for period queries across units,
`(deleted_at, name)` for the unit list, and the GiST index behind the exclusion
constraint doubles as an overlap-search index.

## 8. Security

- No secrets in code; configuration is validated at boot (`config/env.ts`) and a
  weak `JWT_SECRET` is rejected. docker-compose defaults are explicitly marked unsafe.
- Passwords hashed with bcrypt (cost 10); login rate-limited; enumeration-resistant.
- Token in `httpOnly` cookie (§5); `SameSite=Lax` blocks cross-site POSTs (CSRF);
  cookie is `Secure` when `SESSION_COOKIE_SECURE=true`.
- `helmet` default headers (CSP, no sniff, frame-ancestors) on the API;
  `poweredByHeader` off on both servers.
- All SQL through Drizzle's parameterised builder — no string concatenation;
  `LIKE` wildcards are escaped in search.
- Strict input validation and size limits (§4); malformed identifiers never reach
  the database as errors.
- 500s never leak stack traces or driver messages.
- Docker images run as the unprivileged `node` user, multi-stage so dev
  dependencies and sources are not in the runtime layer.
- CORS is restricted to the configured origins for anyone calling the API
  directly (Swagger UI, scripts); the web app itself is same-origin.

Not built: refresh tokens/revocation, account lockout, audit of reads, secrets
manager integration, dependency scanning in CI.

## 9. Stability

- **Boot order** validates config, waits for the database (retrying), applies
  migrations, seeds, then listens. Any failure exits non-zero so the orchestrator
  restarts the container instead of leaving a half-alive process.
- **Graceful shutdown** on SIGTERM/SIGINT: stop accepting, drain in-flight
  requests, close the pool, with a 10 s hard deadline.
- **Health endpoints**: `/health` (liveness, no dependencies) and `/ready`
  (readiness — pings Postgres). docker-compose gates the frontend on the backend's
  health check.
- **Unhandled rejections** are fatal by design — a process in an unknown state is
  worse than a restart.
- **Structured logging** (pino, JSON in production, pretty in dev) with request
  ids, latency and status on every request; auth headers redacted.
- **Transactions** around every multi-statement write (revision + update), so
  history and current state cannot diverge.
- **Deterministic migrations** committed as SQL and applied exactly once
  (Drizzle's migration journal).

## 10. Performance and scalability

Today's numbers are tiny — one host, a few units, hundreds of reservations a year
— so the design optimises for correctness and clarity first and leaves clear seams
for scale:

- **Stateless API** → scale horizontally behind a load balancer; JWTs need no
  session store. The only shared state is Postgres.
- **Connection pooling** per replica (max 10); with many replicas, PgBouncer in
  front of Postgres is the standard next step.
- **Indexes** match the access paths (§7); list endpoints are paginated and capped.
- **The overlap check is O(log n)** via the GiST index and costs nothing extra on
  the application side — no "read then write" round trip.
- **Frontend caching** with TanStack Query: stale-while-revalidate, request
  de-duplication, targeted invalidation after writes, `keepPreviousData` so
  filtering feels instant.
- **Read replicas** would serve the list/detail endpoints if reads dominate;
  writes stay on the primary because the constraint must see all rows.
- **Hot spots to watch**: `COUNT(*)` for `meta.total` on very large tables
  (switch to estimated counts or cursor pagination), the revision tables growing
  unbounded (partition by month or archive to object storage).

## 11. Testing

Pyramid, bottom-up:

- **Unit** (backend): date helpers, error mapper — pure functions, milliseconds.
- **Integration** (backend, the bulk): supertest drives the real Express app
  against a real Postgres (`minut_test`, created and migrated by the test global
  setup). Every business rule is tested through HTTP: overlap in all its
  variants including a concurrent burst, back-to-back stays, version conflicts,
  soft-delete freeing nights, time filters at the boundaries, role enforcement,
  validation details, history. Mocking the database would have tested nothing
  that matters here — the constraint *is* the feature.
- **Component** (frontend): Testing Library drives `ReservationForm` like a user:
  required fields, date ordering, payload shape, and how API `409`/`400` responses
  are rendered.
- **Unit** (frontend): the proxy route handler (cookie → Bearer, status
  pass-through) with `fetch` and `next/headers` mocked; the error mapper.
- **Contract**: CI regenerates the OpenAPI document and the TypeScript client
  and fails on drift, so backend and frontend cannot disagree about the API.
- **Smoke**: `docker compose up` followed by the curl sequence in the root README.

Not built: end-to-end browser tests (Playwright) and load tests. Both would be
the next additions; the app already runs headless-friendly under compose.

## 12. Infrastructure for hosting

Everything ships as two OCI images plus Postgres, wired by `docker-compose.yml`.
That same shape maps onto most hosting options:

- **Simplest**: a single VM with `docker compose up` behind Caddy/Traefik for TLS,
  Postgres in the compose stack with a volume and nightly `pg_dump` to object
  storage.
- **Managed containers**: Fly.io / Render / Railway / AWS ECS / Cloud Run for the
  two services, a managed Postgres (RDS, Cloud SQL, Neon, Supabase) with automated
  backups and PITR. Health checks are already exposed; `TRUST_PROXY=true` and
  `SESSION_COOKIE_SECURE=true` are the two flags to flip behind TLS.
- **Kubernetes** when there are many services: the images run unprivileged,
  read config from env, log JSON to stdout, and expose liveness/readiness probes,
  so they need no changes.

Migrations run on boot; with several API replicas starting at once, Drizzle's
migration table serialises them, but the safer production pattern is a dedicated
migration job/init-container before the rollout.

Secrets (`JWT_SECRET`, `DATABASE_URL`, admin bootstrap password) come from the
platform's secret store — never from the image. Observability would start with
shipping the pino JSON logs to a log store and adding OpenTelemetry tracing keyed
on the existing request id.

---

## Things I would do next, in order

1. Playwright end-to-end suite running against `docker compose` in CI.
2. Refresh tokens + logout-everywhere (token revocation list in Postgres/Redis).
3. Multi-tenancy: `host_id` on units, scoped queries, admin-of-own-units role.
4. Cursor pagination and estimated counts once lists grow.
5. Calendar view in the UI (the API's period query already supports it).

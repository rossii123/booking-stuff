# Minut take-home assignment (fullstack)

> **Solution:** see the [Solution](#solution) section at the bottom of this file,
> [`docs/DESIGN.md`](docs/DESIGN.md) for design notes on every interview topic,
> and the per-package READMEs in [`backend/`](backend/README.md) and [`frontend/`](frontend/README.md).

Thank you for taking the time for this assignment. We aim for the assignment to take roughly 4 hours, but it may take a little longer. As soon as you are done please submit it to us either as a compressed file or as a git repository which we can access. Please do not post this document online or share it with anyone else. If you need clarifications don’t hesitate to contact us.

In this assignment you will build a simple booking system that can be used for managing guests staying at a rented flat. The end user is someone managing a flat on Airbnb or similar.

## Part 1. Create a simple REST API backend for a managing reservations and rental units
The backend should fulfill the following requirements:

- Build it using NodeJS with Typescript
- Runnable using Docker
- Expose an HTTP Rest API with CRUD support for the entities listed below.
- Store entities in a database. The project scaffolding provides a connection to mongodb, but feel free to switch this out with another database if you want.

### API entities:

#### Rental unit

Contains information about a rental unit/property/apartment. A rental unit contains at least a name, can also include an address.

#### Reservations

Contains booking information for a guest. A reservation contains at least a start and end date and guest name. It should be possible to query the API for all reservations by both rental unit and time.

## Part 2. Create a simple web application for viewing and managing the reservations and rental units

The web app should fulfill the following requirements.

- Use the API that you have created above.
- It should be possible to view the list of reservations
- It should be possible to view the list of rental units
- It should be possible to create and edit reservations
- It is fine to make the task technically simpler by not choosing the optimal UX solution.
- Use React, since our software stack is based on React we also prefer the solution to be completed with React.
- Regarding HTML, CSS & Javascript, feel free to use the latest and greatest. :)





## Interview expectations
During the interview we expect you to be able to present your solution and to answer questions related to how and why you’ve designed the project the way you did. Below are some topics we’re interested in discussing with you in detail (comments regarding these topics in the code are greatly appreciated) :

- API:
  - Design: Your design should take into account the relationship between the entities.
  - Documentation
  - Versioning
  - Input validation
- Authentication + Authorization
- Error handling
- Infrastructure for hosting applications
- Data modeling
  - Relationships
  - Versioning
- Security aspects
- Stability aspects
- Performance aspects
  - Scalability
- Testing

---

# Solution

A booking system for someone renting out one or more flats: a REST API
(Node 22 · TypeScript · Express 5 · PostgreSQL 16 · Drizzle) and a web app
(Next.js 16 · React 19 · TanStack Query). Everything runs with one command.

## Quickstart

```bash
docker compose up --build -d      # Postgres + API + web app (first build ≈ 1–2 min)

open http://localhost:3000        # web app
open http://localhost:5006/v1/docs # interactive API docs (Swagger UI)
```

Demo accounts (seeded on first boot, override via `.env` — see `.env.example`):

| Account               | Password     | Can                          |
| --------------------- | ------------ | ---------------------------- |
| `admin@example.com`   | `admin1234`  | view, create, edit, delete   |
| `viewer@example.com`  | `viewer1234` | view only                    |

Stop with `docker compose down` (add `-v` to also drop the database volume).

## What is in the box

**API** (`backend/`) — `/v1`, JSON, JWT bearer auth, OpenAPI-documented

| Method              | Path                                    | Notes                                                   |
| ------------------- | --------------------------------------- | ------------------------------------------------------- |
| POST                | `/v1/auth/login`                        | email + password → JWT (rate limited)                   |
| GET                 | `/v1/auth/me`                           |                                                         |
| GET / POST          | `/v1/rental-units`                      | paginated, `?q=` search                                 |
| GET / PATCH / DELETE| `/v1/rental-units/{id}`                 | PATCH needs `version`; DELETE is soft, 409 if booked    |
| GET                 | `/v1/rental-units/{id}/reservations`    | `?from=&to=` period filter                              |
| GET                 | `/v1/rental-units/{id}/history`         | previous versions                                       |
| GET / POST          | `/v1/reservations`                      | `?rentalUnitId=&from=&to=&sort=` — **by unit and time** |
| GET / PATCH / DELETE| `/v1/reservations/{id}`                 | 409 `RESERVATION_OVERLAP` on double booking             |
| GET                 | `/v1/reservations/{id}/history`         |                                                         |
| GET                 | `/health`, `/ready`                     | liveness / readiness                                    |
| GET                 | `/v1/openapi.json`, `/v1/docs`          | spec + Swagger UI                                       |

**Web app** (`frontend/`) — sign in, list/filter/sort reservations, create and
edit reservations with inline server-error feedback (overlap, stale version),
list/search rental units, create/edit units, see each unit's upcoming stays and
every record's change history. Viewers see everything read-only.

## Key design decisions (short version — long version in `docs/DESIGN.md`)

- **PostgreSQL instead of MongoDB.** The domain is relational and the core rule
  — no double booking — is enforced by an `EXCLUDE USING gist` constraint over
  `daterange(check_in, check_out, '[)')`. Two concurrent requests for the same
  nights cannot both succeed, no matter how many API replicas run.
- **Half-open date ranges.** Checkout day == next checkin day is allowed.
- **Optimistic locking + history.** Every row has a `version`; updates must send
  it back (409 on mismatch) and the previous state is snapshotted to a revisions
  table. Deletes are soft.
- **Schemas drive everything.** zod validates requests, generates the OpenAPI
  document, and (via codegen) types the frontend client. CI fails on drift.
- **Token never reaches the browser.** Next.js stores the JWT in an httpOnly
  cookie and proxies API calls server-side — no XSS token theft, no CORS.
- **Two roles**, enforced by the API; the UI merely hides what you cannot do.

## Development

```bash
# API with hot reload against the compose Postgres
docker compose up -d postgres
cd backend && cp .env.example .env && npm install && npm run dev

# web app with hot reload against the API on :5006
cd frontend && cp .env.example .env && npm install && npm run dev

# tests
cd backend  && npm test          # 52 unit + integration tests (real Postgres)
cd frontend && npm test          # 14 component + unit tests
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck and tests for both packages
against a Postgres service, checks the OpenAPI document and generated client are
up to date, and builds both Docker images.

## Try the rules from the terminal

```bash
TOKEN=$(curl -s -XPOST localhost:5006/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"admin@example.com","password":"admin1234"}' | jq -r .data.token)
AUTH="Authorization: Bearer $TOKEN"; JSON='content-type: application/json'

UNIT=$(curl -s -XPOST localhost:5006/v1/rental-units -H "$AUTH" -H "$JSON" \
  -d '{"name":"Sunny loft","city":"Stockholm"}' | jq -r .data.id)

# book Jul 1–5, then try Jul 3–8 → 409 RESERVATION_OVERLAP; Jul 5–9 → 201 (back-to-back)
curl -s -XPOST localhost:5006/v1/reservations -H "$AUTH" -H "$JSON" \
  -d "{\"rentalUnitId\":\"$UNIT\",\"guestName\":\"Ada\",\"checkIn\":\"2024-07-01\",\"checkOut\":\"2024-07-05\"}"
curl -s -XPOST localhost:5006/v1/reservations -H "$AUTH" -H "$JSON" \
  -d "{\"rentalUnitId\":\"$UNIT\",\"guestName\":\"Bob\",\"checkIn\":\"2024-07-03\",\"checkOut\":\"2024-07-08\"}"

# everything booked in a period, for one unit
curl -s "localhost:5006/v1/reservations?rentalUnitId=$UNIT&from=2024-07-01&to=2024-08-01" -H "$AUTH"
```

## Time spent

Roughly 12 hours — deliberately beyond the suggested 4 to cover the interview
topics (auth, docs, versioning, testing, CI) with working code rather than
hand-waving. The hard requirements (Docker, CRUD, query by unit and time,
React UI) are met by the first two commits; the rest is layered on top.


# Frontend — Minut Booking web app

Next.js 16 (App Router) · React 19 · TanStack Query · react-hook-form + zod · Tailwind CSS 4 · Vitest

## Run

```bash
# full stack, from the repository root
docker compose up --build -d
open http://localhost:3000          # admin@example.com / admin1234

# or locally against a running API
cp .env.example .env                 # API_URL=http://localhost:5006
npm install
npm run dev
```

## How it talks to the API

The browser never calls the API directly and never sees a token:

1. `POST /api/auth/login` (a Route Handler) forwards credentials to the API and
   stores the returned JWT in an **httpOnly, SameSite=Lax cookie**.
2. Every data call goes to `/api/v1/...`; the catch-all Route Handler in
   `src/app/api/[...path]/route.ts` attaches `Authorization: Bearer <cookie>` and
   forwards to `API_URL`, passing status and body through unchanged.
3. `src/proxy.ts` redirects page navigations without a valid-looking session to
   `/login`; the `(app)` layout re-checks and exposes the user to React.

`src/lib/api/schema.d.ts` is **generated** from `../backend/openapi.json`
(`npm run api:types`) and drives the typed `openapi-fetch` client, so a backend
schema change fails the frontend build instead of a user's request.

## Scripts

| Script              | What it does                                   |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Dev server on :3000                            |
| `npm run build`     | Production build (`output: 'standalone'`)      |
| `npm test`          | Vitest + Testing Library (jsdom)               |
| `npm run lint`      | ESLint (next/core-web-vitals + typescript)     |
| `npm run typecheck` | `tsc --noEmit`                                 |
| `npm run api:types` | Regenerate the API types from the OpenAPI spec |

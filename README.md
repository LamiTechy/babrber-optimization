# Gentry

Hyper-local barber discovery for **Ojere, Abeokuta, Ogun State, Nigeria** — find nearby barbershops, check whether they're open right now, and get directions.

## Stack

- **Next.js 16** (App Router, Turbopack) + **TypeScript** + **React 19**
- **Tailwind CSS v4** — charcoal/gold theme, dark mode
- **Drizzle ORM** — Postgres: **Neon** in production, embedded **PGlite** locally (no Postgres install needed)
- **Leaflet / react-leaflet** map, **Zod** validation, **jose** + **bcryptjs** admin auth
- **date-fns** in `Africa/Lagos`, OSM **Overpass API** for map data
- **Vitest** for unit tests, **ESLint** for linting

## Getting started

```bash
cp .env.example .env.local   # then edit the values
npm install
npm run db:seed              # applies drizzle/*.sql, creates the admin, landmarks, sample shops
npm run dev                  # http://localhost:3000
```

Without `DATABASE_URL`, the app opens an embedded PGlite database in `.data/gentry` (gitignored, disposable — delete it and re-run `npm run db:seed` to reset).

### Environment (`.env.local`)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon connection string. Omit locally to use the embedded database. |
| `JWT_SECRET` | Signs the admin session cookie (`openssl rand -base64 48`). |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | The single admin account created by `npm run db:seed`. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob store for shop photos. Unset → uploads return `503 storage_unavailable`. |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL used by metadata, sitemap, and share links. |
| `CRON_SECRET` | Bearer token required by `GET /api/cron/sync`. |
| `SHOW_SAMPLES` | `true` shows the 5 demo shops; keep `false` in production. |
| `CONTACT_EMAIL` | Overpass User-Agent contact (Overpass etiquette). |
| `ALLOW_EMBEDDED_DB` | Local-only: lets `next build` run without `DATABASE_URL`. Never set on Vercel. |

## Scripts

```bash
npm run dev              # development server
npm run build            # production build
npm run start            # serve the production build
npm run lint             # eslint
npm run test             # vitest (unit tests)
npm run db:generate      # generate a migration from lib/db/schema.ts
npm run db:migrate       # apply migrations to DATABASE_URL
npm run db:seed          # seed admin, landmarks, sample shops
npm run db:clear-samples # remove the demo shops
npm run sync:osm         # import barbershops from OpenStreetMap (tsx scripts/sync-osm.ts)
```

## How it works

**Public site** — `app/page.tsx` (search), `app/results/page.tsx` (nearby list / map, filters in the URL), `app/shop/[slug]/page.tsx` (details, hours, services, directions). Location comes from the browser, a typed landmark, or a pin drop; it's persisted in `localStorage` under `gentry:location`.

**Hours** — `lib/hours.ts` parses OSM `opening_hours`, evaluates in `Africa/Lagos`, and produces badges: `Open now · Closes 9:00 PM`, `Closing soon · Closes in N min`, `Closed · Opens …`, `Hours not listed · Call to confirm`. `00:00–24:00` is an all-day `open` badge.

**Admin** — `/admin` (login + dashboard). Session is a JWT cookie guarded by `proxy.ts` (Next 16's middleware). Shops can be edited by section (details / hours / services / photos), soft-deleted, and verified. Photo uploads go to Vercel Blob.

**OSM sync** — `POST /api/admin/osm/sync` (admin) and `GET /api/cron/sync` (daily Vercel Cron at 03:00 UTC, `vercel.json` — Hobby plans only allow once-daily crons). `lib/osm/importShops.ts` upserts mapped shops, hides ones that disappear, never overwrites manually edited shops, and records each run in `sync_runs` (one-hour cooldown). `lib/osm/overpass.ts` retries with backoff and falls back to a mirror; outages surface as `502 upstream_unavailable`.

## Deploy

1. Create a Neon database and a Vercel Blob store.
2. Set the environment variables above (use the **pooled** Neon URL; set `SHOW_SAMPLES=false`).
3. `npm run db:migrate && npm run db:seed` once, or run them from a release step.
4. `vercel deploy` — the daily OSM sync cron comes from `vercel.json` (03:00 UTC) and authenticates with `CRON_SECRET`.

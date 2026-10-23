# Me Time Hotel Ordering Platform

Me Time is a small hotel ordering platform for menu management, hotel-specific customer ordering, and front-desk order visibility. The original single-file browser demo has been upgraded into a Vercel-compatible full-stack app with a Node API and Turso/libSQL persistence.

## What is included

The hotel portal at `/` lets staff create or reopen a hotel workspace, add or remove menu items, and see the active hotel’s order queue. When a staff member adds a menu item without a custom image URL, the browser automatically creates a food-photo prompt from the exact product name and stores the generated menu image URL with that product. Staff can disable this or supply their own image URL. The public customer menu is `/customer.html?hotel=<hotel-slug>`; customers can select menu items, add a room/table number, and send a persistent order to that hotel. The staff board is `/customers.html?hotel=<hotel-slug>`; it shows only that hotel’s customer orders and lets staff mark each order seen/unseen and move it through `new`, `preparing`, `ready`, `completed`, or `cancelled`.

The API lives in `api/index.js` and exposes `/api/health`, hotel creation/lookup, product CRUD, order creation/listing, and order `PATCH` updates. Order items snapshot the name and price at checkout, so later menu edits do not rewrite history.

## Local development

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Local development uses a file-backed libSQL database at `.data/me-time.db` and seeds a `Saffron Garden Hotel` demo hotel on the first run. Run `npm run check` for syntax checks and `npm run db:setup` to initialize the local schema explicitly.

## Turso setup

Create a Turso database and obtain its URL and auth token. The repository includes the reference migration at `migrations/001_initial.sql`; the app also bootstraps the same idempotent schema when the first API request arrives.

```bash
turso db create me-time-online-service
turso db show me-time-online-service
turso db tokens create me-time-online-service
```

For a production deployment, set these Vercel environment variables for the Hobby project:

- `TURSO_DATABASE_URL` — the `libsql://...` database URL.
- `TURSO_AUTH_TOKEN` — the Turso auth token.

Never commit either value. `.env.example` documents the contract and `.gitignore` excludes local secrets and data.

## Vercel Hobby deployment

Import the GitHub repository `KiptooRyan/me-time-online-service` into Vercel, choose the Hobby plan, and add the two Turso environment variables for Preview and Production. The committed `vercel.json` rewrites `/api/*` to the Vercel Function in `api/index.js`; the HTML, CSS, and browser script remain static assets. After deployment, verify `/api/health` returns `{ "ok": true, "database": "turso" }`.

If using the Vercel CLI after authentication:

```bash
vercel --prod
```

The repository is intentionally framework-free, so Vercel does not need a build step. Node functions use the package manifest and the platform’s Node runtime.

## Important production note

The current staff portal uses a lightweight hotel name + phone workspace lookup to preserve the original demo’s simple experience. Before sharing staff URLs broadly, add a real authentication layer and authorization checks around menu and order mutations. The hotel-specific routing and persistence are already separated so that stronger authentication can be added without redesigning the customer or staff pages.

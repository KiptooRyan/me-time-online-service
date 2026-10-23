# Me Time Hotel Ordering Platform

## Scope

Turn the original browser-only hotel menu demo into a deployable hotel ordering platform with persistent Turso/libSQL data, a hotel portal, a public hotel-specific customer ordering page, and a customer/order board for each hotel. Keep the existing repository and use a Vercel-compatible Node API so the app can run on the Vercel Hobby plan.

## Implementation approach

- Use a small dependency-light Node HTTP API in `api/index.js` that is compatible with Vercel Functions and the local server.
- Use `@libsql/client` for Turso in production and a local file-backed libSQL database during development, with the same SQL schema in both environments.
- Store hotels, menus, orders, and order items in normalized tables. Orders retain a snapshot of item names/prices so historical orders remain accurate even when menus change.
- Keep the frontend framework-free and split the experience into three focused pages: `index.html` for hotel staff/menu management, `customer.html` for a public hotel-specific order flow, and `customers.html` for staff to review orders, mark them seen, and progress status.
- Add a shared stylesheet and small page scripts using DOM APIs rather than unsafe HTML interpolation.
- Add Vercel rewrites for `/api/*`, health checks, an environment example, migration SQL, and deployment documentation.

## Design

### Candidate styles

- **Boutique hotel control room** — 0.07
- **Warm editorial menu** — 0.05
- **Quiet utility dashboard** — 0.08

### Chosen direction: Boutique hotel control room

**Design movement:** A calm hospitality dashboard with warm editorial accents and a precise operations layer.

**Core principles:** Make the hotel context obvious, surface the next action first, keep order state legible at a glance, and make the customer ordering flow feel lighter than the staff view.

**Color philosophy:** Warm parchment and ink provide hospitality and trust, while saffron is reserved for actions and status emphasis. A cool teal accent separates operational controls from menu content.

**Layout paradigm:** Asymmetric split panels with a narrow context rail and wide working surface; mobile collapses into stacked cards without losing context.

**Signature elements:** Hotel identity badge, pill-shaped status markers, and a subtle route label showing the active hotel slug.

**Interaction philosophy:** Every state change gives immediate visual feedback and preserves the selected hotel. “Seen” is explicit and reversible rather than implied by navigation.

**Animation:** Use short 160–220ms fades and vertical lifts for cards; never animate order status in a way that hides a change.

**Typography system:** System sans for controls and data, with high-contrast size changes and generous line height for hospitality staff using phones.

**Brand essence:** A practical digital front desk for menus and room-service orders; warm, clear, dependable.

**Brand voice:** Direct, welcoming, and operational. Example lines: “Your hotel, in one clean shift view.” and “New order? Mark it seen, then move it forward.”

**Wordmark & logo:** A small doorway-and-check mark motif beside the “Me Time” wordmark.

**Signature brand color:** Saffron `#d97706`, used sparingly to make actions feel intentional.

## Project structure

- `index.html` — hotel staff portal and menu management.
- `customer.html` — public ordering flow scoped by `?hotel=<slug>`.
- `customers.html` — hotel-specific order/customer board with seen and status controls.
- `styles.css` — responsive visual system shared by all pages.
- `app.js` — browser API helpers, session helpers, and page-specific controllers.
- `api/index.js` — Vercel Function and local API handler.
- `db.js` — libSQL/Turso client and schema bootstrap.
- `server.js` — local static/API server.
- `migrations/001_initial.sql` — repeatable production schema reference.
- `vercel.json` — API rewrite and deployment routing.

## Runtime behavior

The API requires `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` on Vercel. Without them, local development uses `.data/me-time.db`; production returns a clear configuration error instead of silently losing data. Hotel sessions are intentionally lightweight for this first release: hotel staff identify themselves by hotel name and phone, while deployment documentation calls out where stronger authentication should be added before multi-hotel public use.

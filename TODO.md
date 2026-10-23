# Delivery outcomes

## Full-stack hotel ordering foundation

- [x] Replace the browser-only `localStorage` data flow with a Vercel-compatible Node API and persistent Turso/libSQL storage.
- [x] Keep local development runnable without cloud credentials through a local file-backed libSQL database.
- [x] Provide normalized tables for hotels, products, orders, and order items, with item snapshots preserved on orders.

## Hotel portal and menu management

- [x] Let a hotel identify itself with its name and phone and reopen the same hotel session on the device.
- [x] Let hotel staff add and delete menu products with name, Ksh price, and optional image URL.
- [x] Generate a menu image from the exact product name when staff add an item without a custom image URL.
- [x] Show the active hotel context and summary counts in the staff portal.

## Customer ordering page

- [x] Provide a separate public customer page scoped to a specific hotel using a hotel slug.
- [x] Load only that hotel’s menu, allow customer name and table/room number, and create a persistent order with items and total.
- [x] Show a clear confirmation and order reference after the order is created.

## Customers and order visibility page

- [x] Provide a hotel-specific `customers.html?hotel=<slug>` page showing recent customers and their orders.
- [x] Let staff mark each order seen/unseen and update status through new, preparing, ready, completed, or cancelled.
- [x] Filter the board by status and refresh the current hotel without mixing orders from another hotel.

## Deployable delivery

- [x] Include Turso environment documentation, migration SQL, Vercel rewrite configuration, and a health endpoint.
- [x] Run type/syntax checks, API smoke tests, and a production build/static-file check before delivery.
- [ ] Push the completed implementation to the requested GitHub repository.
- [ ] Publish to Vercel Hobby when the user’s Vercel authorization and Turso credentials are available.

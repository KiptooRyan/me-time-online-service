const path = require('node:path');
const fs = require('node:fs');
const { createClient } = require('@libsql/client');

let client;
let schemaPromise;

function getClient() {
  if (client) return client;

  if (process.env.TURSO_DATABASE_URL || process.env.TURSO_AUTH_TOKEN) {
    if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
      const error = new Error('Turso requires both TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.');
      error.code = 'DATABASE_NOT_CONFIGURED';
      throw error;
    }
    client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    return client;
  }

  if (process.env.NODE_ENV === 'production') {
    const error = new Error('Turso is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.');
    error.code = 'DATABASE_NOT_CONFIGURED';
    throw error;
  }

  const dbPath = path.resolve(process.env.DEV_DB_PATH || '.data/me-time.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  client = createClient({ url: `file:${dbPath}` });
  return client;
}

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS hotels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price >= 0),
    image_url TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    table_no TEXT,
    total INTEGER NOT NULL CHECK (total >= 0),
    status TEXT NOT NULL DEFAULT 'new',
    seen INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    unit_price INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0)
  )`,
  'CREATE INDEX IF NOT EXISTS idx_products_hotel ON products(hotel_id)',
  'CREATE INDEX IF NOT EXISTS idx_orders_hotel_created ON orders(hotel_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)',
];

async function seedLocalDemo() {
  if (process.env.TURSO_DATABASE_URL || process.env.NODE_ENV === 'production') return;
  const db = getClient();
  const result = await db.execute('SELECT COUNT(*) AS count FROM hotels');
  if (Number(result.rows[0].count) > 0) return;

  const now = new Date().toISOString();
  await db.batch([
    { sql: 'INSERT INTO hotels (id, name, slug, phone, created_at) VALUES (?, ?, ?, ?, ?)', args: ['hotel_demo', 'Saffron Garden Hotel', 'saffron-garden', '+254 700 000 000', now] },
    { sql: 'INSERT INTO products (id, hotel_id, name, price, image_url, created_at) VALUES (?, ?, ?, ?, ?, ?)', args: ['product_demo_1', 'hotel_demo', 'Breakfast basket', 850, 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=700&q=80', now] },
    { sql: 'INSERT INTO products (id, hotel_id, name, price, image_url, created_at) VALUES (?, ?, ?, ?, ?, ?)', args: ['product_demo_2', 'hotel_demo', 'Grilled tilapia plate', 1450, 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=700&q=80', now] },
    { sql: 'INSERT INTO products (id, hotel_id, name, price, image_url, created_at) VALUES (?, ?, ?, ?, ?, ?)', args: ['product_demo_3', 'hotel_demo', 'Fresh passion juice', 300, 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=700&q=80', now] },
  ], 'write');
}

async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const db = getClient();
      for (const sql of schemaStatements) await db.execute(sql);
      await seedLocalDemo();
    })().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  await schemaPromise;
  return getClient();
}

module.exports = { getClient, ensureSchema };

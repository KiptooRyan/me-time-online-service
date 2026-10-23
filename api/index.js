const crypto = require('node:crypto');
const { ensureSchema } = require('../db');

const STATUS_VALUES = new Set(['new', 'preparing', 'ready', 'completed', 'cancelled']);

function id(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function now() {
  return new Date().toISOString();
}

function slugify(value) {
  const slug = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || `hotel-${crypto.randomBytes(3).toString('hex')}`;
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function fail(message, status = 400, code = 'BAD_REQUEST') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}

async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    fail('Request body must be valid JSON.', 400, 'INVALID_JSON');
  }
}

function text(value, label, max = 160) {
  const result = String(value ?? '').trim();
  if (!result) fail(`${label} is required.`);
  if (result.length > max) fail(`${label} is too long.`);
  return result;
}

function optionalText(value, max = 500) {
  const result = String(value ?? '').trim();
  return result ? result.slice(0, max) : null;
}

function integer(value, label, minimum = 0) {
  const result = Number(value);
  if (!Number.isInteger(result) || result < minimum) fail(`${label} must be an integer of at least ${minimum}.`);
  return result;
}

async function hotelByKey(db, key) {
  const value = text(key, 'Hotel');
  const result = await db.execute({
    sql: 'SELECT id, name, slug, phone, created_at FROM hotels WHERE id = ? OR slug = ? LIMIT 1',
    args: [value, value],
  });
  if (!result.rows[0]) fail('Hotel not found for this page.', 404, 'HOTEL_NOT_FOUND');
  return result.rows[0];
}

function hotelView(row) {
  return { id: row.id, name: row.name, slug: row.slug, phone: row.phone, createdAt: row.created_at };
}

function productView(row) {
  return { id: row.id, hotelId: row.hotel_id, name: row.name, price: Number(row.price), imageUrl: row.image_url, createdAt: row.created_at };
}

async function orderView(db, row) {
  const items = await db.execute({
    sql: 'SELECT id, product_id, product_name, unit_price, quantity FROM order_items WHERE order_id = ? ORDER BY rowid',
    args: [row.id],
  });
  return {
    id: row.id,
    hotelId: row.hotel_id,
    customerName: row.customer_name,
    tableNo: row.table_no,
    total: Number(row.total),
    status: row.status,
    seen: Boolean(row.seen),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: items.rows.map((item) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      unitPrice: Number(item.unit_price),
      quantity: Number(item.quantity),
    })),
  };
}

async function routes(req, res, db) {
  const url = new URL(req.url || '/', 'http://localhost');
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'index.js') parts.shift();
  const resource = parts[0] || 'health';
  const idPart = parts[1];

  if (req.method === 'GET' && resource === 'health') {
    return send(res, 200, { ok: true, database: process.env.TURSO_DATABASE_URL ? 'turso' : 'local-file', time: now() });
  }

  if (resource === 'hotels' && req.method === 'GET') {
    const key = url.searchParams.get('slug') || url.searchParams.get('hotel') || url.searchParams.get('hotelId');
    if (key) return send(res, 200, { hotel: hotelView(await hotelByKey(db, key)) });
    const result = await db.execute('SELECT id, name, slug, phone, created_at FROM hotels ORDER BY name');
    return send(res, 200, { hotels: result.rows.map(hotelView) });
  }

  if (resource === 'hotels' && req.method === 'POST') {
    const input = await body(req);
    const name = text(input.name, 'Hotel name');
    const phone = text(input.phone, 'Phone number', 40);
    const existing = await db.execute({ sql: 'SELECT id, name, slug, phone, created_at FROM hotels WHERE lower(name) = lower(?) AND phone = ? LIMIT 1', args: [name, phone] });
    if (existing.rows[0]) return send(res, 200, { hotel: hotelView(existing.rows[0]), existing: true });

    let slug = slugify(name);
    const collision = await db.execute({ sql: 'SELECT id FROM hotels WHERE slug = ?', args: [slug] });
    if (collision.rows[0]) slug = `${slug}-${crypto.randomBytes(2).toString('hex')}`;
    const row = { id: id('hotel'), name, slug, phone, created_at: now() };
    await db.execute({ sql: 'INSERT INTO hotels (id, name, slug, phone, created_at) VALUES (?, ?, ?, ?, ?)', args: [row.id, row.name, row.slug, row.phone, row.created_at] });
    return send(res, 201, { hotel: hotelView(row), existing: false });
  }

  if (resource === 'products' && req.method === 'GET') {
    const hotel = await hotelByKey(db, url.searchParams.get('hotel') || url.searchParams.get('hotelId'));
    const result = await db.execute({ sql: 'SELECT id, hotel_id, name, price, image_url, created_at FROM products WHERE hotel_id = ? ORDER BY created_at DESC', args: [hotel.id] });
    return send(res, 200, { hotel: hotelView(hotel), products: result.rows.map(productView) });
  }

  if (resource === 'products' && req.method === 'POST') {
    const input = await body(req);
    const hotel = await hotelByKey(db, input.hotelId || input.hotel);
    const name = text(input.name, 'Product name');
    const price = integer(input.price, 'Price');
    const imageUrl = optionalText(input.imageUrl, 1000);
    const row = { id: id('product'), hotel_id: hotel.id, name, price, image_url: imageUrl, created_at: now() };
    await db.execute({ sql: 'INSERT INTO products (id, hotel_id, name, price, image_url, created_at) VALUES (?, ?, ?, ?, ?, ?)', args: [row.id, row.hotel_id, row.name, row.price, row.image_url, row.created_at] });
    return send(res, 201, { product: productView(row) });
  }

  if (resource === 'products' && req.method === 'DELETE' && idPart) {
    const hotel = await hotelByKey(db, url.searchParams.get('hotel') || url.searchParams.get('hotelId'));
    const result = await db.execute({ sql: 'DELETE FROM products WHERE id = ? AND hotel_id = ?', args: [idPart, hotel.id] });
    if (!result.rowsAffected) fail('Product not found for this hotel.', 404, 'PRODUCT_NOT_FOUND');
    return send(res, 200, { ok: true });
  }

  if (resource === 'orders' && req.method === 'GET') {
    const hotel = await hotelByKey(db, url.searchParams.get('hotel') || url.searchParams.get('hotelId'));
    const status = url.searchParams.get('status');
    if (status && !STATUS_VALUES.has(status)) fail('Unknown order status.');
    const result = await db.execute({
      sql: `SELECT id, hotel_id, customer_name, table_no, total, status, seen, notes, created_at, updated_at
            FROM orders WHERE hotel_id = ? ${status ? 'AND status = ?' : ''} ORDER BY created_at DESC LIMIT 100`,
      args: status ? [hotel.id, status] : [hotel.id],
    });
    return send(res, 200, { hotel: hotelView(hotel), orders: await Promise.all(result.rows.map((row) => orderView(db, row))) });
  }

  if (resource === 'orders' && req.method === 'POST') {
    const input = await body(req);
    const hotel = await hotelByKey(db, input.hotelId || input.hotel);
    const customerName = text(input.customerName, 'Customer name');
    const tableNo = optionalText(input.tableNo, 80);
    const notes = optionalText(input.notes, 500);
    if (!Array.isArray(input.items) || input.items.length === 0) fail('Add at least one item to the order.');

    const ids = input.items.map((item) => text(item.productId, 'Product id', 100));
    const placeholders = ids.map(() => '?').join(',');
    const products = await db.execute({ sql: `SELECT id, name, price FROM products WHERE hotel_id = ? AND id IN (${placeholders})`, args: [hotel.id, ...ids] });
    const byId = new Map(products.rows.map((product) => [product.id, product]));
    const items = input.items.map((item) => {
      const product = byId.get(item.productId);
      if (!product) fail('One or more selected items are no longer on this hotel menu.', 409, 'MENU_CHANGED');
      return { productId: product.id, productName: product.name, unitPrice: Number(product.price), quantity: integer(item.quantity, 'Quantity', 1) };
    });
    const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const createdAt = now();
    const order = { id: id('order'), hotel_id: hotel.id, customer_name: customerName, table_no: tableNo, total, status: 'new', seen: 0, notes, created_at: createdAt, updated_at: createdAt };
    const statements = [
      { sql: 'INSERT INTO orders (id, hotel_id, customer_name, table_no, total, status, seen, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', args: [order.id, order.hotel_id, order.customer_name, order.table_no, order.total, order.status, order.seen, order.notes, order.created_at, order.updated_at] },
      ...items.map((item) => ({ sql: 'INSERT INTO order_items (id, order_id, product_id, product_name, unit_price, quantity) VALUES (?, ?, ?, ?, ?, ?)', args: [id('item'), order.id, item.productId, item.productName, item.unitPrice, item.quantity] })),
    ];
    await db.batch(statements, 'write');
    return send(res, 201, { order: await orderView(db, order), hotel: hotelView(hotel) });
  }

  if (resource === 'orders' && req.method === 'PATCH' && idPart) {
    const input = await body(req);
    const hotel = await hotelByKey(db, input.hotelId || input.hotel);
    const fields = [];
    const args = [];
    if (input.seen !== undefined) {
      if (typeof input.seen !== 'boolean') fail('Seen must be true or false.');
      fields.push('seen = ?');
      args.push(input.seen ? 1 : 0);
    }
    if (input.status !== undefined) {
      if (!STATUS_VALUES.has(input.status)) fail('Unknown order status.');
      fields.push('status = ?');
      args.push(input.status);
    }
    if (!fields.length) fail('Provide seen or status to update.');
    fields.push('updated_at = ?');
    args.push(now(), idPart, hotel.id);
    const result = await db.execute({ sql: `UPDATE orders SET ${fields.join(', ')} WHERE id = ? AND hotel_id = ?`, args });
    if (!result.rowsAffected) fail('Order not found for this hotel.', 404, 'ORDER_NOT_FOUND');
    const order = await db.execute({ sql: 'SELECT id, hotel_id, customer_name, table_no, total, status, seen, notes, created_at, updated_at FROM orders WHERE id = ?', args: [idPart] });
    return send(res, 200, { order: await orderView(db, order.rows[0]) });
  }

  return send(res, 404, { error: 'Route not found.', code: 'NOT_FOUND' });
}

module.exports = async function handler(req, res) {
  try {
    const db = await ensureSchema();
    return await routes(req, res, db);
  } catch (error) {
    const status = error.status || (error.code === 'DATABASE_NOT_CONFIGURED' ? 503 : 500);
    if (status >= 500) console.error(error);
    return send(res, status, { error: error.message || 'Unexpected server error.', code: error.code || 'INTERNAL_ERROR' });
  }
};

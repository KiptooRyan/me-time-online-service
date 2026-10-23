const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const sessionKey = 'me_time_hotel';
const statusLabels = { new: 'New', preparing: 'Preparing', ready: 'Ready', completed: 'Completed', cancelled: 'Cancelled' };

async function api(path, options = {}) {
  const response = await fetch(`/api/${path.replace(/^\//, '')}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function money(value) { return `Ksh ${Number(value || 0).toLocaleString('en-KE')}`; }
function escapeText(value) { return String(value ?? ''); }
function imageSeed(value) { return [...String(value)].reduce((sum, character) => ((sum * 31) + character.charCodeAt(0)) >>> 0, 7); }
function generatedMenuImage(name) {
  const prompt = `appetizing professional editorial food photograph of ${name}, freshly plated for a boutique hotel menu, natural window light, warm neutral table, shallow depth of field, no text, no logos`;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=512&nologo=true&seed=${imageSeed(name)}`;
}
function slugFromQuery() { return new URLSearchParams(location.search).get('hotel'); }
function getSession() { try { return JSON.parse(localStorage.getItem(sessionKey) || 'null'); } catch { return null; } }
function setSession(hotel) { localStorage.setItem(sessionKey, JSON.stringify(hotel)); }
function clearSession() { localStorage.removeItem(sessionKey); }
function showNotice(element, message, type = 'error') { if (!element) return; element.textContent = message; element.className = `notice show ${type}`; }
function clearNotice(element) { if (element) element.className = 'notice'; }
function setText(selector, value) { $$(selector).forEach((element) => { element.textContent = value; }); }
function formatTime(value) { return new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
function productVisual(product) {
  const wrapper = document.createElement('div');
  wrapper.className = 'product-image';
  if (product.imageUrl) {
    const image = document.createElement('img');
    image.src = product.imageUrl;
    image.alt = escapeText(product.name);
    image.loading = 'lazy';
    image.onerror = () => { image.remove(); wrapper.textContent = '🍽️'; };
    wrapper.append(image);
  } else wrapper.textContent = '🍽️';
  return wrapper;
}
function statusBadge(status) {
  const badge = document.createElement('span');
  badge.className = `status status-${status}`;
  badge.textContent = statusLabels[status] || status;
  return badge;
}

async function initHotelPortal() {
  const loginView = $('#login-view');
  const dashboardView = $('#dashboard-view');
  const loginForm = $('#login-form');
  const loginNotice = $('#login-notice');
  const session = getSession();
  let hotel = session;

  function showDashboard() {
    loginView.hidden = true;
    dashboardView.hidden = false;
    setText('[data-hotel-name]', hotel.name);
    setText('[data-hotel-slug]', `/${hotel.slug}`);
    const links = $$('[data-hotel-link]');
    links.forEach((link) => { link.href = `${link.dataset.hotelLink}?hotel=${encodeURIComponent(hotel.slug)}`; });
    loadDashboard();
  }

  async function loadDashboard() {
    try {
      const [productsData, ordersData] = await Promise.all([
        api(`products?hotel=${encodeURIComponent(hotel.slug)}`),
        api(`orders?hotel=${encodeURIComponent(hotel.slug)}`),
      ]);
      renderProducts(productsData.products);
      renderOrders(ordersData.orders, $('#portal-orders'));
      setText('[data-product-count]', productsData.products.length);
      setText('[data-order-count]', ordersData.orders.length);
      setText('[data-unseen-count]', ordersData.orders.filter((order) => !order.seen).length);
    } catch (error) { showNotice($('#dashboard-notice'), error.message); }
  }

  function renderProducts(products) {
    const grid = $('#product-grid');
    grid.replaceChildren();
    if (!products.length) { grid.append(emptyState('No products yet. Add the first item to this hotel menu.')); return; }
    products.forEach((product) => {
      const card = document.createElement('article');
      card.className = 'product-card';
      card.append(productVisual(product));
      const body = document.createElement('div'); body.className = 'product-body';
      const title = document.createElement('h3'); title.textContent = product.name;
      const detail = document.createElement('p'); detail.textContent = money(product.price);
      const remove = document.createElement('button'); remove.className = 'btn btn-danger btn-small'; remove.textContent = 'Remove';
      remove.addEventListener('click', async () => {
        if (!confirm(`Remove ${product.name} from this menu?`)) return;
        try { await api(`products/${product.id}?hotel=${encodeURIComponent(hotel.slug)}`, { method: 'DELETE' }); loadDashboard(); }
        catch (error) { showNotice($('#dashboard-notice'), error.message); }
      });
      body.append(title, detail, remove); card.append(body); grid.append(card);
    });
  }

  function emptyState(message) { const div = document.createElement('div'); div.className = 'empty'; div.textContent = message; return div; }

  function renderOrders(orders, target) {
    target.replaceChildren();
    if (!orders.length) { target.append(emptyState('No customer orders for this hotel yet.')); return; }
    orders.forEach((order) => target.append(orderCard(order, true)));
  }

  function orderCard(order, showActions) {
    const card = document.createElement('article'); card.className = `order-card ${order.seen ? '' : 'unseen'}`;
    const top = document.createElement('div'); top.className = 'order-top';
    const heading = document.createElement('div');
    const title = document.createElement('h3'); title.textContent = order.customerName;
    const meta = document.createElement('div'); meta.className = 'order-meta'; meta.textContent = `${order.tableNo ? `Room/table ${order.tableNo} · ` : ''}${formatTime(order.createdAt)}`;
    heading.append(title, meta);
    const right = document.createElement('div'); right.append(statusBadge(order.status)); const total = document.createElement('div'); total.className = 'order-total'; total.textContent = money(order.total); right.append(total);
    top.append(heading, right); card.append(top);
    const items = document.createElement('div'); items.className = 'order-items'; order.items.forEach((item) => { const pill = document.createElement('span'); pill.className = 'item-pill'; pill.textContent = `${item.quantity} × ${item.productName}`; items.append(pill); }); card.append(items);
    if (order.notes) { const note = document.createElement('div'); note.className = 'order-meta'; note.textContent = `Note: ${order.notes}`; card.append(note); }
    if (showActions) {
      const actions = document.createElement('div'); actions.className = 'order-actions';
      const seen = document.createElement('button'); seen.className = 'btn btn-soft btn-small'; seen.textContent = order.seen ? 'Mark unseen' : 'Mark seen';
      seen.addEventListener('click', () => updateOrder(order, { seen: !order.seen }));
      const select = document.createElement('select'); select.className = 'btn-small'; select.setAttribute('aria-label', 'Update order status');
      Object.entries(statusLabels).forEach(([value, label]) => { const option = new Option(label, value, value === order.status, value === order.status); select.add(option); });
      select.addEventListener('change', () => updateOrder(order, { status: select.value }));
      actions.append(seen, select); card.append(actions);
    }
    return card;
  }

  async function updateOrder(order, update) {
    try { await api(`orders/${order.id}`, { method: 'PATCH', body: { hotelId: hotel.id, ...update } }); loadDashboard(); }
    catch (error) { showNotice($('#dashboard-notice'), error.message); }
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault(); clearNotice(loginNotice);
    const button = $('button[type="submit"]', loginForm); button.disabled = true; button.textContent = 'Opening portal…';
    try {
      const data = await api('hotels', { method: 'POST', body: { name: $('#hotel-name').value, phone: $('#hotel-phone').value } });
      hotel = data.hotel; setSession(hotel); showDashboard();
    } catch (error) { showNotice(loginNotice, error.message); }
    finally { button.disabled = false; button.textContent = 'Open hotel portal'; }
  });

  $('#product-form').addEventListener('submit', async (event) => {
    event.preventDefault(); clearNotice($('#dashboard-notice'));
    const form = event.currentTarget; const button = $('button[type="submit"]', form); button.disabled = true;
    try {
      const productName = $('#product-name').value.trim();
      const customImage = $('#product-image').value.trim();
      const imageUrl = customImage || ($('#product-auto-image').checked ? generatedMenuImage(productName) : '');
      await api('products', { method: 'POST', body: { hotelId: hotel.id, name: productName, price: Number($('#product-price').value), imageUrl } });
      form.reset(); showNotice($('#dashboard-notice'), 'Menu item added.', 'success'); loadDashboard();
    } catch (error) { showNotice($('#dashboard-notice'), error.message); }
    finally { button.disabled = false; }
  });

  $$('.rail-nav button').forEach((button) => button.addEventListener('click', () => {
    $$('.rail-nav button').forEach((item) => item.classList.remove('active')); button.classList.add('active');
    $$('.section').forEach((section) => section.classList.toggle('active', section.id === button.dataset.section));
  }));
  $('#logout').addEventListener('click', () => { clearSession(); location.reload(); });
  if (hotel) showDashboard();
}

async function initCustomerPage() {
  const slug = slugFromQuery();
  const hotelKey = slug || ($('#hotel-code') && $('#hotel-code').value);
  const notice = $('#customer-notice');
  let hotel; let products = []; const cart = new Map();
  if (!hotelKey) { showNotice(notice, 'This ordering link needs a hotel code, for example ?hotel=saffron-garden.'); return; }
  try {
    const data = await api(`products?hotel=${encodeURIComponent(hotelKey)}`); hotel = data.hotel; products = data.products; setText('[data-hotel-name]', hotel.name); setText('[data-hotel-slug]', `/${hotel.slug}`); renderMenu(); renderCart();
  } catch (error) { showNotice(notice, error.message); return; }

  function renderMenu() {
    const grid = $('#menu-grid'); grid.replaceChildren();
    if (!products.length) { const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = 'This hotel has not published menu items yet.'; grid.append(empty); return; }
    products.forEach((product) => {
      const card = document.createElement('article'); card.className = 'menu-item'; card.append(productVisual(product));
      const body = document.createElement('div'); const title = document.createElement('h3'); title.textContent = product.name; const price = document.createElement('div'); price.className = 'price'; price.textContent = money(product.price); const add = document.createElement('button'); add.className = 'btn btn-primary btn-small'; add.textContent = 'Add'; add.addEventListener('click', () => { cart.set(product.id, (cart.get(product.id) || 0) + 1); renderCart(); }); body.append(title, price, add); card.append(body); grid.append(card);
    });
  }
  function renderCart() {
    const lines = $('#cart-lines'); lines.replaceChildren(); let total = 0; let count = 0;
    cart.forEach((quantity, productId) => { const product = products.find((item) => item.id === productId); if (!product) return; total += product.price * quantity; count += quantity; const line = document.createElement('div'); line.className = 'cart-line'; const text = document.createElement('div'); const title = document.createElement('strong'); title.textContent = product.name; const detail = document.createElement('small'); detail.textContent = `${quantity} × ${money(product.price)}`; text.append(title, document.createElement('br'), detail); const controls = document.createElement('div'); const less = document.createElement('button'); less.className = 'btn btn-ghost btn-small'; less.textContent = '−'; less.addEventListener('click', () => { if (quantity <= 1) cart.delete(productId); else cart.set(productId, quantity - 1); renderCart(); }); controls.append(less); line.append(text, controls); lines.append(line); });
    if (!count) lines.append(Object.assign(document.createElement('div'), { className: 'empty', textContent: 'Your basket is empty.' }));
    setText('[data-cart-total]', money(total)); setText('[data-cart-count]', `${count} item${count === 1 ? '' : 's'}`);
  }
  $('#customer-form').addEventListener('submit', async (event) => {
    event.preventDefault(); clearNotice(notice); if (!cart.size) { showNotice(notice, 'Add something to your basket first.'); return; }
    const items = [...cart.entries()].map(([productId, quantity]) => ({ productId, quantity })); const button = $('button[type="submit"]', event.currentTarget); button.disabled = true; button.textContent = 'Sending order…';
    try { const data = await api('orders', { method: 'POST', body: { hotelId: hotel.id, customerName: $('#customer-name').value, tableNo: $('#table-no').value, notes: $('#order-notes').value, items } }); $('#customer-form').hidden = true; $('#success-state').classList.add('show'); setText('[data-order-ref]', data.order.id.replace('order_', '').slice(0, 8).toUpperCase()); }
    catch (error) { showNotice(notice, error.message); button.disabled = false; button.textContent = 'Send order to hotel'; }
  });
}

async function initCustomersPage() {
  const session = getSession(); const key = slugFromQuery() || (session && session.slug); const notice = $('#customers-notice'); if (!key) { showNotice(notice, 'Open this page from a hotel portal or use customers.html?hotel=your-hotel-slug.'); return; }
  let hotel; let orders = []; let filter = 'all';
  async function load() { try { const data = await api(`orders?hotel=${encodeURIComponent(key)}${filter === 'all' ? '' : `&status=${filter}`}`); hotel = data.hotel; orders = data.orders; setText('[data-hotel-name]', hotel.name); setText('[data-hotel-slug]', `/${hotel.slug}`); setText('[data-order-count]', orders.length); setText('[data-unseen-count]', orders.filter((order) => !order.seen).length); render(); } catch (error) { showNotice(notice, error.message); } }
  function render() { const target = $('#customers-list'); target.replaceChildren(); if (!orders.length) { const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = filter === 'all' ? 'No orders for this hotel yet.' : `No ${filter} orders for this hotel.`; target.append(empty); return; } orders.forEach((order) => target.append(orderCard(order))); }
  function orderCard(order) { const card = document.createElement('article'); card.className = `order-card ${order.seen ? '' : 'unseen'}`; const top = document.createElement('div'); top.className = 'order-top'; const heading = document.createElement('div'); const title = document.createElement('h3'); title.textContent = order.customerName; const meta = document.createElement('div'); meta.className = 'order-meta'; meta.textContent = `${order.tableNo ? `Room/table ${order.tableNo} · ` : ''}${formatTime(order.createdAt)}`; heading.append(title, meta); const summary = document.createElement('div'); summary.append(statusBadge(order.status)); const total = document.createElement('div'); total.className = 'order-total'; total.textContent = money(order.total); summary.append(total); top.append(heading, summary); card.append(top); const items = document.createElement('div'); items.className = 'order-items'; order.items.forEach((item) => { const pill = document.createElement('span'); pill.className = 'item-pill'; pill.textContent = `${item.quantity} × ${item.productName}`; items.append(pill); }); card.append(items); const actions = document.createElement('div'); actions.className = 'order-actions'; const seen = document.createElement('button'); seen.className = 'btn btn-soft btn-small'; seen.textContent = order.seen ? 'Mark unseen' : 'Mark seen'; seen.addEventListener('click', () => update(order, { seen: !order.seen })); const select = document.createElement('select'); select.className = 'btn-small'; Object.entries(statusLabels).forEach(([value, label]) => select.add(new Option(label, value, value === order.status, value === order.status))); select.addEventListener('change', () => update(order, { status: select.value })); actions.append(seen, select); card.append(actions); return card; }
  async function update(order, values) { try { await api(`orders/${order.id}`, { method: 'PATCH', body: { hotelId: hotel.id, ...values } }); load(); } catch (error) { showNotice(notice, error.message); } }
  $('#filter').addEventListener('change', (event) => { filter = event.target.value; load(); }); $('#refresh').addEventListener('click', load); await load();
}

if (document.body.dataset.page === 'hotel') initHotelPortal();
if (document.body.dataset.page === 'customer') initCustomerPage();
if (document.body.dataset.page === 'customers') initCustomersPage();

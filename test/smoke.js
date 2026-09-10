// Menuly smoke test — boots the REAL server on a temp DB and exercises the
// whole product over HTTP: auth, venue/category/item CRUD with integer-cent
// prices, the server-rendered public menu (XSS-escaped, 86'd items hidden,
// specials section), QR PNG (decoded with jsQR), table-tent PDF, and the
// duplicate-menu endpoint. Kills ONLY the spawned server child.
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert');
const jsQR = require('jsqr');
const { PNG } = require('pngjs');

const ROOT = path.join(__dirname, '..');
const TEST_PORT = 5395;
const ADMIN_PASSWORD = 'smoke-test-password';
const DB_PATH = path.join(__dirname, 'smoke.db');
const BASE = `http://127.0.0.1:${TEST_PORT}`;

for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

let serverProc = null;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(fn, label, tries = 40, delay = 250) {
  for (let i = 0; i < tries; i++) {
    try {
      const v = await fn();
      if (v) return v;
    } catch { /* retry */ }
    await sleep(delay);
  }
  throw new Error(`Timed out waiting for: ${label}`);
}

let cookie = '';
async function api(pathname, options = {}) {
  const res = await fetch(BASE + pathname, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function getMenuHtml(slug, lang) {
  const q = lang ? `?lang=${lang}` : '';
  const res = await fetch(`${BASE}/m/${slug}${q}`);
  return { status: res.status, html: await res.text(), headers: res.headers };
}

async function main() {
  console.log('1. Booting Menuly on port', TEST_PORT, 'with temp DB');
  const env = {
    ...process.env,
    PORT: String(TEST_PORT),
    ADMIN_PASSWORD,
    DB_PATH,
    BASE_URL: '', // exercise host-derived base URL
    // Empty string (not delete): dotenv won't reload Neon from .env over this
    DATABASE_URL: ''
  };
  serverProc = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  serverProc.stdout.on('data', (d) => process.stdout.write(`   [server] ${d}`));
  serverProc.stderr.on('data', (d) => process.stderr.write(`   [server] ${d}`));

  await waitFor(async () => (await api('/api/health')).data.ok, 'server health');

  console.log('   Auth: wrong password → 401, unauthenticated /api/venues → 401, login → 200');
  const bad = await api('/api/login', { method: 'POST', body: { password: 'wrong' } });
  assert.strictEqual(bad.status, 401, 'wrong password must 401');
  cookie = '';
  const unauth = await api('/api/venues');
  assert.strictEqual(unauth.status, 401, 'admin API must require auth');
  const good = await api('/api/login', { method: 'POST', body: { password: ADMIN_PASSWORD } });
  assert.strictEqual(good.status, 200, 'login must succeed');

  console.log('2. Creating venue → slug auto-generated');
  const venueRes = await api('/api/venues', { method: 'POST', body: { name: "Smoke Café & Grill" } });
  assert.strictEqual(venueRes.status, 201, 'venue create must 201');
  const venue = venueRes.data;
  assert.ok(venue.slug && /^[a-z0-9-]+$/.test(venue.slug), `slug must be url-safe, got "${venue.slug}"`);
  console.log(`   slug: ${venue.slug}`);

  console.log('3. Categories + items with integer-cent prices');
  const cat = (await api(`/api/venues/${venue.id}/categories`, { method: 'POST', body: { name: 'Burgers' } })).data;
  assert.ok(cat.id, 'category created');
  const cat2 = (await api(`/api/venues/${venue.id}/categories`, { method: 'POST', body: { name: 'Drinks' } })).data;

  const itemRes = await api(`/api/categories/${cat.id}/items`, {
    method: 'POST',
    body: {
      name: 'Classic Smash Burger',
      name_fa: 'برگر کلاسیک',
      description: 'Two patties, house sauce',
      description_fa: 'دو عدد پتی با سس مخصوص',
      price_cents: 1250,
      price_fa: 450000,
      tags: ['spicy', 'nonsense-tag'],
      in_stock: true
    }
  });
  assert.strictEqual(itemRes.status, 201, 'item create must 201');
  const item = itemRes.data;
  assert.strictEqual(item.price_cents, 1250, 'price must round-trip as exact integer cents (1250)');
  assert.strictEqual(item.price_fa, 450000, 'FA price must round-trip as تومان integer');
  assert.strictEqual(item.name_fa, 'برگر کلاسیک', 'FA name persisted');
  assert.strictEqual(item.tags_json, '["spicy"]', 'unknown tags must be stripped');

  const lemonade = (await api(`/api/categories/${cat2.id}/items`, {
    method: 'POST',
    body: {
      name: 'Fresh Lemonade',
      name_fa: 'لیموناد تازه',
      price_cents: 450,
      price_fa: 120000,
      tags: ['vegan', 'gf']
    }
  })).data;
  assert.strictEqual(lemonade.price_cents, 450, 'second item cents round-trip');

  console.log('4. Public menu FA/EN + dual currency');
  let page = await getMenuHtml(venue.slug, 'en');
  assert.strictEqual(page.status, 200, 'public menu must 200');
  assert.ok(page.headers.get('content-type').includes('text/html'), 'must be HTML');
  assert.ok(page.html.startsWith('<!doctype html>'), 'must be a complete HTML document');
  assert.ok(page.html.includes('Classic Smash Burger'), 'EN menu must contain item name');
  assert.ok(page.html.includes('$12.50'), 'EN menu must contain formatted price $12.50');
  assert.ok(page.html.includes('Burgers'), 'menu must contain category name');
  assert.ok(page.html.includes('Smoke Café &amp; Grill'), 'venue name rendered (escaped &)');
  assert.ok(page.html.includes('Vegan'), 'dietary tag badge rendered');
  assert.ok(page.html.includes('dir="ltr"'), 'EN menu is LTR');
  assert.ok(page.headers.get('cache-control'), 'cache headers must be set');

  page = await getMenuHtml(venue.slug, 'fa');
  assert.ok(page.html.includes('برگر کلاسیک'), 'FA menu shows Persian name');
  assert.ok(page.html.includes('تومان'), 'FA menu shows تومان currency');
  assert.ok(page.html.includes('dir="rtl"'), 'FA menu is RTL');
  assert.ok(page.html.includes('وگان') || page.html.includes('لیموناد'), 'FA tags/items present');

  console.log('5. 86 an item (in_stock=0) → instantly hidden from the public page');
  const toggled = await api(`/api/items/${item.id}`, { method: 'PUT', body: { in_stock: false } });
  assert.strictEqual(toggled.data.in_stock, 0, 'in_stock toggle persisted');
  page = await getMenuHtml(venue.slug, 'en');
  assert.ok(!page.html.includes('Classic Smash Burger'), '86’d item must disappear from the menu');
  assert.ok(page.html.includes('Fresh Lemonade'), 'other items still visible');
  await api(`/api/items/${item.id}`, { method: 'PUT', body: { in_stock: true } });

  console.log('6. Specials: item marked special + venue toggle → specials section appears');
  await api(`/api/items/${lemonade.id}`, { method: 'PUT', body: { is_special: true } });
  page = await getMenuHtml(venue.slug, 'en');
  assert.ok(!page.html.includes('id="specials"'), 'specials section hidden while venue toggle is off');
  await api(`/api/venues/${venue.id}`, { method: 'PUT', body: { specials_enabled: true } });
  page = await getMenuHtml(venue.slug, 'en');
  assert.ok(page.html.includes('id="specials"'), 'specials section must appear when enabled');
  assert.ok(page.html.includes('Today&#39;s Specials') || page.html.includes("Today's Specials"), 'specials heading rendered (EN)');
  page = await getMenuHtml(venue.slug, 'fa');
  assert.ok(page.html.includes('ویژه‌های امروز'), 'specials heading rendered (FA)');

  console.log('7. XSS: <script> item name renders escaped');
  await api(`/api/categories/${cat.id}/items`, {
    method: 'POST',
    body: { name: '<script>alert(1)</script>', price_cents: 100 }
  });
  page = await getMenuHtml(venue.slug, 'en');
  assert.ok(!page.html.includes('<script>alert'), 'raw <script> must NOT appear in the page');
  assert.ok(page.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'name must render HTML-escaped');

  console.log('8. QR PNG: magic bytes + jsQR-decoded URL contains /m/<slug>');
  const qrRes = await fetch(`${BASE}/api/venues/${venue.id}/qr.png?size=512`, { headers: { Cookie: cookie } });
  assert.strictEqual(qrRes.status, 200, 'qr.png must 200');
  assert.strictEqual(qrRes.headers.get('content-type'), 'image/png');
  const qrBuf = Buffer.from(await qrRes.arrayBuffer());
  assert.ok(qrBuf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])), 'PNG magic bytes (\\x89PNG)');
  const png = PNG.sync.read(qrBuf);
  const decoded = jsQR(new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length), png.width, png.height);
  assert.ok(decoded, 'QR must decode with jsQR');
  assert.ok(decoded.data.includes(`/m/${venue.slug}`), `decoded QR URL "${decoded.data}" must contain /m/${venue.slug}`);
  console.log(`   QR decodes to: ${decoded.data}`);

  console.log('9. Table-tent PDF: %PDF- magic bytes');
  const pdfRes = await fetch(`${BASE}/api/venues/${venue.id}/table-tent.pdf`, { headers: { Cookie: cookie } });
  assert.strictEqual(pdfRes.status, 200, 'table-tent.pdf must 200');
  assert.strictEqual(pdfRes.headers.get('content-type'), 'application/pdf');
  const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
  assert.ok(pdfBuf.subarray(0, 5).toString('ascii') === '%PDF-', 'PDF magic bytes (%PDF-)');
  assert.ok(pdfBuf.length > 2000, 'PDF should embed the QR image (non-trivial size)');

  console.log('10. Multi-location: duplicate menu into a second venue');
  const venue2 = (await api('/api/venues', { method: 'POST', body: { name: 'Smoke Café Uptown' } })).data;
  assert.notStrictEqual(venue2.slug, venue.slug, 'second venue gets a distinct slug');
  const dup = await api(`/api/venues/${venue.id}/duplicate-menu`, {
    method: 'POST',
    body: { target_venue_id: venue2.id }
  });
  assert.strictEqual(dup.status, 200, 'duplicate-menu must 200');
  assert.strictEqual(dup.data.categories.length, 2, 'both categories copied');
  const copiedNames = dup.data.categories.flatMap((c) => c.items.map((i) => i.name));
  assert.ok(copiedNames.includes('Classic Smash Burger'), 'items copied to target venue');
  const copiedBurger = dup.data.categories.flatMap((c) => c.items).find((i) => i.name === 'Classic Smash Burger');
  assert.strictEqual(copiedBurger.price_cents, 1250, 'copied item keeps exact integer cents');
  assert.strictEqual(copiedBurger.price_fa, 450000, 'copied item keeps FA price');
  const page2 = await getMenuHtml(venue2.slug, 'en');
  assert.ok(page2.html.includes('Classic Smash Burger'), 'second venue public page serves the copied menu');

  console.log('11. JSON mirror + unknown slug 404');
  const jsonRes = await fetch(`${BASE}/m/${venue.slug}.json`);
  assert.strictEqual(jsonRes.status, 200, '/m/:slug.json must 200');
  const jsonData = await jsonRes.json();
  assert.strictEqual(jsonData.venue.slug, venue.slug, 'json mirror has venue');
  const missing = await getMenuHtml('definitely-not-a-menu');
  assert.strictEqual(missing.status, 404, 'unknown slug must 404');

  console.log('\n✅ All smoke tests passed');
}

async function cleanup(code) {
  // kill ONLY the child we spawned — never broad-kill node/electron
  if (serverProc && !serverProc.killed) serverProc.kill();
  await sleep(300); // let the child release the DB file handles
  for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { /* windows file lock — harmless */ }
  }
  // uploads dir created next to the temp DB
  try { fs.rmSync(path.join(__dirname, 'uploads'), { recursive: true, force: true }); } catch { /* ok */ }
  process.exit(code);
}

main()
  .then(() => cleanup(0))
  .catch(async (err) => {
    console.error('\n❌ Smoke test failed:', err.message);
    await cleanup(1);
  });

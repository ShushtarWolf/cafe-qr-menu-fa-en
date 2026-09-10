const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

function nativeBindingPath() {
  // Under Electron the Node-ABI binding won't load; use the vendored Electron prebuild.
  if (!process.versions.electron) return null;
  const p = path.join(__dirname, '..', 'vendor', 'better_sqlite3-electron.node');
  return fs.existsSync(p) ? p : null;
}

// URL-safe base62 token (crypto-strong, no ESM dep).
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function genToken(len = 22) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

// "Joe's Café — Downtown" → "joes-cafe-downtown"
function slugify(name) {
  return String(name)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'menu';
}

// Unique slug for a venue: base, base-2, base-3 … falling back to a random token.
function uniqueSlug(db, name) {
  const base = slugify(name);
  const taken = db.prepare('SELECT slug FROM venues WHERE slug = ?');
  if (!taken.get(base)) return base;
  for (let i = 2; i < 50; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.get(candidate)) return candidate;
  }
  return `${base}-${genToken(6).toLowerCase()}`;
}

function tableColumns(db, table) {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
}

function ensureColumn(db, table, column, typeSql) {
  const cols = tableColumns(db, table);
  if (!cols.has(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeSql}`);
  }
}

function migrate(db) {
  // Bilingual + dual-currency columns (safe to re-run)
  ensureColumn(db, 'venues', 'name_fa', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'categories', 'name_fa', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'items', 'name_fa', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'items', 'description_fa', "TEXT NOT NULL DEFAULT ''");
  // FA price in تومان (whole units). EN stays in price_cents (minor units).
  ensureColumn(db, 'items', 'price_fa', 'INTEGER NOT NULL DEFAULT 0');
}

function openDb(dbPath) {
  fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  const nativeBinding = nativeBindingPath();
  const db = new Database(dbPath, nativeBinding ? { nativeBinding } : {});
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS venues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_fa TEXT NOT NULL DEFAULT '',
      slug TEXT NOT NULL UNIQUE,
      branding_json TEXT NOT NULL DEFAULT '{}',   -- { theme, accent, logo_path, tagline, tagline_fa }
      specials_enabled INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venue_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      name_fa TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      name_fa TEXT NOT NULL DEFAULT '',
      description TEXT DEFAULT '',
      description_fa TEXT NOT NULL DEFAULT '',
      price_cents INTEGER NOT NULL DEFAULT 0,
      price_fa INTEGER NOT NULL DEFAULT 0,
      photo_path TEXT,
      tags_json TEXT NOT NULL DEFAULT '[]',       -- subset of ["vegan","gf","spicy"]
      in_stock INTEGER NOT NULL DEFAULT 1,
      is_special INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_categories_venue ON categories(venue_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id, sort_order);
  `);

  migrate(db);

  return db;
}

const DEFAULT_SETTINGS = {
  base_url: '',
  currency_symbol: '$',
  currency_symbol_fa: 'تومان',
  default_lang: 'fa'
};

function getSettings(db) {
  const out = { ...DEFAULT_SETTINGS };
  if (process.env.BASE_URL) out.base_url = process.env.BASE_URL;
  for (const r of db.prepare('SELECT key, value FROM settings').all()) {
    if (r.value !== '' && r.value != null) out[r.key] = r.value;
  }
  if (out.default_lang !== 'en' && out.default_lang !== 'fa') out.default_lang = 'fa';
  return out;
}

function setSettings(db, obj) {
  const stmt = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  const tx = db.transaction((entries) => {
    for (const [k, v] of entries) {
      if (k in DEFAULT_SETTINGS) stmt.run(k, String(v ?? ''));
    }
  });
  tx(Object.entries(obj));
}

module.exports = { openDb, genToken, slugify, uniqueSlug, getSettings, setSettings, DEFAULT_SETTINGS };

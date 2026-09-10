const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// URL-safe base62 token
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function genToken(len = 22) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function slugify(name) {
  return String(name)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'menu';
}

function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

const DEFAULT_SETTINGS = {
  base_url: '',
  currency_symbol: '$',
  currency_symbol_fa: 'تومان',
  default_lang: 'fa'
};

const PG_SCHEMA = `
CREATE TABLE IF NOT EXISTS venues (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_fa TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL UNIQUE,
  branding_json TEXT NOT NULL DEFAULT '{}',
  specials_enabled INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_fa TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS media (
  id SERIAL PRIMARY KEY,
  mime TEXT NOT NULL,
  data BYTEA NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS items (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_fa TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  description_fa TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL DEFAULT 0,
  price_fa INTEGER NOT NULL DEFAULT 0,
  photo_path TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  in_stock INTEGER NOT NULL DEFAULT 1,
  is_special INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_categories_venue ON categories(venue_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id, sort_order);
`;

const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS venues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_fa TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL UNIQUE,
  branding_json TEXT NOT NULL DEFAULT '{}',
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
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mime TEXT NOT NULL,
  data BLOB NOT NULL,
  created_at INTEGER NOT NULL
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
  tags_json TEXT NOT NULL DEFAULT '[]',
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
`;

function createPgDb(pool) {
  return {
    driver: 'pg',
    async exec(sql) {
      await pool.query(sql);
    },
    async get(sql, ...params) {
      const r = await pool.query(toPg(sql), params);
      return r.rows[0] || null;
    },
    async all(sql, ...params) {
      const r = await pool.query(toPg(sql), params);
      return r.rows;
    },
    async run(sql, ...params) {
      const text = toPg(sql);
      // Only serial-id tables — not settings (TEXT PK) or upserts
      if (
        /^\s*INSERT\s+INTO\s+(venues|categories|media|items|sessions)\b/i.test(sql) &&
        !/RETURNING/i.test(sql)
      ) {
        const r = await pool.query(text + ' RETURNING id', params);
        return { lastInsertRowid: r.rows[0]?.id, changes: r.rowCount };
      }
      const r = await pool.query(text, params);
      return { lastInsertRowid: null, changes: r.rowCount };
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const txDb = {
          driver: 'pg',
          async get(sql, ...params) {
            const r = await client.query(toPg(sql), params);
            return r.rows[0] || null;
          },
          async all(sql, ...params) {
            const r = await client.query(toPg(sql), params);
            return r.rows;
          },
          async run(sql, ...params) {
            const text = toPg(sql);
            if (
              /^\s*INSERT\s+INTO\s+(venues|categories|media|items|sessions)\b/i.test(sql) &&
              !/RETURNING/i.test(sql)
            ) {
              const r = await client.query(text + ' RETURNING id', params);
              return { lastInsertRowid: r.rows[0]?.id, changes: r.rowCount };
            }
            const r = await client.query(text, params);
            return { lastInsertRowid: null, changes: r.rowCount };
          }
        };
        const result = await fn(txDb);
        await client.query('COMMIT');
        return result;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    }
  };
}

function createSqliteDb(database) {
  return {
    driver: 'sqlite',
    async exec(sql) {
      database.exec(sql);
    },
    async get(sql, ...params) {
      return database.prepare(sql).get(...params) || null;
    },
    async all(sql, ...params) {
      return database.prepare(sql).all(...params);
    },
    async run(sql, ...params) {
      const info = database.prepare(sql).run(...params);
      return { lastInsertRowid: Number(info.lastInsertRowid), changes: info.changes };
    },
    async transaction(fn) {
      // better-sqlite3 txs are sync; use manual BEGIN for async app handlers
      database.exec('BEGIN');
      try {
        const txDb = {
          driver: 'sqlite',
          async get(sql, ...params) {
            return database.prepare(sql).get(...params) || null;
          },
          async all(sql, ...params) {
            return database.prepare(sql).all(...params);
          },
          async run(sql, ...params) {
            const info = database.prepare(sql).run(...params);
            return { lastInsertRowid: Number(info.lastInsertRowid), changes: info.changes };
          }
        };
        const result = await fn(txDb);
        database.exec('COMMIT');
        return result;
      } catch (e) {
        database.exec('ROLLBACK');
        throw e;
      }
    },
    async close() {
      database.close();
    }
  };
}

async function openDb({ databaseUrl = process.env.DATABASE_URL, dbPath } = {}) {
  if (databaseUrl) {
    const { Pool } = require('pg');
    // Serverless (Vercel): keep pool tiny to avoid exhausting Neon free connections
    const max = process.env.VERCEL ? 1 : 5;
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('sslmode=require') || databaseUrl.includes('neon.tech')
        ? { rejectUnauthorized: false }
        : undefined,
      max,
      idleTimeoutMillis: process.env.VERCEL ? 5000 : 30000,
      connectionTimeoutMillis: 10000
    });
    const db = createPgDb(pool);
    await db.exec(PG_SCHEMA);
    console.log('[db] Postgres connected (Neon/free DB ready)');
    return db;
  }

  if (process.env.VERCEL) {
    throw new Error('SQLite is not available on Vercel — set DATABASE_URL to a Neon Postgres URL');
  }

  // Local / smoke fallback: SQLite
  const Database = require('better-sqlite3');
  const resolved = dbPath || path.join(__dirname, '..', 'data', 'menuly.db');
  fs.mkdirSync(path.dirname(path.resolve(resolved)), { recursive: true });
  let nativeBinding = null;
  if (process.versions.electron) {
    const p = path.join(__dirname, '..', 'vendor', 'better_sqlite3-electron.node');
    if (fs.existsSync(p)) nativeBinding = p;
  }
  const raw = new Database(resolved, nativeBinding ? { nativeBinding } : {});
  raw.pragma('journal_mode = WAL');
  const db = createSqliteDb(raw);
  await db.exec(SQLITE_SCHEMA);
  console.log('[db] SQLite at', resolved);
  return db;
}

async function uniqueSlug(db, name) {
  const base = slugify(name);
  if (!(await db.get('SELECT slug FROM venues WHERE slug = ?', base))) return base;
  for (let i = 2; i < 50; i++) {
    const candidate = `${base}-${i}`;
    if (!(await db.get('SELECT slug FROM venues WHERE slug = ?', candidate))) return candidate;
  }
  return `${base}-${genToken(6).toLowerCase()}`;
}

async function getSettings(db) {
  const out = { ...DEFAULT_SETTINGS };
  if (process.env.BASE_URL) out.base_url = process.env.BASE_URL;
  for (const r of await db.all('SELECT key, value FROM settings')) {
    if (r.value !== '' && r.value != null) out[r.key] = r.value;
  }
  if (out.default_lang !== 'en' && out.default_lang !== 'fa') out.default_lang = 'fa';
  return out;
}

async function setSettingsSafe(db, obj) {
  for (const [k, v] of Object.entries(obj)) {
    if (!(k in DEFAULT_SETTINGS)) continue;
    if (db.driver === 'pg') {
      await db.run(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
        k,
        String(v ?? '')
      );
    } else {
      await db.run(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        k,
        String(v ?? '')
      );
    }
  }
}

module.exports = {
  openDb,
  genToken,
  slugify,
  uniqueSlug,
  getSettings,
  setSettings: setSettingsSafe,
  DEFAULT_SETTINGS
};

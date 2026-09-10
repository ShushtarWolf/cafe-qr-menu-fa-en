const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const { openDb, uniqueSlug, getSettings, setSettings } = require('./db');
const { renderMenuPage } = require('./publicMenu');
const { menuQrPng, tableTentPdf } = require('./qr');

const SESSION_COOKIE = 'menuly_session';
const VALID_TAGS = ['vegan', 'gf', 'spicy'];

function createApp({ dbPath, adminPassword, autologinToken = null, dataDir = null } = {}) {
  const db = openDb(dbPath);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(cookieParser());

  app.locals.db = db;

  const uploadsDir = path.join(dataDir || path.dirname(path.resolve(dbPath)), 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  // ── helpers ────────────────────────────────────────────────────────────────
  const findVenue = db.prepare('SELECT * FROM venues WHERE id = ?');
  const findVenueBySlug = db.prepare('SELECT * FROM venues WHERE slug = ?');
  const findCategory = db.prepare('SELECT * FROM categories WHERE id = ?');
  const findItem = db.prepare('SELECT * FROM items WHERE id = ?');

  function requireAuth(req, res, next) {
    const token = req.cookies[SESSION_COOKIE];
    if (token && db.prepare('SELECT id FROM sessions WHERE token = ?').get(token)) return next();
    res.status(401).json({ error: 'unauthorized' });
  }

  function createSession(res) {
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions (token, created_at) VALUES (?, ?)').run(token, Date.now());
    res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax' });
  }

  function baseUrl(req) {
    const configured = getSettings(db).base_url;
    if (configured) return configured.replace(/\/+$/, '');
    return `${req.protocol}://${req.get('host')}`;
  }

  function sanitizeTags(tags) {
    if (!Array.isArray(tags)) return [];
    return tags.filter((t) => VALID_TAGS.includes(t));
  }

  function menuTree(venueId) {
    const categories = db
      .prepare('SELECT * FROM categories WHERE venue_id = ? ORDER BY sort_order, id')
      .all(venueId);
    const itemsStmt = db.prepare('SELECT * FROM items WHERE category_id = ? ORDER BY sort_order, id');
    return categories.map((c) => ({ ...c, items: itemsStmt.all(c.id) }));
  }

  function publicMenuData(venue) {
    const categories = db
      .prepare('SELECT * FROM categories WHERE venue_id = ? ORDER BY sort_order, id')
      .all(venue.id);
    const itemsStmt = db.prepare(
      'SELECT * FROM items WHERE category_id = ? AND in_stock = 1 ORDER BY sort_order, id'
    );
    const specials = db
      .prepare(`
        SELECT i.* FROM items i
        JOIN categories c ON c.id = i.category_id
        WHERE c.venue_id = ? AND i.is_special = 1 AND i.in_stock = 1
        ORDER BY i.sort_order, i.id
      `)
      .all(venue.id);
    return {
      venue,
      categories: categories.map((c) => ({ ...c, items: itemsStmt.all(c.id) })),
      specials
    };
  }

  // ── public menu (server-rendered, no auth, fast) ───────────────────────────
  app.get('/m/:slug.json', (req, res) => {
    const venue = findVenueBySlug.get(req.params.slug);
    if (!venue) return res.status(404).json({ error: 'not found' });
    const data = publicMenuData(venue);
    res.set('Cache-Control', 'no-cache');
    res.json({
      venue: { name: venue.name, slug: venue.slug, specials_enabled: !!venue.specials_enabled },
      specials: data.specials,
      categories: data.categories
    });
  });

  app.get('/m/:slug', (req, res) => {
    const venue = findVenueBySlug.get(req.params.slug);
    if (!venue) {
      return res
        .status(404)
        .set('Content-Type', 'text/html; charset=utf-8')
        .send('<!doctype html><meta charset="utf-8"><title>Menu not found</title><body style="font-family:sans-serif;background:#0c0a09;color:#fafaf9;display:grid;place-items:center;min-height:100vh"><p>This menu does not exist.</p></body>');
    }
    const settings = getSettings(db);
    const q = String(req.query.lang || '').toLowerCase();
    const lang = q === 'en' || q === 'fa' ? q : settings.default_lang || 'fa';
    const html = renderMenuPage(publicMenuData(venue), {
      lang,
      currencySymbol: settings.currency_symbol || '$',
      currencySymbolFa: settings.currency_symbol_fa || 'تومان',
      menuPath: `/m/${venue.slug}`
    });
    // no-cache (not no-store): instant 86'd-item hides, but conditional reloads stay cheap
    res.set('Cache-Control', 'no-cache');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  });

  // uploaded photos/logos (public — they appear on the public menu)
  app.use('/uploads', express.static(uploadsDir, { maxAge: '7d', immutable: false }));

  // ── auth ───────────────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true, app: 'menuly' }));

  app.post('/api/login', (req, res) => {
    if ((req.body || {}).password !== adminPassword) return res.status(401).json({ error: 'wrong password' });
    createSession(res);
    res.json({ ok: true });
  });

  app.post('/api/logout', (req, res) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    res.clearCookie(SESSION_COOKIE);
    res.json({ ok: true });
  });

  // Desktop mode auto-login (Electron passes a one-shot token).
  app.get('/auth/auto', (req, res) => {
    if (autologinToken && req.query.token === autologinToken) createSession(res);
    res.redirect('/');
  });

  app.get('/api/me', requireAuth, (req, res) => res.json({ ok: true }));

  // ── venues ─────────────────────────────────────────────────────────────────
  function serializeVenue(v) {
    const counts = db
      .prepare(`
        SELECT COUNT(DISTINCT c.id) AS categories, COUNT(i.id) AS items
        FROM categories c LEFT JOIN items i ON i.category_id = c.id
        WHERE c.venue_id = ?
      `)
      .get(v.id);
    let branding = {};
    try { branding = JSON.parse(v.branding_json || '{}'); } catch { /* defaults */ }
    return {
      id: v.id,
      name: v.name,
      name_fa: v.name_fa || '',
      slug: v.slug,
      branding,
      specials_enabled: !!v.specials_enabled,
      created_at: v.created_at,
      category_count: counts.categories,
      item_count: counts.items
    };
  }

  app.get('/api/venues', requireAuth, (req, res) => {
    const rows = db.prepare('SELECT * FROM venues ORDER BY created_at, id').all();
    res.json(rows.map(serializeVenue));
  });

  app.post('/api/venues', requireAuth, (req, res) => {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const name_fa = String(body.name_fa || '').trim();
    if (!name && !name_fa) return res.status(400).json({ error: 'name is required' });
    const displayName = name || name_fa;
    const slug = uniqueSlug(db, displayName);
    const branding = JSON.stringify({
      theme: body.theme === 'light' ? 'light' : 'dark',
      accent: '#f59e0b',
      tagline: '',
      tagline_fa: ''
    });
    const info = db
      .prepare('INSERT INTO venues (name, name_fa, slug, branding_json, specials_enabled, created_at) VALUES (?, ?, ?, ?, 0, ?)')
      .run(displayName, name_fa || displayName, slug, branding, Date.now());
    res.status(201).json(serializeVenue(findVenue.get(info.lastInsertRowid)));
  });

  app.get('/api/venues/:id', requireAuth, (req, res) => {
    const venue = findVenue.get(req.params.id);
    if (!venue) return res.status(404).json({ error: 'not found' });
    res.json({ ...serializeVenue(venue), categories: menuTree(venue.id) });
  });

  app.put('/api/venues/:id', requireAuth, (req, res) => {
    const venue = findVenue.get(req.params.id);
    if (!venue) return res.status(404).json({ error: 'not found' });
    const body = req.body || {};
    const name = body.name !== undefined ? String(body.name).trim() : venue.name;
    const name_fa = body.name_fa !== undefined ? String(body.name_fa).trim() : (venue.name_fa || '');
    if (!name && !name_fa) return res.status(400).json({ error: 'name cannot be empty' });

    let branding = {};
    try { branding = JSON.parse(venue.branding_json || '{}'); } catch { /* defaults */ }
    if (body.branding && typeof body.branding === 'object') {
      const nb = body.branding;
      if (nb.theme === 'light' || nb.theme === 'dark') branding.theme = nb.theme;
      if (typeof nb.accent === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(nb.accent)) branding.accent = nb.accent;
      if (typeof nb.tagline === 'string') branding.tagline = nb.tagline.slice(0, 140);
      if (typeof nb.tagline_fa === 'string') branding.tagline_fa = nb.tagline_fa.slice(0, 140);
    }

    const specials =
      body.specials_enabled !== undefined ? (body.specials_enabled ? 1 : 0) : venue.specials_enabled;

    db.prepare('UPDATE venues SET name = ?, name_fa = ?, branding_json = ?, specials_enabled = ? WHERE id = ?')
      .run(name || name_fa, name_fa || name, JSON.stringify(branding), specials, venue.id);
    res.json({ ...serializeVenue(findVenue.get(venue.id)), categories: menuTree(venue.id) });
  });

  app.delete('/api/venues/:id', requireAuth, (req, res) => {
    const venue = findVenue.get(req.params.id);
    if (!venue) return res.status(404).json({ error: 'not found' });
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM items WHERE category_id IN (SELECT id FROM categories WHERE venue_id = ?)').run(venue.id);
      db.prepare('DELETE FROM categories WHERE venue_id = ?').run(venue.id);
      db.prepare('DELETE FROM venues WHERE id = ?').run(venue.id);
    });
    tx();
    res.json({ ok: true });
  });

  // Multi-location: copy this venue's whole menu into another venue
  // (shared menus = duplicate once, keep editing separately = distinct menus).
  app.post('/api/venues/:id/duplicate-menu', requireAuth, (req, res) => {
    const source = findVenue.get(req.params.id);
    if (!source) return res.status(404).json({ error: 'source venue not found' });
    const target = findVenue.get((req.body || {}).target_venue_id);
    if (!target) return res.status(400).json({ error: 'target_venue_id must be an existing venue' });
    if (target.id === source.id) return res.status(400).json({ error: 'target must be a different venue' });
    const replace = (req.body || {}).replace !== false; // default: replace target menu

    const tx = db.transaction(() => {
      if (replace) {
        db.prepare('DELETE FROM items WHERE category_id IN (SELECT id FROM categories WHERE venue_id = ?)').run(target.id);
        db.prepare('DELETE FROM categories WHERE venue_id = ?').run(target.id);
      }
      const cats = db.prepare('SELECT * FROM categories WHERE venue_id = ? ORDER BY sort_order, id').all(source.id);
      const insCat = db.prepare('INSERT INTO categories (venue_id, name, name_fa, sort_order) VALUES (?, ?, ?, ?)');
      const insItem = db.prepare(`
        INSERT INTO items (category_id, name, name_fa, description, description_fa, price_cents, price_fa, photo_path, tags_json, in_stock, is_special, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const itemsOf = db.prepare('SELECT * FROM items WHERE category_id = ? ORDER BY sort_order, id');
      for (const c of cats) {
        const newCatId = insCat.run(target.id, c.name, c.name_fa || '', c.sort_order).lastInsertRowid;
        for (const i of itemsOf.all(c.id)) {
          insItem.run(
            newCatId,
            i.name,
            i.name_fa || '',
            i.description,
            i.description_fa || '',
            i.price_cents,
            i.price_fa || 0,
            i.photo_path,
            i.tags_json,
            i.in_stock,
            i.is_special,
            i.sort_order
          );
        }
      }
    });
    tx();
    res.json({ ...serializeVenue(findVenue.get(target.id)), categories: menuTree(target.id) });
  });

  // ── categories ─────────────────────────────────────────────────────────────
  app.post('/api/venues/:id/categories', requireAuth, (req, res) => {
    const venue = findVenue.get(req.params.id);
    if (!venue) return res.status(404).json({ error: 'venue not found' });
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const name_fa = String(body.name_fa || '').trim();
    if (!name && !name_fa) return res.status(400).json({ error: 'name is required' });
    const max = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM categories WHERE venue_id = ?').get(venue.id).m;
    const info = db.prepare('INSERT INTO categories (venue_id, name, name_fa, sort_order) VALUES (?, ?, ?, ?)')
      .run(venue.id, name || name_fa, name_fa || name, max + 1);
    res.status(201).json({ ...findCategory.get(info.lastInsertRowid), items: [] });
  });

  app.put('/api/categories/:id', requireAuth, (req, res) => {
    const cat = findCategory.get(req.params.id);
    if (!cat) return res.status(404).json({ error: 'not found' });
    const body = req.body || {};
    const name = body.name !== undefined ? String(body.name).trim() : cat.name;
    const name_fa = body.name_fa !== undefined ? String(body.name_fa).trim() : (cat.name_fa || '');
    if (!name && !name_fa) return res.status(400).json({ error: 'name is required' });
    db.prepare('UPDATE categories SET name = ?, name_fa = ? WHERE id = ?').run(name || name_fa, name_fa || name, cat.id);
    res.json(findCategory.get(cat.id));
  });

  app.delete('/api/categories/:id', requireAuth, (req, res) => {
    const cat = findCategory.get(req.params.id);
    if (!cat) return res.status(404).json({ error: 'not found' });
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM items WHERE category_id = ?').run(cat.id);
      db.prepare('DELETE FROM categories WHERE id = ?').run(cat.id);
    });
    tx();
    res.json({ ok: true });
  });

  // Drag-reorder: body { ids: [catId, catId, ...] } in the new order.
  app.post('/api/venues/:id/categories/reorder', requireAuth, (req, res) => {
    const venue = findVenue.get(req.params.id);
    if (!venue) return res.status(404).json({ error: 'venue not found' });
    const ids = (req.body || {}).ids;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
    const upd = db.prepare('UPDATE categories SET sort_order = ? WHERE id = ? AND venue_id = ?');
    const tx = db.transaction(() => ids.forEach((id, idx) => upd.run(idx, id, venue.id)));
    tx();
    res.json({ ok: true, categories: menuTree(venue.id) });
  });

  // ── items ──────────────────────────────────────────────────────────────────
  function validateItemInput(body, res, existing = {}) {
    const name = body.name !== undefined ? String(body.name).trim() : existing.name;
    const name_fa = body.name_fa !== undefined ? String(body.name_fa).trim() : (existing.name_fa || '');
    if (!name && !name_fa) { res.status(400).json({ error: 'name is required' }); return null; }
    let price_cents = existing.price_cents ?? 0;
    if (body.price_cents !== undefined) {
      price_cents = Math.round(Number(body.price_cents));
      if (!Number.isFinite(price_cents) || price_cents < 0) {
        res.status(400).json({ error: 'price_cents must be a non-negative integer' });
        return null;
      }
    }
    let price_fa = existing.price_fa ?? 0;
    if (body.price_fa !== undefined) {
      price_fa = Math.round(Number(body.price_fa));
      if (!Number.isFinite(price_fa) || price_fa < 0) {
        res.status(400).json({ error: 'price_fa must be a non-negative integer (تومان)' });
        return null;
      }
    }
    let tags_json = existing.tags_json ?? '[]';
    if (body.tags !== undefined) tags_json = JSON.stringify(sanitizeTags(body.tags));
    return {
      name: name || name_fa,
      name_fa: name_fa || name,
      description: body.description !== undefined ? String(body.description).slice(0, 500) : (existing.description || ''),
      description_fa:
        body.description_fa !== undefined
          ? String(body.description_fa).slice(0, 500)
          : (existing.description_fa || ''),
      price_cents,
      price_fa,
      tags_json,
      in_stock: body.in_stock !== undefined ? (body.in_stock ? 1 : 0) : (existing.in_stock ?? 1),
      is_special: body.is_special !== undefined ? (body.is_special ? 1 : 0) : (existing.is_special ?? 0)
    };
  }

  app.post('/api/categories/:id/items', requireAuth, (req, res) => {
    const cat = findCategory.get(req.params.id);
    if (!cat) return res.status(404).json({ error: 'category not found' });
    const v = validateItemInput(req.body || {}, res);
    if (!v) return;
    const max = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM items WHERE category_id = ?').get(cat.id).m;
    const info = db.prepare(`
      INSERT INTO items (category_id, name, name_fa, description, description_fa, price_cents, price_fa, tags_json, in_stock, is_special, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      cat.id,
      v.name,
      v.name_fa,
      v.description,
      v.description_fa,
      v.price_cents,
      v.price_fa,
      v.tags_json,
      v.in_stock,
      v.is_special,
      max + 1
    );
    res.status(201).json(findItem.get(info.lastInsertRowid));
  });

  app.put('/api/items/:id', requireAuth, (req, res) => {
    const item = findItem.get(req.params.id);
    if (!item) return res.status(404).json({ error: 'not found' });
    const v = validateItemInput(req.body || {}, res, item);
    if (!v) return;
    db.prepare(`
      UPDATE items SET name = ?, name_fa = ?, description = ?, description_fa = ?, price_cents = ?, price_fa = ?, tags_json = ?, in_stock = ?, is_special = ?
      WHERE id = ?
    `).run(
      v.name,
      v.name_fa,
      v.description,
      v.description_fa,
      v.price_cents,
      v.price_fa,
      v.tags_json,
      v.in_stock,
      v.is_special,
      item.id
    );
    res.json(findItem.get(item.id));
  });

  app.delete('/api/items/:id', requireAuth, (req, res) => {
    const item = findItem.get(req.params.id);
    if (!item) return res.status(404).json({ error: 'not found' });
    db.prepare('DELETE FROM items WHERE id = ?').run(item.id);
    res.json({ ok: true });
  });

  // Drag-reorder within a category: body { ids: [itemId, ...] } in the new order.
  app.post('/api/categories/:id/items/reorder', requireAuth, (req, res) => {
    const cat = findCategory.get(req.params.id);
    if (!cat) return res.status(404).json({ error: 'category not found' });
    const ids = (req.body || {}).ids;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
    const upd = db.prepare('UPDATE items SET sort_order = ? WHERE id = ? AND category_id = ?');
    const tx = db.transaction(() => ids.forEach((id, idx) => upd.run(idx, id, cat.id)));
    tx();
    res.json({ ok: true, items: db.prepare('SELECT * FROM items WHERE category_id = ? ORDER BY sort_order, id').all(cat.id) });
  });

  // ── photo / logo uploads (multer → data/uploads) ───────────────────────────
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (req, file, cb) => cb(null, /^image\/(png|jpe?g|webp)$/.test(file.mimetype))
  });

  function saveUpload(file, prefix) {
    const ext = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/webp': '.webp' }[file.mimetype] || '.png';
    const filename = `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    fs.writeFileSync(path.join(uploadsDir, filename), file.buffer);
    return `/uploads/${filename}`;
  }

  app.post('/api/items/:id/photo', requireAuth, upload.single('photo'), (req, res) => {
    const item = findItem.get(req.params.id);
    if (!item) return res.status(404).json({ error: 'not found' });
    if (!req.file) return res.status(400).json({ error: 'photo file required (png/jpg/webp, max 8MB)' });
    const photoPath = saveUpload(req.file, `item-${item.id}`);
    if (item.photo_path) {
      try { fs.unlinkSync(path.join(uploadsDir, path.basename(item.photo_path))); } catch { /* already gone */ }
    }
    db.prepare('UPDATE items SET photo_path = ? WHERE id = ?').run(photoPath, item.id);
    res.json(findItem.get(item.id));
  });

  app.delete('/api/items/:id/photo', requireAuth, (req, res) => {
    const item = findItem.get(req.params.id);
    if (!item) return res.status(404).json({ error: 'not found' });
    if (item.photo_path) {
      try { fs.unlinkSync(path.join(uploadsDir, path.basename(item.photo_path))); } catch { /* already gone */ }
      db.prepare('UPDATE items SET photo_path = NULL WHERE id = ?').run(item.id);
    }
    res.json(findItem.get(item.id));
  });

  app.post('/api/venues/:id/logo', requireAuth, upload.single('logo'), (req, res) => {
    const venue = findVenue.get(req.params.id);
    if (!venue) return res.status(404).json({ error: 'not found' });
    if (!req.file) return res.status(400).json({ error: 'logo file required (png/jpg/webp, max 8MB)' });
    let branding = {};
    try { branding = JSON.parse(venue.branding_json || '{}'); } catch { /* defaults */ }
    if (branding.logo_path) {
      try { fs.unlinkSync(path.join(uploadsDir, path.basename(branding.logo_path))); } catch { /* already gone */ }
    }
    branding.logo_path = saveUpload(req.file, `logo-${venue.id}`);
    db.prepare('UPDATE venues SET branding_json = ? WHERE id = ?').run(JSON.stringify(branding), venue.id);
    res.json(serializeVenue(findVenue.get(venue.id)));
  });

  // ── QR + table tent ────────────────────────────────────────────────────────
  app.get('/api/venues/:id/qr.png', requireAuth, async (req, res) => {
    const venue = findVenue.get(req.params.id);
    if (!venue) return res.status(404).json({ error: 'not found' });
    try {
      const size = Math.min(Math.max(Number(req.query.size) || 512, 128), 2048);
      const png = await menuQrPng(`${baseUrl(req)}/m/${venue.slug}`, size);
      res.set('Content-Type', 'image/png');
      res.set('Content-Disposition', `inline; filename="${venue.slug}-qr.png"`);
      res.send(png);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/venues/:id/table-tent.pdf', requireAuth, async (req, res) => {
    const venue = findVenue.get(req.params.id);
    if (!venue) return res.status(404).json({ error: 'not found' });
    try {
      const pdf = await tableTentPdf(venue.name, `${baseUrl(req)}/m/${venue.slug}`);
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `attachment; filename="${venue.slug}-table-tent.pdf"`);
      res.send(pdf);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── settings ───────────────────────────────────────────────────────────────
  app.get('/api/settings', requireAuth, (req, res) => res.json(getSettings(db)));

  app.put('/api/settings', requireAuth, (req, res) => {
    setSettings(db, req.body || {});
    res.json(getSettings(db));
  });

  // ── static admin frontend ──────────────────────────────────────────────────
  const dist = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/m/') || req.path.startsWith('/uploads')) return next();
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  return app;
}

module.exports = { createApp };

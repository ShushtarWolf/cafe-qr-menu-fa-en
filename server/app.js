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

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

async function createApp({
  databaseUrl = process.env.DATABASE_URL,
  dbPath,
  adminPassword,
  autologinToken = null
} = {}) {
  const db = await openDb({ databaseUrl, dbPath });
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(cookieParser());
  app.locals.db = db;

  async function requireAuth(req, res, next) {
    try {
      const token = req.cookies[SESSION_COOKIE];
      if (token && (await db.get('SELECT id FROM sessions WHERE token = ?', token))) return next();
      res.status(401).json({ error: 'unauthorized' });
    } catch (e) {
      next(e);
    }
  }

  async function createSession(res) {
    const token = crypto.randomBytes(32).toString('hex');
    await db.run('INSERT INTO sessions (token, created_at) VALUES (?, ?)', token, Date.now());
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: Boolean(process.env.VERCEL)
    });
  }

  async function baseUrl(req) {
    const configured = (await getSettings(db)).base_url;
    if (configured) return configured.replace(/\/+$/, '');
    return `${req.protocol}://${req.get('host')}`;
  }

  function sanitizeTags(tags) {
    if (!Array.isArray(tags)) return [];
    return tags.filter((t) => VALID_TAGS.includes(t));
  }

  async function menuTree(venueId) {
    const categories = await db.all(
      'SELECT * FROM categories WHERE venue_id = ? ORDER BY sort_order, id',
      venueId
    );
    const out = [];
    for (const c of categories) {
      const items = await db.all(
        'SELECT * FROM items WHERE category_id = ? ORDER BY sort_order, id',
        c.id
      );
      out.push({ ...c, items });
    }
    return out;
  }

  async function publicMenuData(venue) {
    const categories = await db.all(
      'SELECT * FROM categories WHERE venue_id = ? ORDER BY sort_order, id',
      venue.id
    );
    const specials = await db.all(
      `
        SELECT i.* FROM items i
        JOIN categories c ON c.id = i.category_id
        WHERE c.venue_id = ? AND i.is_special = 1 AND i.in_stock = 1
        ORDER BY i.sort_order, i.id
      `,
      venue.id
    );
    const cats = [];
    for (const c of categories) {
      const items = await db.all(
        'SELECT * FROM items WHERE category_id = ? AND in_stock = 1 ORDER BY sort_order, id',
        c.id
      );
      cats.push({ ...c, items });
    }
    return { venue, categories: cats, specials };
  }

  async function serializeVenue(v) {
    const counts = await db.get(
      `
        SELECT COUNT(DISTINCT c.id) AS categories, COUNT(i.id) AS items
        FROM categories c LEFT JOIN items i ON i.category_id = c.id
        WHERE c.venue_id = ?
      `,
      v.id
    );
    let branding = {};
    try {
      branding = JSON.parse(v.branding_json || '{}');
    } catch {
      /* defaults */
    }
    return {
      id: v.id,
      name: v.name,
      name_fa: v.name_fa || '',
      slug: v.slug,
      branding,
      specials_enabled: !!v.specials_enabled,
      created_at: Number(v.created_at),
      category_count: Number(counts?.categories || 0),
      item_count: Number(counts?.items || 0)
    };
  }

  async function saveMedia(file) {
    const info = await db.run(
      'INSERT INTO media (mime, data, created_at) VALUES (?, ?, ?)',
      file.mimetype,
      file.buffer,
      Date.now()
    );
    return `/media/${info.lastInsertRowid}`;
  }

  async function deleteMediaPath(photoPath) {
    if (!photoPath || !String(photoPath).startsWith('/media/')) return;
    const id = Number(String(photoPath).slice('/media/'.length));
    if (Number.isFinite(id)) await db.run('DELETE FROM media WHERE id = ?', id);
  }

  // ── public menu ────────────────────────────────────────────────────────────
  app.get(
    '/m/:slug.json',
    asyncHandler(async (req, res) => {
      const venue = await db.get('SELECT * FROM venues WHERE slug = ?', req.params.slug);
      if (!venue) return res.status(404).json({ error: 'not found' });
      const data = await publicMenuData(venue);
      res.set('Cache-Control', 'no-cache');
      res.json({
        venue: { name: venue.name, slug: venue.slug, specials_enabled: !!venue.specials_enabled },
        specials: data.specials,
        categories: data.categories
      });
    })
  );

  app.get(
    '/m/:slug',
    asyncHandler(async (req, res) => {
      const venue = await db.get('SELECT * FROM venues WHERE slug = ?', req.params.slug);
      if (!venue) {
        return res
          .status(404)
          .set('Content-Type', 'text/html; charset=utf-8')
          .send(
            '<!doctype html><meta charset="utf-8"><title>Menu not found</title><body style="font-family:sans-serif;background:#0c0a09;color:#fafaf9;display:grid;place-items:center;min-height:100vh"><p>This menu does not exist.</p></body>'
          );
      }
      const settings = await getSettings(db);
      const q = String(req.query.lang || '').toLowerCase();
      const lang = q === 'en' || q === 'fa' ? q : settings.default_lang || 'fa';
      const html = renderMenuPage(await publicMenuData(venue), {
        lang,
        currencySymbol: settings.currency_symbol || '$',
        currencySymbolFa: settings.currency_symbol_fa || 'تومان',
        menuPath: `/m/${venue.slug}`
      });
      res.set('Cache-Control', 'no-cache');
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    })
  );

  // Photos stored in DB (works on Render Free — no disk)
  app.get(
    '/media/:id',
    asyncHandler(async (req, res) => {
      const row = await db.get('SELECT mime, data FROM media WHERE id = ?', req.params.id);
      if (!row) return res.status(404).end();
      const buf = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
      res.set('Content-Type', row.mime || 'application/octet-stream');
      res.set('Cache-Control', 'public, max-age=604800');
      res.send(buf);
    })
  );

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) =>
    res.json({ ok: true, app: 'cafe-qr-menu', db: db.driver })
  );

  app.post(
    '/api/login',
    asyncHandler(async (req, res) => {
      if ((req.body || {}).password !== adminPassword) {
        return res.status(401).json({ error: 'wrong password' });
      }
      await createSession(res);
      res.json({ ok: true });
    })
  );

  app.post(
    '/api/logout',
    asyncHandler(async (req, res) => {
      const token = req.cookies[SESSION_COOKIE];
      if (token) await db.run('DELETE FROM sessions WHERE token = ?', token);
      res.clearCookie(SESSION_COOKIE);
      res.json({ ok: true });
    })
  );

  app.get(
    '/auth/auto',
    asyncHandler(async (req, res) => {
      if (autologinToken && req.query.token === autologinToken) await createSession(res);
      res.redirect('/');
    })
  );

  app.get('/api/me', requireAuth, (req, res) => res.json({ ok: true }));

  // ── venues ─────────────────────────────────────────────────────────────────
  app.get(
    '/api/venues',
    requireAuth,
    asyncHandler(async (req, res) => {
      const rows = await db.all('SELECT * FROM venues ORDER BY created_at, id');
      res.json(await Promise.all(rows.map(serializeVenue)));
    })
  );

  app.post(
    '/api/venues',
    requireAuth,
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const name = String(body.name || '').trim();
      const name_fa = String(body.name_fa || '').trim();
      if (!name && !name_fa) return res.status(400).json({ error: 'name is required' });
      const displayName = name || name_fa;
      const slug = await uniqueSlug(db, displayName);
      const branding = JSON.stringify({
        theme: body.theme === 'light' ? 'light' : 'dark',
        accent: '#f59e0b',
        tagline: '',
        tagline_fa: ''
      });
      const info = await db.run(
        'INSERT INTO venues (name, name_fa, slug, branding_json, specials_enabled, created_at) VALUES (?, ?, ?, ?, 0, ?)',
        displayName,
        name_fa || displayName,
        slug,
        branding,
        Date.now()
      );
      const venue = await db.get('SELECT * FROM venues WHERE id = ?', info.lastInsertRowid);
      res.status(201).json(await serializeVenue(venue));
    })
  );

  app.get(
    '/api/venues/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const venue = await db.get('SELECT * FROM venues WHERE id = ?', req.params.id);
      if (!venue) return res.status(404).json({ error: 'not found' });
      res.json({ ...(await serializeVenue(venue)), categories: await menuTree(venue.id) });
    })
  );

  app.put(
    '/api/venues/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const venue = await db.get('SELECT * FROM venues WHERE id = ?', req.params.id);
      if (!venue) return res.status(404).json({ error: 'not found' });
      const body = req.body || {};
      const name = body.name !== undefined ? String(body.name).trim() : venue.name;
      const name_fa =
        body.name_fa !== undefined ? String(body.name_fa).trim() : venue.name_fa || '';
      if (!name && !name_fa) return res.status(400).json({ error: 'name cannot be empty' });

      let branding = {};
      try {
        branding = JSON.parse(venue.branding_json || '{}');
      } catch {
        /* defaults */
      }
      if (body.branding && typeof body.branding === 'object') {
        const nb = body.branding;
        if (nb.theme === 'light' || nb.theme === 'dark') branding.theme = nb.theme;
        if (typeof nb.accent === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(nb.accent)) {
          branding.accent = nb.accent;
        }
        if (typeof nb.tagline === 'string') branding.tagline = nb.tagline.slice(0, 140);
        if (typeof nb.tagline_fa === 'string') branding.tagline_fa = nb.tagline_fa.slice(0, 140);
      }

      const specials =
        body.specials_enabled !== undefined
          ? body.specials_enabled
            ? 1
            : 0
          : venue.specials_enabled;

      await db.run(
        'UPDATE venues SET name = ?, name_fa = ?, branding_json = ?, specials_enabled = ? WHERE id = ?',
        name || name_fa,
        name_fa || name,
        JSON.stringify(branding),
        specials,
        venue.id
      );
      const updated = await db.get('SELECT * FROM venues WHERE id = ?', venue.id);
      res.json({ ...(await serializeVenue(updated)), categories: await menuTree(venue.id) });
    })
  );

  app.delete(
    '/api/venues/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const venue = await db.get('SELECT * FROM venues WHERE id = ?', req.params.id);
      if (!venue) return res.status(404).json({ error: 'not found' });
      await db.transaction(async (tx) => {
        await tx.run(
          'DELETE FROM items WHERE category_id IN (SELECT id FROM categories WHERE venue_id = ?)',
          venue.id
        );
        await tx.run('DELETE FROM categories WHERE venue_id = ?', venue.id);
        await tx.run('DELETE FROM venues WHERE id = ?', venue.id);
      });
      res.json({ ok: true });
    })
  );

  app.post(
    '/api/venues/:id/duplicate-menu',
    requireAuth,
    asyncHandler(async (req, res) => {
      const source = await db.get('SELECT * FROM venues WHERE id = ?', req.params.id);
      if (!source) return res.status(404).json({ error: 'source venue not found' });
      const target = await db.get(
        'SELECT * FROM venues WHERE id = ?',
        (req.body || {}).target_venue_id
      );
      if (!target) return res.status(400).json({ error: 'target_venue_id must be an existing venue' });
      if (target.id === source.id) {
        return res.status(400).json({ error: 'target must be a different venue' });
      }
      const replace = (req.body || {}).replace !== false;

      await db.transaction(async (tx) => {
        if (replace) {
          await tx.run(
            'DELETE FROM items WHERE category_id IN (SELECT id FROM categories WHERE venue_id = ?)',
            target.id
          );
          await tx.run('DELETE FROM categories WHERE venue_id = ?', target.id);
        }
        const cats = await tx.all(
          'SELECT * FROM categories WHERE venue_id = ? ORDER BY sort_order, id',
          source.id
        );
        for (const c of cats) {
          const newCat = await tx.run(
            'INSERT INTO categories (venue_id, name, name_fa, sort_order) VALUES (?, ?, ?, ?)',
            target.id,
            c.name,
            c.name_fa || '',
            c.sort_order
          );
          const items = await tx.all(
            'SELECT * FROM items WHERE category_id = ? ORDER BY sort_order, id',
            c.id
          );
          for (const i of items) {
            await tx.run(
              `INSERT INTO items (category_id, name, name_fa, description, description_fa, price_cents, price_fa, photo_path, tags_json, in_stock, is_special, sort_order)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              newCat.lastInsertRowid,
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

      const updated = await db.get('SELECT * FROM venues WHERE id = ?', target.id);
      res.json({ ...(await serializeVenue(updated)), categories: await menuTree(target.id) });
    })
  );

  // ── categories ─────────────────────────────────────────────────────────────
  app.post(
    '/api/venues/:id/categories',
    requireAuth,
    asyncHandler(async (req, res) => {
      const venue = await db.get('SELECT * FROM venues WHERE id = ?', req.params.id);
      if (!venue) return res.status(404).json({ error: 'venue not found' });
      const body = req.body || {};
      const name = String(body.name || '').trim();
      const name_fa = String(body.name_fa || '').trim();
      if (!name && !name_fa) return res.status(400).json({ error: 'name is required' });
      const maxRow = await db.get(
        'SELECT COALESCE(MAX(sort_order), -1) AS m FROM categories WHERE venue_id = ?',
        venue.id
      );
      const info = await db.run(
        'INSERT INTO categories (venue_id, name, name_fa, sort_order) VALUES (?, ?, ?, ?)',
        venue.id,
        name || name_fa,
        name_fa || name,
        Number(maxRow.m) + 1
      );
      const cat = await db.get('SELECT * FROM categories WHERE id = ?', info.lastInsertRowid);
      res.status(201).json({ ...cat, items: [] });
    })
  );

  app.put(
    '/api/categories/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const cat = await db.get('SELECT * FROM categories WHERE id = ?', req.params.id);
      if (!cat) return res.status(404).json({ error: 'not found' });
      const body = req.body || {};
      const name = body.name !== undefined ? String(body.name).trim() : cat.name;
      const name_fa =
        body.name_fa !== undefined ? String(body.name_fa).trim() : cat.name_fa || '';
      if (!name && !name_fa) return res.status(400).json({ error: 'name is required' });
      await db.run(
        'UPDATE categories SET name = ?, name_fa = ? WHERE id = ?',
        name || name_fa,
        name_fa || name,
        cat.id
      );
      res.json(await db.get('SELECT * FROM categories WHERE id = ?', cat.id));
    })
  );

  app.delete(
    '/api/categories/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const cat = await db.get('SELECT * FROM categories WHERE id = ?', req.params.id);
      if (!cat) return res.status(404).json({ error: 'not found' });
      await db.transaction(async (tx) => {
        await tx.run('DELETE FROM items WHERE category_id = ?', cat.id);
        await tx.run('DELETE FROM categories WHERE id = ?', cat.id);
      });
      res.json({ ok: true });
    })
  );

  app.post(
    '/api/venues/:id/categories/reorder',
    requireAuth,
    asyncHandler(async (req, res) => {
      const venue = await db.get('SELECT * FROM venues WHERE id = ?', req.params.id);
      if (!venue) return res.status(404).json({ error: 'venue not found' });
      const ids = (req.body || {}).ids;
      if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
      await db.transaction(async (tx) => {
        for (let idx = 0; idx < ids.length; idx++) {
          await tx.run(
            'UPDATE categories SET sort_order = ? WHERE id = ? AND venue_id = ?',
            idx,
            ids[idx],
            venue.id
          );
        }
      });
      res.json({ ok: true, categories: await menuTree(venue.id) });
    })
  );

  // ── items ──────────────────────────────────────────────────────────────────
  function validateItemInput(body, res, existing = {}) {
    const name = body.name !== undefined ? String(body.name).trim() : existing.name;
    const name_fa =
      body.name_fa !== undefined ? String(body.name_fa).trim() : existing.name_fa || '';
    if (!name && !name_fa) {
      res.status(400).json({ error: 'name is required' });
      return null;
    }
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
      description:
        body.description !== undefined
          ? String(body.description).slice(0, 500)
          : existing.description || '',
      description_fa:
        body.description_fa !== undefined
          ? String(body.description_fa).slice(0, 500)
          : existing.description_fa || '',
      price_cents,
      price_fa,
      tags_json,
      in_stock: body.in_stock !== undefined ? (body.in_stock ? 1 : 0) : (existing.in_stock ?? 1),
      is_special:
        body.is_special !== undefined ? (body.is_special ? 1 : 0) : (existing.is_special ?? 0)
    };
  }

  app.post(
    '/api/categories/:id/items',
    requireAuth,
    asyncHandler(async (req, res) => {
      const cat = await db.get('SELECT * FROM categories WHERE id = ?', req.params.id);
      if (!cat) return res.status(404).json({ error: 'category not found' });
      const v = validateItemInput(req.body || {}, res);
      if (!v) return;
      const maxRow = await db.get(
        'SELECT COALESCE(MAX(sort_order), -1) AS m FROM items WHERE category_id = ?',
        cat.id
      );
      const info = await db.run(
        `INSERT INTO items (category_id, name, name_fa, description, description_fa, price_cents, price_fa, tags_json, in_stock, is_special, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        Number(maxRow.m) + 1
      );
      res.status(201).json(await db.get('SELECT * FROM items WHERE id = ?', info.lastInsertRowid));
    })
  );

  app.put(
    '/api/items/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const item = await db.get('SELECT * FROM items WHERE id = ?', req.params.id);
      if (!item) return res.status(404).json({ error: 'not found' });
      const v = validateItemInput(req.body || {}, res, item);
      if (!v) return;
      await db.run(
        `UPDATE items SET name = ?, name_fa = ?, description = ?, description_fa = ?, price_cents = ?, price_fa = ?, tags_json = ?, in_stock = ?, is_special = ?
         WHERE id = ?`,
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
      res.json(await db.get('SELECT * FROM items WHERE id = ?', item.id));
    })
  );

  app.delete(
    '/api/items/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const item = await db.get('SELECT * FROM items WHERE id = ?', req.params.id);
      if (!item) return res.status(404).json({ error: 'not found' });
      await deleteMediaPath(item.photo_path);
      await db.run('DELETE FROM items WHERE id = ?', item.id);
      res.json({ ok: true });
    })
  );

  app.post(
    '/api/categories/:id/items/reorder',
    requireAuth,
    asyncHandler(async (req, res) => {
      const cat = await db.get('SELECT * FROM categories WHERE id = ?', req.params.id);
      if (!cat) return res.status(404).json({ error: 'category not found' });
      const ids = (req.body || {}).ids;
      if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
      await db.transaction(async (tx) => {
        for (let idx = 0; idx < ids.length; idx++) {
          await tx.run(
            'UPDATE items SET sort_order = ? WHERE id = ? AND category_id = ?',
            idx,
            ids[idx],
            cat.id
          );
        }
      });
      res.json({
        ok: true,
        items: await db.all(
          'SELECT * FROM items WHERE category_id = ? ORDER BY sort_order, id',
          cat.id
        )
      });
    })
  );

  // ── photo / logo → DB media ────────────────────────────────────────────────
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => cb(null, /^image\/(png|jpe?g|webp)$/.test(file.mimetype))
  });

  app.post(
    '/api/items/:id/photo',
    requireAuth,
    upload.single('photo'),
    asyncHandler(async (req, res) => {
      const item = await db.get('SELECT * FROM items WHERE id = ?', req.params.id);
      if (!item) return res.status(404).json({ error: 'not found' });
      if (!req.file) {
        return res.status(400).json({ error: 'photo file required (png/jpg/webp, max 2MB)' });
      }
      await deleteMediaPath(item.photo_path);
      const photoPath = await saveMedia(req.file);
      await db.run('UPDATE items SET photo_path = ? WHERE id = ?', photoPath, item.id);
      res.json(await db.get('SELECT * FROM items WHERE id = ?', item.id));
    })
  );

  app.delete(
    '/api/items/:id/photo',
    requireAuth,
    asyncHandler(async (req, res) => {
      const item = await db.get('SELECT * FROM items WHERE id = ?', req.params.id);
      if (!item) return res.status(404).json({ error: 'not found' });
      await deleteMediaPath(item.photo_path);
      await db.run('UPDATE items SET photo_path = NULL WHERE id = ?', item.id);
      res.json(await db.get('SELECT * FROM items WHERE id = ?', item.id));
    })
  );

  app.post(
    '/api/venues/:id/logo',
    requireAuth,
    upload.single('logo'),
    asyncHandler(async (req, res) => {
      const venue = await db.get('SELECT * FROM venues WHERE id = ?', req.params.id);
      if (!venue) return res.status(404).json({ error: 'not found' });
      if (!req.file) {
        return res.status(400).json({ error: 'logo file required (png/jpg/webp, max 2MB)' });
      }
      let branding = {};
      try {
        branding = JSON.parse(venue.branding_json || '{}');
      } catch {
        /* defaults */
      }
      await deleteMediaPath(branding.logo_path);
      branding.logo_path = await saveMedia(req.file);
      await db.run(
        'UPDATE venues SET branding_json = ? WHERE id = ?',
        JSON.stringify(branding),
        venue.id
      );
      res.json(await serializeVenue(await db.get('SELECT * FROM venues WHERE id = ?', venue.id)));
    })
  );

  // ── QR + table tent ────────────────────────────────────────────────────────
  app.get(
    '/api/venues/:id/qr.png',
    requireAuth,
    asyncHandler(async (req, res) => {
      const venue = await db.get('SELECT * FROM venues WHERE id = ?', req.params.id);
      if (!venue) return res.status(404).json({ error: 'not found' });
      const size = Math.min(Math.max(Number(req.query.size) || 512, 128), 2048);
      const png = await menuQrPng(`${await baseUrl(req)}/m/${venue.slug}`, size);
      res.set('Content-Type', 'image/png');
      res.set('Content-Disposition', `inline; filename="${venue.slug}-qr.png"`);
      res.send(png);
    })
  );

  app.get(
    '/api/venues/:id/table-tent.pdf',
    requireAuth,
    asyncHandler(async (req, res) => {
      const venue = await db.get('SELECT * FROM venues WHERE id = ?', req.params.id);
      if (!venue) return res.status(404).json({ error: 'not found' });
      const pdf = await tableTentPdf(venue.name, `${await baseUrl(req)}/m/${venue.slug}`);
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `attachment; filename="${venue.slug}-table-tent.pdf"`);
      res.send(pdf);
    })
  );

  app.get(
    '/api/settings',
    requireAuth,
    asyncHandler(async (req, res) => res.json(await getSettings(db)))
  );

  app.put(
    '/api/settings',
    requireAuth,
    asyncHandler(async (req, res) => {
      await setSettings(db, req.body || {});
      res.json(await getSettings(db));
    })
  );

  // Local / Docker: serve Vite build. On Vercel, express.static is ignored —
  // assets come from /public via the CDN (see vercel.json buildCommand).
  const staticRoots = [
    path.join(__dirname, '..', 'public'),
    path.join(__dirname, '..', 'dist')
  ];
  const staticRoot = staticRoots.find((p) => fs.existsSync(p));
  if (staticRoot && !process.env.VERCEL) {
    app.use(express.static(staticRoot));
    app.get('*', (req, res, next) => {
      if (
        req.path.startsWith('/api') ||
        req.path.startsWith('/m/') ||
        req.path.startsWith('/media/')
      ) {
        return next();
      }
      res.sendFile(path.join(staticRoot, 'index.html'));
    });
  }

  app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: err.message || 'server error' });
  });

  return app;
}

module.exports = { createApp };

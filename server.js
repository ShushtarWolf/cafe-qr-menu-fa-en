/**
 * Vercel Express entry (also works locally: `node server.js`).
 * Local Docker / npm start still use server/index.js.
 */
require('dotenv').config();
const express = require('express');
const path = require('path');
const { createApp } = require('./server/app');
const { resolveStaticRoot, isStaticPath, sendIndex } = require('./server/static');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const staticRoot = resolveStaticRoot(__dirname);

let appPromise;

function getApp() {
  if (!appPromise) {
    if (process.env.VERCEL && !process.env.DATABASE_URL) {
      appPromise = Promise.reject(
        new Error('DATABASE_URL is required on Vercel — use a Neon pooled connection string')
      );
    } else {
      appPromise = createApp({
        databaseUrl: process.env.DATABASE_URL,
        dbPath: process.env.DB_PATH || path.join(__dirname, 'data', 'menuly.db'),
        adminPassword: ADMIN_PASSWORD,
        skipStatic: true
      });
    }
  }
  return appPromise;
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

// Serve the admin shell without waiting for Neon — fixes black/blank cold starts.
app.use((req, res, next) => {
  if (!staticRoot || !isStaticPath(req.path)) return next();
  if (req.path.startsWith('/assets/')) {
    const file = path.normalize(path.join(staticRoot, req.path));
    if (!file.startsWith(staticRoot)) return res.status(400).end();
    return res.sendFile(file, (err) => (err ? next(err) : undefined));
  }
  return sendIndex(res, staticRoot);
});

app.use((req, res, next) => {
  getApp()
    .then((real) => real(req, res, next))
    .catch(next);
});

app.use((err, req, res, _next) => {
  console.error('[server]', err);
  if (res.headersSent) return;
  res.status(500).json({ error: err.message || 'server error' });
});

module.exports = app;

if (require.main === module) {
  const PORT = Number(process.env.PORT) || 5360;
  getApp()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Cafe QR menu listening on http://localhost:${PORT}`);
        if (process.env.DATABASE_URL) console.log('Using Postgres (DATABASE_URL)');
        else console.log('Using local SQLite');
      });
    })
    .catch((err) => {
      console.error('Failed to start:', err);
      process.exit(1);
    });
}

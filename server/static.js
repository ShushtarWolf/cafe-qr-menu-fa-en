/**
 * Serve the Vite admin UI without waiting on the database.
 * On Vercel cold starts this lets HTML/JS/CSS paint while Neon wakes up.
 */
const path = require('path');
const fs = require('fs');
const express = require('express');

function resolveStaticRoot(baseDir = path.join(__dirname, '..')) {
  const roots = [path.join(baseDir, 'public'), path.join(baseDir, 'dist')];
  return roots.find((p) => fs.existsSync(path.join(p, 'index.html'))) || null;
}

function isStaticPath(pathname) {
  return (
    pathname === '/' ||
    pathname === '/index.html' ||
    pathname.startsWith('/assets/')
  );
}

function sendIndex(res, staticRoot) {
  res.sendFile(path.join(staticRoot, 'index.html'));
}

function mountStatic(app, staticRoot) {
  if (!staticRoot) return;

  if (!process.env.VERCEL) {
    app.use(express.static(staticRoot));
  } else {
    app.get(/^\/assets\/.+/, (req, res, next) => {
      const file = path.normalize(path.join(staticRoot, req.path));
      if (!file.startsWith(staticRoot)) return res.status(400).end();
      res.sendFile(file, (err) => (err ? next() : undefined));
    });
  }

  app.get(['/', '/index.html'], (req, res) => {
    sendIndex(res, staticRoot);
  });

  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/m/') ||
      req.path.startsWith('/media/') ||
      req.path.startsWith('/assets/')
    ) {
      return next();
    }
    sendIndex(res, staticRoot);
  });
}

module.exports = { resolveStaticRoot, isStaticPath, mountStatic, sendIndex };

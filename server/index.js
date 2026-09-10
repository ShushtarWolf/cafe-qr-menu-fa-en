require('dotenv').config();
const path = require('path');
const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 5360;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'menuly.db');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

async function main() {
  const app = await createApp({
    databaseUrl: process.env.DATABASE_URL,
    dbPath: DB_PATH,
    adminPassword: ADMIN_PASSWORD
  });

  app.listen(PORT, () => {
    console.log(`Cafe QR menu listening on http://localhost:${PORT}`);
    if (process.env.DATABASE_URL) {
      console.log('Using Postgres (DATABASE_URL)');
    } else {
      console.log('Using local SQLite — set DATABASE_URL for Neon/Render free DB');
    }
    if (ADMIN_PASSWORD === 'admin') {
      console.log('⚠ Using default admin password — set ADMIN_PASSWORD in .env for production.');
    }
  });
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});

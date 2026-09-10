# Cafe QR Menu (FA/EN) — based on Menuly (MIT)

Bilingual FA/EN digital QR menu with dual currency (تومان + USD).  
Forked from [Menuly](https://github.com/bensblueprints/restaurant-menu-qr-mvp).

## Free hosting (Vercel + Neon) — recommended

Needs a free **Neon** Postgres DB (Vercel has no persistent disk / SQLite).

### 1. Neon database

1. [console.neon.tech](https://console.neon.tech) → create project  
2. Copy the **pooled** connection string (`…-pooler…?sslmode=require`)

### 2. Deploy on Vercel

1. [vercel.com/new](https://vercel.com/new) → import `cafe-qr-menu-fa-en`  
2. Framework: **Express** (auto if `server.js` / `vercel.json` present)  
3. Environment variables:
   - `DATABASE_URL` = Neon pooled string  
   - `ADMIN_PASSWORD` = strong password  
   - `BASE_URL` = leave empty → set to `https://YOUR-APP.vercel.app` after first deploy, then redeploy  
4. Deploy

Admin: `https://YOUR-APP.vercel.app/`  
Public menu: `https://YOUR-APP.vercel.app/m/<slug>`

## Alternative: Render + Neon

Same env vars. Web Service build `npm install && npm run build`, start `npm start`, plan Free.  
Render Free may ask for a card to verify the account even at $0/month.

## Local dev

```bash
cp .env.example .env
npm i
npm run build
npm start
```

Without `DATABASE_URL`, it uses local SQLite in `./data/`.

## License

MIT — keep Menuly attribution when redistributing.

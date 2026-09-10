# Cafe QR Menu (FA/EN) — based on Menuly (MIT)

Bilingual FA/EN digital QR menu with dual currency (تومان + USD).  
Forked from [Menuly](https://github.com/bensblueprints/restaurant-menu-qr-mvp).

## Free hosting (Render + Neon)

Render Free has **no disk**, so this app uses:

- **Neon Postgres** (free) via `DATABASE_URL` for menu data  
- **Photos in the database** (`/media/:id`) — no local uploads folder needed  

### 1. Create a free Neon database

1. Sign up at [https://console.neon.tech](https://console.neon.tech) (GitHub login OK)  
2. Create a project → copy the **pooled** connection string  
3. It looks like:  
   `postgresql://…@ep-….region.aws.neon.tech/neondb?sslmode=require`

### 2. Deploy on Render Free

1. New → **Web Service** → GitHub repo `cafe-qr-menu-fa-en`  
2. Build: `npm install && npm run build`  
3. Start: `npm start`  
4. Env vars:
   - `DATABASE_URL` = Neon string  
   - `ADMIN_PASSWORD` = strong password  
   - `BASE_URL` = `https://YOUR-SERVICE.onrender.com` (set after first deploy)

Cold start after sleep is still ~30–60s on Render Free; data will **persist** in Neon.

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

# Cafe QR Menu (FA/EN) — based on Menuly

MIT-licensed digital QR menu for cafés, forked from [Menuly](https://github.com/bensblueprints/restaurant-menu-qr-mvp) (MIT © Ben / bensblueprints).

## What’s added

- **Bilingual menu** — فارسی + English (names, descriptions, categories, venue, taglines)
- **Dual currency** — تومان for FA, USD (or custom) for EN — separate prices per item
- **فارسی admin dashboard** — staff can edit items, prices, photos, and branding in Persian
- **Language toggle** on the public menu (`?lang=fa` / `?lang=en`), RTL for FA

## Quick start

```bash
cp .env.example .env
npm i
npm run build
npm start        # → http://localhost:5360
```

Default admin password: set `ADMIN_PASSWORD` in `.env` (example uses `change-me`).

Public menu: `http://localhost:5360/m/<slug>`  
Admin: `http://localhost:5360/`

## Deploy (important)

This app uses **Express + SQLite**. It needs a **always-on Node process**, not Vercel serverless.

Free/cheap options:

- **Railway** / **Render** / **Fly.io** — Node + persistent disk for `data/`
- **Docker** — `docker compose up -d` (port 5360)

Set `BASE_URL` to your public HTTPS URL so QR codes point correctly.

## Settings

In the admin **تنظیمات**:

- Currency FA (default `تومان`)
- Currency EN (default `$`)
- Default public language (`fa` or `en`)
- Public base URL for QR codes

## License

MIT — includes original Menuly license. Keep attribution when redistributing.

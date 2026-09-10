# Cafe QR Menu (FA/EN)

Open-source digital QR menu for cafés — **based on [Menuly](https://github.com/bensblueprints/restaurant-menu-qr-mvp)** by Ben / bensblueprints (MIT).

This project is **not** a rewrite. We started from Menuly and only extended it for bilingual Persian/English use and dual currency.

## Credit / origin

| | |
|---|---|
| **Original project** | [Menuly — restaurant-menu-qr-mvp](https://github.com/bensblueprints/restaurant-menu-qr-mvp) |
| **Author** | Ben (bensblueprints) |
| **License** | MIT |
| **What we changed** | Farsi (فارسی) + dual currency (see below) |

Full details: [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md)

## What we added (on top of Menuly)

- **Farsi + English** — names, descriptions, categories, venue, taglines; RTL for FA
- **Dual currency** — e.g. تومان for FA and `$` (or custom) for EN; separate prices per item
- **فارسی admin** — edit menu, prices, photos, and branding in Persian
- **Language toggle** on the public menu (`?lang=fa` / `?lang=en`)

Everything else (QR codes, SQLite, Express admin, photos, etc.) comes from Menuly.

## Quick start

```bash
cp .env.example .env
npm i
npm run build
npm start        # → http://localhost:5360
```

Set `ADMIN_PASSWORD` in `.env` (example uses `change-me`).

| | URL |
|---|---|
| Public menu | `http://localhost:5360/m/<slug>` |
| Admin | `http://localhost:5360/` |

## Deploy

Needs an **always-on Node** process (Express + SQLite), not Vercel serverless.

- **Railway** / **Render** / **Fly.io** — Node + persistent disk for `data/`
- **Docker** — `docker compose up -d` (port 5360)

Set `BASE_URL` to your public HTTPS URL so QR codes point correctly.

## Settings (admin → تنظیمات)

- Currency FA (default `تومان`)
- Currency EN (default `$`)
- Default public language (`fa` or `en`)
- Public base URL for QR codes

## License

MIT — same as Menuly. Keep the original copyright and attribution when you redistribute.

See [LICENSE](LICENSE) and [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md).

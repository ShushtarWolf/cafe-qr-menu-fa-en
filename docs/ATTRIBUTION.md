# Attribution

## Upstream: Menuly

This repository is derived from **Menuly** (restaurant menu QR MVP):

- **Repository:** https://github.com/bensblueprints/restaurant-menu-qr-mvp  
- **Author:** Ben (bensblueprints)  
- **License:** MIT  

We did **not** build a new app from scratch. We forked / based this work on Menuly and reused its core: Express server, SQLite storage, QR generation, admin/menu UI structure, photo uploads, and desktop packaging ideas.

## What this fork adds

Only these product features were added on top of Menuly:

1. **Farsi (فارسی)** — bilingual FA/EN content, RTL layout, Persian admin UI, language toggle (`?lang=fa` / `?lang=en`)
2. **Dual currency** — separate prices and currency labels per language (e.g. تومان for FA, `$` for EN)

If you use or redistribute this project, please:

- Keep the MIT license
- Credit **Menuly** / Ben (bensblueprints) as the original
- Optionally note that FA/EN + dual currency were added in this fork

## Copyright notices

- Original Menuly: Copyright (c) Ben (bensblueprints)  
- This fork’s additions: Copyright (c) PS Coffee / contributors  

See the root [LICENSE](../LICENSE) file.

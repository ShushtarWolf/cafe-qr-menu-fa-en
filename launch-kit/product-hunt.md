# Product Hunt Launch — Menuly

## Name
Menuly

## Tagline (60 chars)
QR restaurant menus you own forever — $24, no subscription

## Description (260 chars)
Menuly is a pay-once QR digital menu for restaurants & cafés. Drag-and-drop menu builder, beautiful server-rendered mobile menu page, instant 86'd-item hiding, specials, multi-location support, printable table-tent PDFs. $24 once vs Toast's $29+/mo.

## Full description
QR menu tools charge monthly rent to host a PDF's worth of text and photos. Menuly ends that.

Build your menu in a clean editor — categories, items, photos, dietary tags (vegan / GF / spicy), drag to reorder. Guests scan a QR and get a genuinely fast, phone-first menu page: server-rendered HTML with your branding (dark/light theme, accent color, logo), sticky category navigation, and a ★ specials section you can toggle on for tonight's menu.

Ran out of the salmon? Hit "86 it" and it disappears from every guest's phone instantly. Price change? Two clicks. New location? Add a venue, copy the menu over, print a new table tent — Menuly generates the QR locally and lays out a fold-ready US-Letter table-tent PDF.

Everything runs on your own hardware: SQLite database, local photo storage, no telemetry, no external APIs. Run it as a Windows desktop app or deploy the same code to a $5 VPS with the included Dockerfile.

$24. Once. Own your menu like you own your kitchen.

## Maker first comment
Hey hunters 👋

I built Menuly after watching a café owner friend pay $29/month — every month — for what was literally a hosted webpage with her menu on it. When she wanted to remove a sold-out dish, she had to email support. That's $350+/year to host a PDF's worth of text.

Menuly is the whole thing, pay once: menu builder, branded mobile menu page, QR codes, printable table tents, multi-location support. The public menu page is server-rendered HTML — it loads faster than any menu SaaS I tested, on any phone, because there's no JavaScript bundle at all.

It's MIT-licensed and self-hosted, so your menu data lives in a SQLite file you can back up with a copy-paste. The $24 gets you the 1-click Windows installer and supports development.

Happy to answer anything about the stack (Node/Express/SQLite/React) or the "why one-time pricing" hill I will die on.

## Gallery shots (5)
1. **Hero** — phone mockup showing a branded dark-mode menu page next to a printed table tent with QR code.
2. **Menu builder** — admin dashboard with categories, drag-handles, item photos, price fields, and tag chips.
3. **86 it** — before/after split: item toggled out of stock in admin, gone from the phone menu.
4. **Specials** — the ★ Today's Specials section on the public page with the one-switch toggle in admin.
5. **Multi-location** — venue switcher with three cafés + "Copy menu to…" panel, each with its own QR.

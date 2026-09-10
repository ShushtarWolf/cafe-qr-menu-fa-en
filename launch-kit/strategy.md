# Launch Strategy — Menuly

## Positioning
"QR menu tools charge monthly rent to host a PDF's worth of text and photos." Menuly is the pay-once escape hatch: $24, self-hosted, MIT-licensed, unlimited venues.

## Target communities

- **r/restaurantowners** — no direct link-dropping; answer "how do you do QR menus cheaply?" threads with honest cost math ($29/mo × 12 vs $24 once) and mention Menuly is open source. Mods allow tool mentions when genuinely responsive.
- **r/smallbusiness** — frame as a "stop renting software" story post: the recurring-SaaS audit angle performs well there. Follow the no-self-promo-title rule; put the link in a comment when asked.
- **r/KitchenConfidential** — staff-level pain: the 7:40pm "we're out of the salmon" 86 moment. Culture-first post, tool mentioned in passing; this sub is allergic to ads, so lead with the story.
- **r/selfhosted** — strongest fit: MIT license, SQLite, Docker compose, no telemetry. Post as "I built a self-hosted QR menu server" with the repo link; self-promo of OSS is explicitly welcome on Wednesdays.
- **r/Coffee / r/cafe (owner threads)** — café owners running on razor margins; comparison-table screenshot plays well.

## Hacker News — Show HN draft

**Title:** Show HN: Menuly – self-hosted QR restaurant menus (Express/SQLite, pay-once)

**Post:**
I got tired of watching small restaurant owners pay $29+/month to host what is functionally a webpage with prices on it — and then wait on support tickets to remove a sold-out dish.

Menuly is a self-hosted QR menu server: Node/Express + better-sqlite3 + a React admin. The interesting constraint was the public menu page: it's fully server-rendered HTML with inline critical CSS — no client JS at all — because the target device is a random guest's phone on bad restaurant Wi-Fi. Render is a handful of prepared statements and lands well under 50ms.

Other bits: QR PNGs generated locally with the qrcode package (no external APIs), a fold-ready table-tent PDF built with pdf-lib, integer-cent prices everywhere, and a duplicate-menu endpoint for multi-location setups.

MIT on GitHub; there's a $24 packaged installer for people who don't want to touch a terminal. Happy to discuss the SSR-only choice — I think we massively over-ship JavaScript to devices that just need to read a menu.

## SEO keywords (10)
1. qr code menu maker free
2. digital menu software one time purchase
3. restaurant menu website builder
4. toast menu alternative
5. qr menu for restaurants no subscription
6. self hosted digital menu
7. cafe qr code menu generator
8. printable qr table tent template
9. digital menu board for small restaurant
10. contactless menu without monthly fee

## AppSumo / PitchGround pitch
Menuly gives restaurants and cafés a QR digital menu they actually own: a drag-and-drop builder, a beautiful server-rendered mobile menu page with their branding, one-click 86'ing of sold-out items, toggleable specials, unlimited locations, and printable table-tent PDFs — all self-hosted with zero recurring costs. The category leader charges $29+/month per location for less; Menuly is a single lifetime license, making it a natural "stop the SaaS bleed" deal for your audience of bootstrapped food-service owners. MIT-licensed core builds trust; the packaged installer and updates are the paid layer.

## Pricing math
- Menuly: **$24 one-time**
- Toast QR menu / typical QR-menu SaaS: **$29+/month** (often per location)
- Break-even: **under 1 month** (single location); a 3-location café saves **$1,020+ in year one**.
- Suggested launch price: $24 (anchor $49 "agency" tier with priority support later).

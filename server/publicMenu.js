// Server-rendered public menu page — bilingual FA/EN + dual currency.
// No React bundle: a phone opens /m/:slug and gets complete HTML with inline
// critical CSS, branded colors, sticky category nav, language toggle, and RTL.

const TAG_META = {
  fa: {
    vegan: { label: 'وگان', emoji: '🌱' },
    gf: { label: 'بدون گلوتن', emoji: '🌾' },
    spicy: { label: 'تند', emoji: '🌶️' }
  },
  en: {
    vegan: { label: 'Vegan', emoji: '🌱' },
    gf: { label: 'GF', emoji: '🌾' },
    spicy: { label: 'Spicy', emoji: '🌶️' }
  }
};

const UI = {
  fa: {
    specials: 'ویژه‌های امروز',
    specialsNav: '★ ویژه',
    empty: 'منو به‌زودی آماده می‌شود.',
    footerPrefix: 'منوی',
    langFa: 'فارسی',
    langEn: 'English'
  },
  en: {
    specials: "Today's Specials",
    specialsNav: '★ Specials',
    empty: 'Menu coming soon.',
    footerPrefix: 'Menu by',
    langFa: 'فارسی',
    langEn: 'English'
  }
};

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function moneyEn(cents, symbol = '$') {
  const n = Number(cents) || 0;
  return `${symbol}${(n / 100).toFixed(2)}`;
}

function moneyFa(amount, symbol = 'تومان') {
  const n = Math.round(Number(amount) || 0);
  const formatted = n.toLocaleString('fa-IR');
  return `${formatted} ${symbol}`;
}

function pickText(fa, en, lang) {
  if (lang === 'fa') return (fa && String(fa).trim()) || en || '';
  return (en && String(en).trim()) || fa || '';
}

function parseBranding(venue) {
  let b = {};
  try { b = JSON.parse(venue.branding_json || '{}'); } catch { /* corrupt json → defaults */ }
  const theme = b.theme === 'light' ? 'light' : 'dark';
  // accent must be a safe hex color — never interpolate raw user input into CSS
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(b.accent || '') ? b.accent : '#f59e0b';
  return {
    theme,
    accent,
    logo_path: typeof b.logo_path === 'string' ? b.logo_path : null,
    tagline: typeof b.tagline === 'string' ? b.tagline : '',
    tagline_fa: typeof b.tagline_fa === 'string' ? b.tagline_fa : ''
  };
}

function tagBadges(tagsJson, lang) {
  const meta = TAG_META[lang] || TAG_META.en;
  let tags = [];
  try { tags = JSON.parse(tagsJson || '[]'); } catch { /* ignore */ }
  if (!Array.isArray(tags)) return '';
  return tags
    .filter((t) => meta[t])
    .map((t) => `<span class="tag tag-${esc(t)}">${meta[t].emoji} ${meta[t].label}</span>`)
    .join('');
}

function itemCard(item, lang, currencyEn, currencyFa) {
  const name = pickText(item.name_fa, item.name, lang);
  const desc = pickText(item.description_fa, item.description, lang);
  const price =
    lang === 'fa'
      ? moneyFa(item.price_fa, currencyFa)
      : moneyEn(item.price_cents, currencyEn);
  const photo = item.photo_path
    ? `<img class="photo" src="${esc(item.photo_path)}" alt="${esc(name)}" loading="lazy">`
    : '';
  return `
      <article class="item${item.is_special ? ' special' : ''}">
        ${photo}
        <div class="item-body">
          <div class="item-top">
            <h3>${esc(name)}</h3>
            <span class="price">${esc(price)}</span>
          </div>
          ${desc ? `<p class="desc">${esc(desc)}</p>` : ''}
          ${tagBadges(item.tags_json, lang) ? `<div class="tags">${tagBadges(item.tags_json, lang)}</div>` : ''}
        </div>
      </article>`;
}

// data: { venue, categories: [{...cat, items: [...]}], specials: [...] }
// opts: { lang, currencySymbol, currencySymbolFa, menuPath }
function renderMenuPage(data, opts = {}) {
  const lang = opts.lang === 'en' ? 'en' : 'fa';
  const ui = UI[lang];
  const { venue } = data;
  const b = parseBranding(venue);
  const dark = b.theme === 'dark';
  const currencyEn = opts.currencySymbol || '$';
  const currencyFa = opts.currencySymbolFa || 'تومان';
  const menuPath = opts.menuPath || `/m/${venue.slug}`;

  const categories = data.categories
    .map((c) => ({ ...c, items: c.items.filter((i) => i.in_stock) }))
    .filter((c) => c.items.length > 0);
  const specials = venue.specials_enabled
    ? data.specials.filter((i) => i.in_stock)
    : [];

  const pal = dark
    ? { bg: '#0c0a09', card: '#1c1917', text: '#fafaf9', muted: '#a8a29e', line: '#292524', navbg: 'rgba(12,10,9,.92)' }
    : { bg: '#faf9f7', card: '#ffffff', text: '#1c1917', muted: '#78716c', line: '#e7e5e4', navbg: 'rgba(250,249,247,.92)' };

  const venueName = pickText(venue.name_fa, venue.name, lang);
  const tagline = pickText(b.tagline_fa, b.tagline, lang);

  const navLinks = [
    ...(specials.length ? [`<a href="#specials" class="nav-link nav-special">${ui.specialsNav}</a>`] : []),
    ...categories.map((c) => {
      const catName = pickText(c.name_fa, c.name, lang);
      return `<a href="#cat-${c.id}" class="nav-link">${esc(catName)}</a>`;
    })
  ].join('');

  const specialsSection = specials.length
    ? `
    <section id="specials" class="section specials-section">
      <h2 class="section-title"><span class="star">★</span> ${esc(ui.specials)}</h2>
      ${specials.map((i) => itemCard(i, lang, currencyEn, currencyFa)).join('')}
    </section>`
    : '';

  const categorySections = categories
    .map((c) => {
      const catName = pickText(c.name_fa, c.name, lang);
      return `
    <section id="cat-${c.id}" class="section">
      <h2 class="section-title">${esc(catName)}</h2>
      ${c.items.map((i) => itemCard(i, lang, currencyEn, currencyFa)).join('')}
    </section>`;
    })
    .join('');

  const logo = b.logo_path
    ? `<img class="logo" src="${esc(b.logo_path)}" alt="${esc(venueName)} logo">`
    : '';

  const faUrl = `${menuPath}?lang=fa`;
  const enUrl = `${menuPath}?lang=en`;
  const dir = lang === 'fa' ? 'rtl' : 'ltr';

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="${dark ? 'dark' : 'light'}">
<meta name="theme-color" content="${pal.bg}">
<title>${esc(venueName)} — ${lang === 'fa' ? 'منو' : 'Menu'}</title>
<meta name="description" content="${lang === 'fa' ? 'منوی' : 'Menu for'} ${esc(venueName)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{
  font-family:'Vazirmatn',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  background:${pal.bg};color:${pal.text};line-height:1.5;
  padding-bottom:48px;
}
.lang-bar{
  display:flex;justify-content:center;gap:8px;padding:14px 16px 0;
}
.lang-btn{
  padding:7px 14px;border-radius:999px;font-size:.82rem;font-weight:700;
  text-decoration:none;border:1px solid ${pal.line};color:${pal.muted};background:${pal.card};
}
.lang-btn.active{background:${b.accent};color:#fff;border-color:${b.accent}}
.hero{padding:28px 20px 20px;text-align:center}
.logo{width:72px;height:72px;border-radius:18px;object-fit:cover;margin:0 auto 14px;display:block;box-shadow:0 4px 20px rgba(0,0,0,.25)}
.hero h1{font-size:1.85rem;font-weight:800;letter-spacing:-.02em}
.hero .tagline{color:${pal.muted};margin-top:6px;font-size:.95rem}
.hero .rule{width:44px;height:3px;border-radius:2px;background:${b.accent};margin:16px auto 0}
nav{
  position:sticky;top:0;z-index:10;display:flex;gap:8px;overflow-x:auto;
  padding:12px 16px;background:${pal.navbg};backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
  border-bottom:1px solid ${pal.line};scrollbar-width:none;
}
nav::-webkit-scrollbar{display:none}
.nav-link{
  flex:0 0 auto;padding:8px 14px;border-radius:999px;font-size:.86rem;font-weight:600;
  text-decoration:none;color:${pal.text};background:${pal.card};border:1px solid ${pal.line};
  min-height:36px;display:inline-flex;align-items:center;
}
.nav-link:active{background:${b.accent};color:#fff;border-color:${b.accent}}
.nav-special{color:${b.accent};border-color:${b.accent}}
main{max-width:640px;margin:0 auto;padding:8px 16px 0}
.section{padding-top:26px;scroll-margin-top:64px}
.section-title{font-size:1.15rem;font-weight:800;letter-spacing:.01em;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.section-title .star{color:${b.accent}}
.specials-section .item{border-inline-start:3px solid ${b.accent}}
.item{
  display:flex;gap:12px;background:${pal.card};border:1px solid ${pal.line};
  border-radius:14px;padding:14px;margin-bottom:10px;
}
.photo{width:76px;height:76px;border-radius:10px;object-fit:cover;flex:0 0 auto}
.item-body{flex:1;min-width:0}
.item-top{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.item-top h3{font-size:1rem;font-weight:700}
.price{font-weight:800;color:${b.accent};white-space:nowrap;font-variant-numeric:tabular-nums}
.desc{color:${pal.muted};font-size:.875rem;margin-top:3px}
.tags{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
.tag{
  font-size:.72rem;font-weight:700;padding:3px 8px;border-radius:999px;
  background:${dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)'};color:${pal.muted};
}
footer{text-align:center;color:${pal.muted};font-size:.78rem;padding:34px 16px 0}
footer a{color:inherit}
@media (min-width:520px){.hero h1{font-size:2.2rem}.photo{width:92px;height:92px}}
</style>
</head>
<body>
<div class="lang-bar" role="navigation" aria-label="Language">
  <a class="lang-btn${lang === 'fa' ? ' active' : ''}" href="${esc(faUrl)}" hreflang="fa">${ui.langFa}</a>
  <a class="lang-btn${lang === 'en' ? ' active' : ''}" href="${esc(enUrl)}" hreflang="en">${ui.langEn}</a>
</div>
<header class="hero">
  ${logo}
  <h1>${esc(venueName)}</h1>
  ${tagline ? `<p class="tagline">${esc(tagline)}</p>` : ''}
  <div class="rule"></div>
</header>
${navLinks ? `<nav aria-label="Menu categories">${navLinks}</nav>` : ''}
<main>
${specialsSection}
${categorySections || '<p style="text-align:center;padding:40px 0;color:' + pal.muted + '">' + esc(ui.empty) + '</p>'}
</main>
<footer>${esc(ui.footerPrefix)} ${esc(venueName)}</footer>
</body>
</html>`;
}

module.exports = { renderMenuPage, esc, moneyEn, moneyFa, parseBranding, pickText };

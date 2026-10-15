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
  const hasPrice = lang === 'fa' ? Number(item.price_fa) > 0 : Number(item.price_cents) > 0;
  const price = !hasPrice
    ? ''
    : lang === 'fa'
      ? moneyFa(item.price_fa, currencyFa)
      : moneyEn(item.price_cents, currencyEn);
  const photo = item.photo_path
    ? `<img class="photo" src="${esc(item.photo_path)}" alt="${esc(name)}" loading="lazy" decoding="async">`
    : '';
  return `
      <article class="item reveal${item.is_special ? ' special' : ''}">
        ${photo}
        <div class="item-body">
          <div class="item-top">
            <h3>${esc(name)}</h3>
            ${price ? `<span class="price">${esc(price)}</span>` : ''}
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

  // Court-inspired palette (padel/tennis complex). Branding accent still respected for highlights.
  const accent = b.accent && b.accent.toLowerCase() !== '#f59e0b' ? b.accent : '#d4f53c';
  const pal = dark
    ? { bg: '#0b1f3a', bg2: '#123a6b', card: 'rgba(255,255,255,.06)', cardSolid: '#11294a', text: '#f4f8ff', muted: '#9fb3cf', line: 'rgba(255,255,255,.14)', navbg: 'rgba(11,31,58,.82)' }
    : { bg: '#eef4fb', bg2: '#d7e6f7', card: '#ffffff', cardSolid: '#ffffff', text: '#0b1f3a', muted: '#55708f', line: '#d3e0ef', navbg: 'rgba(238,244,251,.85)' };

  const venueName = pickText(venue.name_fa, venue.name, lang);
  const tagline = pickText(b.tagline_fa, b.tagline, lang);

  const navLinks = [
    ...(specials.length ? [`<a href="#specials" class="nav-link nav-special" data-target="specials">${ui.specialsNav}</a>`] : []),
    ...categories.map((c) => {
      const catName = pickText(c.name_fa, c.name, lang);
      return `<a href="#cat-${c.id}" class="nav-link" data-target="cat-${c.id}">${esc(catName)}</a>`;
    })
  ].join('');

  const specialsSection = specials.length
    ? `
    <section id="specials" class="section specials-section">
      <h2 class="section-title hand fa"><span class="star">★</span> ${esc(ui.specials)}</h2>
      ${specials.map((i) => itemCard(i, lang, currencyEn, currencyFa)).join('')}
    </section>`
    : '';

  const categorySections = categories
    .map((c) => {
      const catName = pickText(c.name_fa, c.name, lang);
      return `
    <section id="cat-${c.id}" class="section">
      <h2 class="section-title hand fa"><span class="ball-dot"></span>${esc(catName)}<span class="count">${c.items.length.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}</span></h2>
      ${c.items.map((i) => itemCard(i, lang, currencyEn, currencyFa)).join('')}
    </section>`;
    })
    .join('');

  const logo = b.logo_path
    ? `<img class="logo" src="${esc(b.logo_path)}" alt="${esc(venueName)} logo">`
    : `<div class="logo logo-fallback" aria-hidden="true">${esc(String(venueName).slice(0, 3))}</div>`;

  const faUrl = `${menuPath}?lang=fa`;
  const enUrl = `${menuPath}?lang=en`;
  const dir = lang === 'fa' ? 'rtl' : 'ltr';
  const introSub = lang === 'fa' ? 'کافه · باشگاه پدل و تنیس' : 'Café · Padel & Tennis Club';

  return `<!doctype html>
<html lang="${lang}" dir="${dir}" class="js-intro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="${dark ? 'dark' : 'light'}">
<meta name="theme-color" content="${pal.bg}">
<title>${esc(venueName)} — ${lang === 'fa' ? 'منو' : 'Menu'}</title>
<meta name="description" content="${lang === 'fa' ? 'منوی' : 'Menu for'} ${esc(venueName)}">
<script>
/* Intro plays on every load (QR scan, reload). Only a language switch skips it, via a one-shot flag. */
(function(){try{if(sessionStorage.getItem('skipIntro')){sessionStorage.removeItem('skipIntro');document.documentElement.classList.remove('js-intro');}}catch(e){}})();
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700;800;900&family=Nunito:wght@600;800;900&family=Luckiest+Guy&family=Lalezar&display=swap" rel="stylesheet">
<style>
:root{--clay:#c8452c;--clay2:#a8361f;--padel:#2f6fb3;--padel2:#245a94;--chalk:#fbf6ea;--border:#7d93a6;--ball:#e9e23a;--ink:#1b1410;--muted:#6b5a4e;--bounce:cubic-bezier(.34,1.56,.64,1);--ease:cubic-bezier(.22,1,.36,1)}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{
  font-family:${lang === 'en' ? "'Nunito'," : ''}'Vazirmatn',-apple-system,'Segoe UI',Roboto,sans-serif;
  color:var(--ink);line-height:1.55;padding:10px 10px 56px;min-height:100vh;-webkit-tap-highlight-color:transparent;
  background-color:var(--border);
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .35 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");
}
.rug{background-color:var(--clay);background-image:inherit;border:5px solid var(--chalk);border-radius:6px 10px 7px 12px;box-shadow:0 0 0 2px rgba(0,0,0,.15);min-height:calc(100vh - 20px);padding-bottom:30px;overflow:hidden}
.hand{font-family:'Luckiest Guy','Lalezar','Vazirmatn',cursive;font-weight:400;letter-spacing:.06em;color:var(--chalk);-webkit-text-stroke:1.5px var(--ink);paint-order:stroke fill;text-shadow:2px 3px 0 var(--ink)}
html[lang=fa] .hand.fa{font-family:'Lalezar','Vazirmatn',cursive;letter-spacing:0}
/* ---------- Intro ---------- */
#intro{display:none}
.js-intro #intro{display:flex;position:fixed;inset:0;z-index:100;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:inherit;background-color:var(--border);transition:opacity .5s var(--ease),transform .6s var(--ease),visibility .6s}
#intro.done{opacity:0;visibility:hidden;transform:scale(1.06)}
.court-svg{width:min(80vw,330px);height:auto;max-height:68vh}
.wob{filter:url(#wobble)}
.ln{stroke:var(--chalk);stroke-width:5;fill:none;stroke-linecap:round}
.ball{animation:rally 2.5s cubic-bezier(.45,.05,.55,.95) forwards}
@keyframes rally{
  0%{transform:translate(120px,62px)} 14%{transform:translate(232px,205px)} 28%{transform:translate(128px,66px)}
  44%{transform:translate(132px,330px)} 58%{transform:translate(200px,493px)} 70%{transform:translate(242px,452px)}
  86%{transform:translate(175px,355px);opacity:1} 100%{transform:translate(150px,300px);opacity:0}}
.pa{animation:swingA .5s ease-in-out 3 alternate}
.pb{animation:swingB .45s ease-in-out .3s 2 alternate}
.pa,.pb{transform-box:fill-box;transform-origin:50% 100%}
@keyframes swingA{to{transform:rotate(-12deg) translateX(4px)}}
@keyframes swingB{to{transform:rotate(12deg) translateX(-4px)}}
.glass{animation:flash .4s ease-out 1.4s 1}
.pc{animation:swingA .25s ease-in-out .9s 2 alternate}
.pd{animation:swingB .25s ease-in-out 1.55s 2 alternate}
.pc,.pd{transform-box:fill-box;transform-origin:50% 100%}
@keyframes flash{50%{stroke:#fff;stroke-width:6}}
.intro-title{display:flex;gap:.12em;font-size:2.6rem;direction:ltr}
.intro-title span{display:inline-block;opacity:0;transform:translateY(20px) scale(.3) rotate(-15deg);animation:letter .45s var(--bounce) forwards;animation-delay:calc(2.3s + var(--i) * 80ms)}
.intro-title span:nth-child(even){--r:6deg}
@keyframes letter{to{opacity:1;transform:rotate(var(--r,-5deg))}}
.js-intro .page{opacity:0;transform:translateY(24px)}
.page{transition:opacity .6s var(--ease),transform .7s var(--bounce)}
.ready .page{opacity:1!important;transform:none!important}
/* ---------- Language switch ---------- */
.lang-bar{display:flex;justify-content:center;padding:16px 16px 0}
.lang-switch{position:relative;display:grid;grid-template-columns:1fr 1fr;padding:4px;border-radius:999px;background:var(--chalk);border:2.5px solid var(--ink);box-shadow:3px 3px 0 var(--ink)}
.lang-switch .thumb{position:absolute;top:3px;bottom:3px;width:calc(50% - 4px);border-radius:999px;background:var(--ball);border:2px solid var(--ink);transition:inset-inline-start .55s var(--bounce);inset-inline-start:3px}
html[lang=en] .lang-switch .thumb{inset-inline-start:50%}
.lang-switch.go-en .thumb{inset-inline-start:50%!important}
.lang-switch.go-fa .thumb{inset-inline-start:3px!important}
.lang-btn{position:relative;z-index:1;min-width:82px;text-align:center;padding:6px 14px;font-size:.86rem;font-weight:800;text-decoration:none;color:var(--muted)}
.lang-btn.active{color:var(--ink)}
/* ---------- Hero ---------- */
.hero{position:relative;padding:22px 20px 30px;text-align:center}
.hero-court{position:absolute;inset:12px 16px 0;width:calc(100% - 32px);height:calc(100% - 12px);pointer-events:none}
.logo{position:relative;z-index:1;width:82px;height:82px;border-radius:50%;object-fit:cover;margin:0 auto 10px;display:grid;place-items:center;border:3px solid var(--ink);box-shadow:3px 4px 0 var(--ink);animation:bob 3s ease-in-out infinite}
.logo-fallback{background:var(--ball);color:var(--ink);font:400 1.5rem 'Luckiest Guy',cursive;padding-top:4px;background-image:radial-gradient(circle at 0 50%,transparent 26px,#fff 27px,#fff 30px,transparent 31px),radial-gradient(circle at 100% 50%,transparent 26px,#fff 27px,#fff 30px,transparent 31px)}
@keyframes bob{50%{transform:translateY(-5px) rotate(4deg)}}
.hero h1{position:relative;z-index:1;font-size:2.5rem;line-height:1.1}
.hero .sub{position:relative;z-index:1;display:inline-block;margin-top:10px;font-size:.88rem;font-weight:700;background:var(--chalk);border:2px solid var(--ink);border-radius:8px 12px 9px 14px;padding:2px 12px;transform:rotate(-1.5deg)}
.net{height:16px;margin:0 6px;background:var(--chalk);background-image:repeating-linear-gradient(45deg,transparent 0 5px,var(--clay2) 5px 7px),repeating-linear-gradient(-45deg,transparent 0 5px,var(--clay2) 5px 7px);border-radius:3px;filter:url(#wobble)}
/* ---------- Tabs ---------- */
nav{position:sticky;top:0;z-index:10;background:var(--clay);background-image:inherit;border-bottom:3px dashed rgba(251,246,234,.6)}
.tabs{position:relative;display:flex;gap:8px;overflow-x:auto;padding:11px 12px;scrollbar-width:none}
.tabs::-webkit-scrollbar{display:none}
.tab-ind{position:absolute;top:11px;height:38px;border-radius:999px;background:var(--ball);border:2.5px solid var(--ink);box-shadow:2px 3px 0 var(--ink);transition:left .55s var(--bounce),width .45s var(--bounce);z-index:0;left:0;width:0}
.nav-link{position:relative;z-index:1;flex:0 0 auto;padding:0 15px;height:38px;border-radius:999px;font-size:.9rem;font-weight:800;text-decoration:none;color:var(--chalk);display:inline-flex;align-items:center;border:2px dashed rgba(251,246,234,.5);transition:color .25s,transform .2s var(--bounce)}
.nav-link.active{color:var(--ink);border-color:transparent}
.nav-link:active{transform:scale(.9) rotate(-3deg)}
/* ---------- Sections: alternate clay / padel blue ---------- */
main{max-width:640px;margin:0 auto;padding:6px 12px 0}
.section{position:relative;margin-top:22px;padding:16px 12px 8px;border:4px solid var(--chalk);border-radius:8px 12px 6px 14px;scroll-margin-top:70px;background:var(--clay2);background-image:inherit}
.section:nth-of-type(even){background-color:var(--padel);box-shadow:inset 0 0 0 3px rgba(190,230,255,.35)}
.section:nth-of-type(even)::before{content:"";position:absolute;inset:-4px;border-radius:inherit;border:3px solid rgba(200,235,255,.55);border-left-width:8px;border-right-width:8px;pointer-events:none}
.section::after{content:"";position:absolute;top:0;bottom:0;left:50%;width:3px;background:rgba(251,246,234,.25);pointer-events:none}
.section-title{position:relative;z-index:1;font-size:1.5rem;line-height:1.2;margin-bottom:12px;display:flex;align-items:center;gap:10px}
.section-title .count{margin-inline-start:auto;font:800 .78rem 'Nunito','Vazirmatn';color:var(--ink);-webkit-text-stroke:0;text-shadow:none;background:var(--ball);border:2px solid var(--ink);border-radius:999px;padding:0 9px;letter-spacing:0}
.ball-dot{width:16px;height:16px;border-radius:50%;background:var(--ball);border:2px solid var(--ink)}
.item{position:relative;z-index:1;display:flex;align-items:center;gap:12px;background:var(--chalk);border:2.5px solid var(--ink);border-radius:12px 16px 11px 18px;padding:8px;margin-bottom:12px;box-shadow:4px 4px 0 var(--ink);transition:transform .25s var(--bounce),box-shadow .2s}
.item:nth-child(even){transform:rotate(.6deg)}
.item:nth-child(odd){transform:rotate(-.5deg)}
.item:active{transform:translate(3px,3px) rotate(0)!important;box-shadow:1px 1px 0 var(--ink)}
.reveal{opacity:0!important;transform:translateY(30px) rotate(-4deg) scale(.9)!important}
.reveal.in{opacity:1!important;transform:none!important;transition:opacity .4s ease var(--d,0ms),transform .6s var(--bounce) var(--d,0ms)}
.reveal.in.settled{transform:rotate(var(--tilt,0))!important}
.photo{width:76px;height:76px;border-radius:10px 14px 9px 12px;object-fit:cover;flex:0 0 auto;border:2px solid var(--ink)}
.item-body{flex:1;min-width:0}
.item-top{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
.item-top h3{font-size:1.05rem;font-weight:800}
.price{font-weight:900;font-size:.85rem;color:var(--ink);background:var(--ball);border:2px solid var(--ink);padding:1px 10px;border-radius:999px;white-space:nowrap;transform:rotate(-2deg)}
.desc{color:var(--muted);font-size:.86rem;margin-top:3px}
.tags{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
.tag{font-size:.72rem;font-weight:700;padding:2px 8px;border-radius:999px;border:1.5px solid var(--ink)}
footer{text-align:center;color:var(--chalk);font-weight:800;font-size:.8rem;padding:30px 16px 0}
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{animation-duration:.01ms!important;animation-delay:0s!important;transition-duration:.01ms!important;scroll-behavior:auto!important}
  .intro-title span{opacity:1}
  .reveal{opacity:1!important;transform:none!important}
}
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute"><filter id="wobble"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="5"/></filter></svg>
<div id="intro" aria-hidden="true">
  <svg class="court-svg" viewBox="0 0 360 520">
    <g class="wob">
      <rect x="18" y="12" width="324" height="250" rx="6" fill="#c8452c"/>
      <path class="ln" d="M40 30 H320 V245 H40 Z M70 30 V245 M290 30 V245 M70 90 H290 M70 185 H290 M180 90 V185"/>
      <rect x="34" y="128" width="292" height="16" fill="#fbf6ea"/>
      <defs><pattern id="mesh" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 0 L8 8 M8 0 L0 8" stroke="#a8361f" stroke-width="1.3"/></pattern></defs>
      <rect x="34" y="128" width="292" height="16" fill="url(#mesh)"/>
      <rect x="18" y="282" width="324" height="226" rx="6" fill="#2f6fb3"/>
      <path class="ln" d="M44 300 H316 V490 H44 Z M44 395 H316 M180 330 V460 M44 330 H316 M44 460 H316" style="stroke-width:4"/>
      <rect class="glass" x="26" y="290" width="308" height="210" rx="4" fill="none" stroke="#cfeaff" stroke-opacity=".8" stroke-width="5" stroke-dasharray="70 8"/>
    </g>
    <g class="pa"><circle cx="112" cy="42" r="7" fill="#3a2418"/><path d="M104 50 h16 l-2 16 h-12 Z" fill="#fff" stroke="#1b1410" stroke-width="1.5"/><path d="M107 66 v10 M117 66 v10" stroke="#1b1410" stroke-width="3"/><path d="M120 54 l12 6" stroke="#1b1410" stroke-width="3"/><ellipse cx="136" cy="62" rx="5" ry="6" fill="none" stroke="#1b1410" stroke-width="2"/></g>
    <g class="pb"><circle cx="240" cy="200" r="7" fill="#6b4226"/><path d="M232 208 h16 l-2 16 h-12 Z" fill="#fff" stroke="#1b1410" stroke-width="1.5"/><path d="M235 224 v10 M245 224 v10" stroke="#1b1410" stroke-width="3"/><path d="M232 212 l-12 -4" stroke="#1b1410" stroke-width="3"/><ellipse cx="216" cy="206" rx="5" ry="6" fill="none" stroke="#1b1410" stroke-width="2"/></g>
    <g class="pc"><circle cx="112" cy="318" r="7" fill="#3a2418"/><path d="M104 326 h16 l-2 16 h-12 Z" fill="#fbf6ea" stroke="#1b1410" stroke-width="1.5"/><path d="M107 342 v10 M117 342 v10" stroke="#1b1410" stroke-width="3"/><path d="M120 330 l8 2" stroke="#1b1410" stroke-width="3"/><rect x="127" y="324" width="11" height="14" rx="5" fill="#1b1410"/></g>
    <g class="pd"><circle cx="258" cy="440" r="7" fill="#6b4226"/><path d="M250 448 h16 l-2 16 h-12 Z" fill="#fbf6ea" stroke="#1b1410" stroke-width="1.5"/><path d="M253 464 v10 M263 464 v10" stroke="#1b1410" stroke-width="3"/><path d="M250 452 l-8 -2" stroke="#1b1410" stroke-width="3"/><rect x="232" y="442" width="11" height="14" rx="5" fill="#1b1410"/></g>
    <g class="ball"><circle r="7.5" fill="#e9e23a" stroke="#1b1410" stroke-width="1.5"/><path d="M-6 -4 q6 4 0 8 M6 -4 q-6 4 0 8" stroke="#fff" stroke-width="1.4" fill="none"/></g>
  </svg>
  <div class="intro-title hand">${'T10 CLUB'.split('').map((c, i) => c === ' ' ? '<i style="width:.35em"></i>' : `<span style="--i:${i}">${c}</span>`).join('')}</div>
</div>
<div class="page"><div class="rug">
<div class="lang-bar" role="navigation" aria-label="Language">
  <div class="lang-switch"><span class="thumb"></span>
    <a class="lang-btn${lang === 'fa' ? ' active' : ''}" href="${esc(faUrl)}" hreflang="fa" data-lang="fa">${ui.langFa}</a>
    <a class="lang-btn${lang === 'en' ? ' active' : ''}" href="${esc(enUrl)}" hreflang="en" data-lang="en">${ui.langEn}</a>
  </div>
</div>
<header class="hero">
  ${logo}
  <h1 class="hand">${esc(/club/i.test(venueName) ? venueName : venueName + " CLUB")}</h1>
  <p class="sub">${esc(tagline || introSub)}</p>
  </header>
<div class="net"></div>
${navLinks ? `<nav aria-label="Menu categories"><div class="tabs"><span class="tab-ind"></span>${navLinks}</div></nav>` : ''}
<main>
${specialsSection}
${categorySections || '<p style="text-align:center;padding:40px 0;color:' + pal.muted + '">' + esc(ui.empty) + '</p>'}
</main>
<footer>${esc(ui.footerPrefix)} ${esc(venueName)}</footer>
</div></div>
<script>
(function(){
  var d=document.documentElement, intro=document.getElementById('intro'), t0=Date.now();
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MIN=reduce?300:3100, MAX=3600, shown=false;
  function show(){ if(shown) return; shown=true; d.classList.add('ready'); if(intro) intro.classList.add('done'); setTimeout(function(){d.classList.remove('js-intro');},600); revealInit(); }
  if(d.classList.contains('js-intro')){
    var finish=function(){ setTimeout(show, Math.max(0, MIN-(Date.now()-t0))); };
    if(document.readyState==='complete') finish(); else addEventListener('load', finish);
    setTimeout(show, MAX);
  } else { d.classList.add('ready'); shown=true; revealInit(); }

  /* Staggered card reveal on scroll */
  function revealInit(){
    var els=[].slice.call(document.querySelectorAll('.reveal'));
    if(!('IntersectionObserver' in window)||reduce){els.forEach(function(e){e.classList.add('in')});return;}
    var io=new IntersectionObserver(function(entries){
      var i=0; entries.forEach(function(en){ if(en.isIntersecting){ en.target.style.setProperty('--d',(i++*70)+'ms'); en.target.classList.add('in'); io.unobserve(en.target);} });
    },{rootMargin:'0px 0px -8% 0px',threshold:0});
    els.forEach(function(e){io.observe(e)});
  }

  /* Sliding tab indicator + scroll spy */
  var tabs=document.querySelector('.tabs'), ind=document.querySelector('.tab-ind');
  if(tabs&&ind){
    var links=[].slice.call(tabs.querySelectorAll('.nav-link')), cur=null, lock=0;
    function setActive(a){ if(!a||a===cur) return; if(cur) cur.classList.remove('active'); cur=a; a.classList.add('active');
      ind.style.left=a.offsetLeft+'px'; ind.style.width=a.offsetWidth+'px';
      var target=a.offsetLeft-(tabs.clientWidth-a.offsetWidth)/2; tabs.scrollTo({left:target,behavior:reduce?'auto':'smooth'}); }
    links.forEach(function(a){ a.addEventListener('click',function(){ lock=Date.now(); setActive(a); }); });
    var secs=links.map(function(a){return document.getElementById(a.dataset.target)});
    function spy(){ if(Date.now()-lock<900) return; var y=80, best=links[0];
      secs.forEach(function(s,i){ if(s && s.getBoundingClientRect().top-y<=0) best=links[i]; }); setActive(best); }
    addEventListener('scroll',function(){ requestAnimationFrame(spy); },{passive:true});
    addEventListener('resize',function(){ var a=cur; cur=null; setActive(a); });
    (document.fonts&&document.fonts.ready||Promise.resolve()).then(function(){ setActive(links[0]); });
  }

  /* Animated fa/en switch: slide the thumb, fade page, then navigate */
  [].slice.call(document.querySelectorAll('.lang-btn')).forEach(function(a){
    a.addEventListener('click',function(e){ if(a.classList.contains('active')) { e.preventDefault(); return; }
      try{sessionStorage.setItem('skipIntro','1');}catch(_){}
      if(reduce) return; e.preventDefault();
      a.parentNode.classList.add('go-'+a.dataset.lang);
      var p=document.querySelector('.page'); p.style.transition='opacity .35s'; setTimeout(function(){p.style.opacity='.0';},180);
      setTimeout(function(){ location.href=a.href; },420); });
  });
})();
</script>
</body>
</html>`;
}


module.exports = { renderMenuPage, esc, moneyEn, moneyFa, parseBranding, pickText };
